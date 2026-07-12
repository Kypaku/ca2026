// Shared low-level helpers used across the analysis modules: a seedable PRNG,
// a stable string hash (to derive per-rule seeds) and the initial-row builder.
import type { AnalysisInitMode } from '../../types/ca'

/** Small, fast, seedable PRNG so classification is reproducible per rule. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function random(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash of a string, used to derive a stable seed for local rules. */
export function hashString(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function buildInitialRow(
  width: number,
  states: number,
  initMode: AnalysisInitMode,
  rand: () => number
): Uint8Array {
  const row = new Uint8Array(width)
  if (initMode === 'single') {
    row[width >> 1] = 1
    return row
  }
  for (let i = 0; i < width; i++) {
    row[i] = Math.floor(rand() * states)
  }
  return row
}
