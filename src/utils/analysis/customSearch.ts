// "Custom search" test: slides user-drawn negative templates (with wildcards and
// equality-constrained variables) over the diagram; a rule passes when none match.
import type {
  AnalysisInitMode,
  CustomPattern,
  CustomSearchOptions,
  CustomSearchResult,
  RuleParts,
} from '../../types/ca'
import { evolveRows } from './evolve'

/**
 * "Custom search" test. The user supplies one or more W×H templates whose cells
 * each hold a concrete state value or the wildcard -1 ("any"). This evolves the
 * full W×H space-time diagram once and slides every "negative" template over it;
 * the rule PASSES (and is later tagged) only when NONE of the templates occur —
 * the first match anywhere excludes the rule. Templates larger than the diagram,
 * or with no usable cells, are ignored; when no usable template remains the rule
 * cannot pass (nothing to search), so callers should guard on a non-empty set.
 */
export function detectCustomSearch(parts: RuleParts, options: CustomSearchOptions): CustomSearchResult {
  const width = Math.max(2, Math.floor(options.width))
  const height = Math.max(1, Math.floor(options.height))
  const init: AnalysisInitMode = options.init === 'single' ? 'single' : 'random'
  const patterns = Array.isArray(options.negativePatterns) ? options.negativePatterns : []

  const usable = patterns.filter(
    (p): p is CustomPattern =>
      !!p &&
      Number.isFinite(p.width) &&
      Number.isFinite(p.height) &&
      p.width >= 1 &&
      p.height >= 1 &&
      p.width <= width &&
      p.height <= height &&
      Array.isArray(p.cells) &&
      p.cells.length >= p.width * p.height
  )
  if (usable.length === 0) {
    return { passes: false, matchedIndex: -1, matchedX: -1, matchedY: -1 }
  }

  const { rows } = evolveRows(parts, { width, height, keep: height, init })

  for (let pi = 0; pi < usable.length; pi++) {
    const pat = usable[pi]
    const pw = pat.width
    const ph = pat.height
    const cells = pat.cells
    const varCount = patternVarCount(cells)
    const varAssign = new Int32Array(Math.max(1, varCount))
    for (let y0 = 0; y0 + ph <= height; y0++) {
      for (let x0 = 0; x0 + pw <= width; x0++) {
        if (patternMatchesAt(rows, x0, y0, pw, ph, cells, varAssign)) {
          return { passes: false, matchedIndex: pi, matchedX: x0, matchedY: y0 }
        }
      }
    }
  }
  return { passes: true, matchedIndex: -1, matchedX: -1, matchedY: -1 }
}

/**
 * Number of distinct variables referenced by a template's cells (0 when none).
 * Variables are encoded as cell values <= -2 (x1 = -2, x2 = -3, …).
 */
function patternVarCount(cells: number[]): number {
  let max = -1
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]
    if (c <= -2) {
      const vi = -2 - c
      if (vi > max) {
        max = vi
      }
    }
  }
  return max + 1
}

/**
 * True when the pw×ph template `cells` (row-major) fits the diagram exactly at
 * top-left (x0, y0): every non-wildcard template cell must equal the matching
 * diagram cell. Wildcards (-1) match anything. Variables (<= -2) bind to the
 * first diagram value they see and then every later cell carrying the same
 * variable must repeat that value — an equality constraint. `varAssign` is a
 * reusable scratch buffer that is reset here on each attempt.
 */
function patternMatchesAt(
  rows: Uint8Array[],
  x0: number,
  y0: number,
  pw: number,
  ph: number,
  cells: number[],
  varAssign: Int32Array
): boolean {
  varAssign.fill(-1)
  let idx = 0
  for (let y = 0; y < ph; y++) {
    const rowData = rows[y0 + y]
    for (let x = 0; x < pw; x++) {
      const want = cells[idx++]
      if (want === -1) {
        continue
      }
      const actual = rowData[x0 + x]
      if (want >= 0) {
        if (actual !== want) {
          return false
        }
      } else {
        // Variable: enforce that all cells sharing it resolve to the same value.
        const vi = -2 - want
        const bound = varAssign[vi]
        if (bound === -1) {
          varAssign[vi] = actual
        } else if (bound !== actual) {
          return false
        }
      }
    }
  }
  return true
}
