// Per-rule sub-analysis: searches ascending widths for the smallest one at which
// the space-time diagram is spatially uniform across horizontal chunks.
import type { AnalysisInitMode, RuleParts, SubAnalyzeOptions, SubAnalyzeResult } from '../../types/ca'
import { evolveRows } from './evolve'

/**
 * Per-rule sub-analysis. Searches ascending widths for the smallest one at which
 * the pattern is spatially uniform: the sum of all cell values over the last K
 * rows, computed for every horizontal chunk (chunk width = N% of the width),
 * deviates from the mean chunk sum by at most R% for EVERY chunk.
 */
export function subAnalyzeRule(parts: RuleParts, options: SubAnalyzeOptions): SubAnalyzeResult {
  const keep = Math.max(1, Math.floor(options.keep))
  const chunkPercent = Math.max(0.1, Number(options.chunkPercent))
  const tolerance = Math.max(0, Number(options.tolerance)) / 100
  const height = Math.max(keep, Math.floor(options.height))
  const init: AnalysisInitMode = options.init === 'single' ? 'single' : 'random'
  const minWidth = Math.max(4, Math.floor(options.minWidth))
  const maxWidth = Math.max(minWidth, Math.floor(options.maxWidth))
  const step = Math.max(1, Math.floor(options.step))

  let bestWidth: number | null = null
  let bestDev: number | null = null
  let tested = 0

  for (let width = minWidth; width <= maxWidth; width += step) {
    const chunkWidth = Math.max(1, Math.round((chunkPercent / 100) * width))
    const numChunks = Math.floor(width / chunkWidth)
    if (numChunks < 2) {
      continue
    }
    tested += 1

    const { rows } = evolveRows(parts, { width, height, keep, init })

    const chunkSums = new Array<number>(numChunks)
    let grandTotal = 0
    for (let ci = 0; ci < numChunks; ci++) {
      const x0 = ci * chunkWidth
      const x1 = x0 + chunkWidth
      let sum = 0
      for (let r = 0; r < rows.length; r++) {
        const rowData = rows[r]
        for (let x = x0; x < x1; x++) {
          sum += rowData[x]
        }
      }
      chunkSums[ci] = sum
      grandTotal += sum
    }

    const mean = grandTotal / numChunks
    let maxDev = 0
    if (mean > 0) {
      for (let ci = 0; ci < numChunks; ci++) {
        const dev = Math.abs(chunkSums[ci] - mean) / mean
        if (dev > maxDev) {
          maxDev = dev
        }
      }
    }

    if (bestDev === null || maxDev < bestDev) {
      bestDev = maxDev
      bestWidth = width
    }

    if (maxDev <= tolerance) {
      return { foundWidth: width, foundDev: maxDev, bestWidth: width, bestDev: maxDev, tested }
    }
  }

  return { foundWidth: null, foundDev: null, bestWidth, bestDev, tested }
}
