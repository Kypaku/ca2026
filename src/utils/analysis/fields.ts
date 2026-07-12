// "Fields" test: tiles the space-time diagram into shift-invariant patches and
// flags rules whose dominant patch class covers a configurable share of blocks.
import type { AnalysisInitMode, FieldsOptions, FieldsResult, RuleParts } from '../../types/ca'
import { evolveRows } from './evolve'
import { isUniformPatch } from './patches'

/**
 * "Fields" test. Evolves the full W×H space-time diagram and tiles it into
 * rectangular patches of size `blockWidth` × `blockHeight`. Every patch is
 * reduced to a canonical key that is invariant under horizontal cyclic shift,
 * so a regular background texture that *drifts* sideways (each block-row offset
 * from the one above) still maps its patches to the same class instead of
 * fragmenting into many "different" ones. Uniform patches (every cell the same
 * value) are ignored, so empty or fully-filled space is never counted as a
 * field. The rule is deemed to grow repeating "fields" (`hasFields`) when the
 * single most common patch class covers at least `minPercent`% of the remaining
 * (non-uniform) patches. Leftover cells that do not fill a whole patch (on the
 * right/bottom edges) are ignored.
 */
export function detectFields(parts: RuleParts, options: FieldsOptions): FieldsResult {
  const width = Math.max(2, Math.floor(options.width))
  const height = Math.max(1, Math.floor(options.height))
  const blockWidth = Math.max(1, Math.min(width, Math.floor(options.blockWidth)))
  const blockHeight = Math.max(1, Math.min(height, Math.floor(options.blockHeight)))
  const minPercent = Math.max(0, Math.min(100, Number(options.minPercent)))
  const init: AnalysisInitMode = options.init === 'single' ? 'single' : 'random'

  const { rows } = evolveRows(parts, { width, height, keep: height, init })

  const cols = Math.floor(width / blockWidth)
  const blockRows = Math.floor(height / blockHeight)

  const counts = new Map<string, number>()
  let dominantCount = 0
  let consideredBlocks = 0

  const chars = new Array<number>(blockWidth * blockHeight)
  for (let by = 0; by < blockRows; by++) {
    const y0 = by * blockHeight
    for (let bx = 0; bx < cols; bx++) {
      const x0 = bx * blockWidth
      if (isUniformPatch(rows, x0, y0, blockWidth, blockHeight)) {
        continue
      }
      consideredBlocks += 1
      const key = canonicalPatchKey(rows, x0, y0, blockWidth, blockHeight, chars)
      const count = (counts.get(key) || 0) + 1
      counts.set(key, count)
      if (count > dominantCount) {
        dominantCount = count
      }
    }
  }

  const dominantFraction = consideredBlocks > 0 ? dominantCount / consideredBlocks : 0
  const hasFields = consideredBlocks >= 2 && dominantCount >= 2 && dominantFraction * 100 >= minPercent

  return {
    hasFields,
    dominantCount,
    dominantFraction,
    distinctBlocks: counts.size,
    totalBlocks: consideredBlocks,
  }
}

/**
 * Builds a key for one W×H patch that is invariant under horizontal cyclic
 * rotation: it returns the lexicographically smallest string over all `bw`
 * rotations of the patch (every row rotated by the same offset). For a genuine
 * field the window content is spatially periodic, so a sideways drift equals a
 * cyclic rotation and drifted copies collapse onto the same key. `scratch` is a
 * reusable buffer of length `bw * bh`.
 */
function canonicalPatchKey(
  rows: Uint8Array[],
  x0: number,
  y0: number,
  bw: number,
  bh: number,
  scratch: number[]
): string {
  let best: string | null = null
  for (let r = 0; r < bw; r++) {
    let idx = 0
    for (let y = 0; y < bh; y++) {
      const rowData = rows[y0 + y]
      for (let x = 0; x < bw; x++) {
        scratch[idx++] = rowData[x0 + ((x + r) % bw)]
      }
    }
    const key = String.fromCharCode.apply(null, scratch)
    if (best === null || key < best) {
      best = key
    }
  }
  return best as string
}
