// Pure, framework-agnostic math helpers for totalistic / local-rule
// one-dimensional cellular automata with an arbitrary number of states.

import type { CaConfig, RuleParts, RuleSnapshot } from '../types/ca'

/** Clamps an arbitrary value to one of the supported state counts (2-5), defaulting to 3. */
export function normalizeStateCount(value: unknown): number {
  const n = Math.floor(Number(value))
  return n >= 2 && n <= 5 ? n : 3
}

/** Builds classifier `parts` (rule identity) from a saved rule snapshot. */
export function partsFromSnapshot(snapshot: RuleSnapshot): RuleParts {
  const stateCount = normalizeStateCount(snapshot.stateCount)
  return snapshot.mode === 'totalistic'
    ? { stateCount, mode: 'totalistic', code: snapshot.code || 0, localRule: '' }
    : { stateCount, mode: 'local', code: 0, localRule: snapshot.localRule || '' }
}

/**
 * Derives all the size/range values that depend on the number of states.
 * @param states number of cell states (2-5)
 */
export function getConfig(states: number): CaConfig {
  const totalisticDigits = 3 * (states - 1) + 1
  return {
    states,
    maxDigit: states - 1,
    totalisticDigits,
    totalisticMax: Math.pow(states, totalisticDigits) - 1,
    localDigits: Math.pow(states, 3),
  }
}

/** Keeps only valid digits (0..maxDigit) from `text`, optionally capped to `maxLen`. */
export function sanitizeStateString(text: unknown, maxLen: number | undefined, states: number): string {
  const config = getConfig(states)
  const source = String(text || '')
  let clean = ''
  for (let i = 0; i < source.length; i++) {
    const digit = source.charCodeAt(i) - 48
    if (digit >= 0 && digit <= config.maxDigit) {
      clean += source.charAt(i)
      if (typeof maxLen === 'number' && clean.length >= maxLen) {
        break
      }
    }
  }
  return clean
}

/** Pads `text` on the right with '0' until it reaches `len` characters. */
export function padRight(text: string, len: number): string {
  let result = text
  while (result.length < len) {
    result += '0'
  }
  return result
}

/** Expands a totalistic rule code into a lookup table indexed by neighbor sum. */
export function totalisticTable(code: number, states: number): number[] {
  const config = getConfig(states)
  const table: number[] = []
  for (let sum = 0; sum < config.totalisticDigits; sum++) {
    table.push(Math.floor(code / Math.pow(config.states, sum)) % config.states)
  }
  return table
}

/** Converts `value` to a base-`base` string zero-padded to `width` characters. */
export function toBaseN(value: number, width: number, base: number): string {
  let out = ''
  let remaining = value
  while (out.length < width) {
    out = String(remaining % base) + out
    remaining = Math.floor(remaining / base)
  }
  return out
}

/** Builds the 27/8-digit local rule string equivalent to a totalistic code. */
export function buildLocalRuleFromTotalistic(code: number, states: number): string {
  const config = getConfig(states)
  const sums = totalisticTable(code, config.states)
  let rule = ''
  for (let left = 0; left < config.states; left++) {
    for (let center = 0; center < config.states; center++) {
      for (let right = 0; right < config.states; right++) {
        rule += String(sums[left + center + right])
      }
    }
  }
  return rule
}

/**
 * Converts a local rule string into its numeric code, using the standard
 * (Wolfram) convention: the digit at string index `v` — where `v` is the
 * neighborhood value `left*states^2 + center*states + right` — is weighted
 * by `states^v`, i.e. the neighborhood "000" is the least-significant digit.
 * This mirrors `totalisticTable`, where the lowest neighbor sum is also the
 * least-significant digit, and is what makes e.g. local rule 30 (2 states)
 * match the well-known chaotic elementary CA "Rule 30".
 */
export function localRuleToCode(rule: string, states: number): number {
  const config = getConfig(states)
  const clean = padRight(sanitizeStateString(rule, config.localDigits, states), config.localDigits)
  let code = 0
  for (let i = clean.length - 1; i >= 0; i--) {
    code = code * config.states + (clean.charCodeAt(i) - 48)
  }
  return code
}

/**
 * Picks `count` rule codes from the inclusive [from, to] range: sequentially
 * when the range is no bigger than `count` (nothing to sample), otherwise a
 * set of unique random codes drawn uniformly from the range. Used to scan a
 * fixed-size random sample instead of the full range, which matters for huge
 * ranges (e.g. local rules with many states) where a full scan is infeasible.
 */
export function pickRandomCodes(from: number, to: number, count: number): number[] {
  const lo = Math.max(0, Math.floor(from))
  const hi = Math.max(lo, Math.floor(to))
  const span = hi - lo + 1
  const n = Math.max(1, Math.floor(count))
  if (span <= n) {
    const codes: number[] = []
    for (let code = lo; code <= hi; code++) {
      codes.push(code)
    }
    return codes
  }
  const seen = new Set<number>()
  const codes: number[] = []
  const maxAttempts = n * 20 + 1000
  let attempts = 0
  while (codes.length < n && attempts < maxAttempts) {
    attempts++
    const code = lo + Math.floor(Math.random() * span)
    if (!seen.has(code)) {
      seen.add(code)
      codes.push(code)
    }
  }
  return codes.sort((a, b) => a - b)
}

/** Converts a numeric local rule code back into its digit string (see `localRuleToCode`). */
export function codeToLocalRule(code: number, states: number): string {
  const config = getConfig(states)
  const normalized = Math.max(0, Math.min(Math.pow(config.states, config.localDigits) - 1, Math.floor(code)))
  let rule = ''
  let remaining = normalized
  for (let i = 0; i < config.localDigits; i++) {
    rule += String(remaining % config.states)
    remaining = Math.floor(remaining / config.states)
  }
  return rule
}
