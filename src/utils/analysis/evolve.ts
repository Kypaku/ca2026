// Evolves a rule and returns the last `keep` rows of the space-time diagram.
import { getConfig, totalisticTable, padRight, sanitizeStateString, normalizeStateCount } from '../caMath'
import type { AnalysisInitMode, EvolveOptions, EvolveResult, RuleParts } from '../../types/ca'
import { buildInitialRow, hashString, mulberry32 } from './shared'

/**
 * Evolves a rule and returns the last `keep` rows of the space-time diagram.
 * Deterministic per rule (noise is ignored) so results are reproducible.
 */
export function evolveRows(parts: RuleParts, options: EvolveOptions): EvolveResult {
  const width = Math.max(2, Math.floor(options.width))
  const height = Math.max(1, Math.floor(options.height))
  const keep = Math.max(1, Math.min(height, Math.floor(options.keep || height)))
  const init: AnalysisInitMode = options.init === 'single' ? 'single' : 'random'
  const states = normalizeStateCount(parts.stateCount)
  const config = getConfig(states)

  const sums = parts.mode === 'totalistic' ? totalisticTable(parts.code, states) : null
  const ruleStr =
    parts.mode === 'totalistic'
      ? null
      : padRight(sanitizeStateString(parts.localRule, config.localDigits, states), config.localDigits)

  const seedSource = parts.mode === 'totalistic' ? parts.code >>> 0 : hashString(parts.localRule || '')
  const rand = mulberry32(Math.imul(seedSource + 1, 2654435761))

  let row = buildInitialRow(width, states, init, rand)
  const rows: Uint8Array[] = []
  const firstKept = height - keep

  for (let y = 0; y < height; y++) {
    if (y >= firstKept) {
      rows.push(row.slice())
    }
    if (y === height - 1) {
      break
    }
    const next = new Uint8Array(width)
    for (let k = 0; k < width; k++) {
      const left = row[(k - 1 + width) % width]
      const center = row[k]
      const right = row[(k + 1) % width]
      next[k] = sums
        ? sums[left + center + right]
        : (ruleStr as string).charCodeAt(left * states * states + center * states + right) - 48
    }
    row = next
  }
  return { rows, states }
}
