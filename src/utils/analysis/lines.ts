// "Lines" test (absence of lines): discards the transient top of the
// space-time diagram, reduces the remaining part to an M×M pattern map (exactly
// like the "convert to patterns" view) and looks for full-height lines made of a
// single pattern colour. A "line" runs the whole kept height (from the cut row
// y0 down to the bottom of the generation) and is either straight (vertical) or
// diagonal (either slant). A rule "has lines" (`hasLines`) when at least
// `lineCount` such lines share one direction; the pattern size M is grown from
// `minBlock` up to `maxBlock` until lines appear. Callers tag the rules where NO
// lines are ever found — i.e. the *absence* of lines.
import type { AnalysisInitMode, LineDirection, LinesOptions, LinesResult, RuleParts } from '../../types/ca'
import { evolveRows } from './evolve'
import { buildPatternMap } from './patternMap'

export function detectLines(parts: RuleParts, options: LinesOptions): LinesResult {
  const width = Math.max(2, Math.floor(options.width))
  const height = Math.max(1, Math.floor(options.height))
  const init: AnalysisInitMode = options.init === 'single' ? 'single' : 'random'
  const cutFraction = Math.max(0, Math.min(90, Number(options.cutTop))) / 100
  const minBlock = Math.max(1, Math.floor(options.minBlock))
  const maxBlock = Math.max(minBlock, Math.floor(options.maxBlock))
  const blockStep = Math.max(1, Math.floor(options.blockStep))
  const lineCount = Math.max(1, Math.floor(options.lineCount))
  const ignoreBackground = options.ignoreBackground !== false

  const { rows, states } = evolveRows(parts, { width, height, keep: height, init })

  // Cut off the transient top: keep everything from y0 = cutFraction·H to the bottom.
  const startRow = Math.min(height - 1, Math.floor(height * cutFraction))
  const kept = rows.slice(startRow)

  let hasLines = false
  let direction: LineDirection | null = null
  let bestCount = 0
  let bestBlock = minBlock

  for (let M = minBlock; M <= maxBlock; M += blockStep) {
    const map = buildPatternMap(kept, states, M)
    const cols = map.cols
    const blockRows = map.rows
    bestBlock = M
    // A meaningful full-height line needs at least a couple of block-rows.
    if (blockRows < 2 || cols < 1) {
      continue
    }
    const cell = map.cellIndex
    // buildPatternMap sorts patterns by descending frequency, so index 0 is the
    // dominant (background) pattern — skip it so an empty/uniform field is not
    // counted as an all-background line.
    const bg = ignoreBackground ? 0 : -1

    // Full-height straight lines: a column whose pattern is constant top→bottom.
    let vertical = 0
    for (let bx = 0; bx < cols; bx++) {
      const p = cell[bx]
      if (p === bg) {
        continue
      }
      let ok = true
      for (let by = 1; by < blockRows; by++) {
        if (cell[by * cols + bx] !== p) {
          ok = false
          break
        }
      }
      if (ok) {
        vertical += 1
      }
    }

    // Full-height diagonal lines of ANY slope. A diagonal line is a connected
    // streak of one pattern colour that touches both the top kept row and the
    // bottom one and drifts sideways (so it is genuinely slanted, not a vertical
    // column). Cells are grouped 8-connected — the next cell of a line may be to
    // the side, below, or diagonally below/adjacent — so slopes from nearly
    // vertical to nearly horizontal are all captured, and each streak (however
    // thick) is counted once.
    const diagonal = countDiagonalStreaks(cell, cols, blockRows, bg)

    const localBest = Math.max(vertical, diagonal)
    if (localBest > bestCount) {
      bestCount = localBest
      direction = vertical >= diagonal ? 'vertical' : 'diagonal'
    }

    if (vertical >= lineCount || diagonal >= lineCount) {
      hasLines = true
      bestCount = localBest
      direction = vertical >= diagonal ? 'vertical' : 'diagonal'
      break
    }
  }

  return { hasLines, direction, lineCount: bestCount, blockSize: bestBlock }
}

/**
 * Counts full-height diagonal lines of ANY slope. Each maximal 8-connected group
 * of same-colour (non-background) blocks is a candidate "streak"; it is counted
 * as one diagonal line when it touches both the top and the bottom kept row and
 * spans more than one column (so it slants rather than standing vertically — a
 * 1-column vertical line has zero drift and is handled by the vertical scan
 * instead). 8-connectivity means a line may continue to the side, below or
 * diagonally, which lets it take any slope from near-vertical to near-horizontal;
 * grouping into components makes each streak count once regardless of thickness.
 */
function countDiagonalStreaks(cell: Int32Array, cols: number, blockRows: number, bg: number): number {
  const total = cols * blockRows
  const visited = new Uint8Array(total)
  const stack: number[] = []
  const bottom = blockRows - 1
  let count = 0

  for (let start = 0; start < total; start++) {
    if (visited[start]) {
      continue
    }
    const p = cell[start]
    visited[start] = 1
    if (p === bg) {
      continue
    }
    stack.length = 0
    stack.push(start)
    let touchesTop = false
    let touchesBottom = false
    let minC = cols
    let maxC = -1
    while (stack.length) {
      const idx = stack.pop() as number
      const r = (idx / cols) | 0
      const c = idx - r * cols
      if (r === 0) {
        touchesTop = true
      }
      if (r === bottom) {
        touchesBottom = true
      }
      if (c < minC) {
        minC = c
      }
      if (c > maxC) {
        maxC = c
      }
      for (let dr = -1; dr <= 1; dr++) {
        const nr = r + dr
        if (nr < 0 || nr >= blockRows) {
          continue
        }
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) {
            continue
          }
          const nc = c + dc
          if (nc < 0 || nc >= cols) {
            continue
          }
          const nIdx = nr * cols + nc
          if (!visited[nIdx] && cell[nIdx] === p) {
            visited[nIdx] = 1
            stack.push(nIdx)
          }
        }
      }
    }
    if (touchesTop && touchesBottom && maxC > minC) {
      count += 1
    }
  }
  return count
}
