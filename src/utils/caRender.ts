// Pure canvas rendering + evolution for the explorer's space-time diagram.
// Kept framework-agnostic so useCellularAutomaton only wires reactive state to it.
import { CA_COLORS, CA_PIXEL_SIZE } from '../constants/ca'
import { sanitizeStateString } from './caMath'
import type { CaConfig, CollisionMode, InitMode, RuleMode } from '../types/ca'

/** Builds the first row from the chosen init mode (single / random / custom seed). */
export function buildInitialRow(
  width: number,
  config: CaConfig,
  stateCount: number,
  init: InitMode,
  seedInput: string
): Uint8Array {
  const row = new Uint8Array(width)
  if (init === 'single') {
    row[Math.floor(width / 2)] = 1
    return row
  }
  if (init === 'custom') {
    const seed = sanitizeStateString(seedInput, width, stateCount)
    if (!seed.length) {
      row[Math.floor(width / 2)] = 1
      return row
    }
    const offset = Math.max(0, Math.floor((width - seed.length) / 2))
    for (let i = 0; i < seed.length && i < width; i++) {
      row[offset + i] = seed.charCodeAt(i) - 48
    }
    return row
  }
  for (let j = 0; j < width; j++) {
    row[j] = Math.floor(Math.random() * config.states)
  }
  return row
}

export interface RenderDiagramParams {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  config: CaConfig
  mode: RuleMode
  /** Totalistic sum → state table (mode === 'totalistic'), else null. */
  sums: number[] | null
  /** Explicit local rule string (mode === 'local'), else ''. */
  explicitRule: string
  /** Emission lookup of length `3 * (states - 1)` (mode === 'descendants'), else null. */
  emission?: number[] | null
  /** How colliding signals are merged (mode === 'descendants'). */
  collisionMode?: CollisionMode
  /** Constant used when `collisionMode === 'fixed'`. */
  collisionFixed?: number
  /** Fraction 0..1 of cells forced to a rule-defying value each step. */
  noiseP: number
  initialRow: Uint8Array
}

/** Computes the next row from `row` using the shared totalistic/local/descendants rule + noise logic. */
export function evolveStep(
  row: Uint8Array,
  width: number,
  config: CaConfig,
  mode: RuleMode,
  sums: number[] | null,
  explicitRule: string,
  noiseP: number,
  emission?: number[] | null,
  collisionMode?: CollisionMode,
  collisionFixed?: number
): Uint8Array {
  const nextRow = new Uint8Array(width)
  const states = config.states
  const merge: CollisionMode = collisionMode || 'sum'
  const fixed = collisionFixed || 0
  for (let k = 0; k < width; k++) {
    const left = row[(k - 1 + width) % width]
    const center = row[k]
    const right = row[(k + 1) % width]
    let value: number
    if (mode === 'totalistic') {
      value = (sums as number[])[left + center + right]
    } else if (mode === 'local') {
      value = explicitRule.charCodeAt(left * states * states + center * states + right) - 48
    } else {
      // Descendants: each child gathers up to 3 emitted contributions. Background
      // (state 0) emits nothing; a live parent's triple lives at (state-1)*3 in
      // `emission`. a = right-child of the left parent, b = center-child of the
      // center parent, c = left-child of the right parent.
      const em = emission as number[]
      const a = left === 0 ? 0 : em[(left - 1) * 3 + 2]
      const b = center === 0 ? 0 : em[(center - 1) * 3 + 1]
      const c = right === 0 ? 0 : em[(right - 1) * 3 + 0]
      value = resolveCollision(a, b, c, states, merge, fixed)
    }
    if (noiseP > 0 && Math.random() < noiseP) {
      // Force a value different from the one the rule dictates, so the
      // deviation is guaranteed to go "against" the rule, not just be noisy.
      let deviation = Math.floor(Math.random() * (config.states - 1))
      if (deviation >= value) {
        deviation += 1
      }
      value = deviation
    }
    nextRow[k] = value
  }
  return nextRow
}

/**
 * Merges up to three emitted contributions (0 = no emission) into a single
 * child state. No live signal → 0; a single live signal passes through; 2+
 * live signals collide and are resolved by `mode`:
 *   sum → (a+b+c) mod states, random → a fully random state, fixed → `fixed`.
 */
function resolveCollision(
  a: number,
  b: number,
  c: number,
  states: number,
  mode: CollisionMode,
  fixed: number
): number {
  let live = 0
  let single = 0
  if (a) {
    live++
    single = a
  }
  if (b) {
    live++
    single = b
  }
  if (c) {
    live++
    single = c
  }
  if (live === 0) {
    return 0
  }
  if (live === 1) {
    return single
  }
  if (mode === 'sum') {
    return (a + b + c) % states
  }
  if (mode === 'fixed') {
    return fixed
  }
  // random: on any collision emit a fully random state (0..states-1), so it is
  // visibly stochastic even for 2 colors where all live contributions are equal.
  return Math.floor(Math.random() * states)
}

/** Draws a single already-computed row of cells at row index `y` onto `ctx`. */
function paintRow(ctx: CanvasRenderingContext2D, row: Uint8Array, width: number, y: number): void {
  for (let x = 0; x < width; x++) {
    const state = row[x]
    if (state) {
      ctx.fillStyle = CA_COLORS[state]
      ctx.fillRect(x * CA_PIXEL_SIZE, y * CA_PIXEL_SIZE, CA_PIXEL_SIZE, CA_PIXEL_SIZE)
    }
  }
}

/**
 * Draws the full H×W space-time diagram onto `ctx` and returns every rendered
 * row so callers can reuse the exact pixels (e.g. the "convert to patterns" view)
 * without re-evolving. The background is painted first; only non-zero cells are
 * stroked on top.
 */
export function renderDiagram(params: RenderDiagramParams): Uint8Array[] {
  const { ctx, width, height, config, mode, sums, explicitRule, emission, collisionMode, collisionFixed, noiseP } =
    params

  ctx.fillStyle = CA_COLORS[0]
  ctx.fillRect(0, 0, width * CA_PIXEL_SIZE, height * CA_PIXEL_SIZE)

  let row = params.initialRow
  const rowsData: Uint8Array[] = new Array(height)
  for (let y = 0; y < height; y++) {
    rowsData[y] = row.slice()
    paintRow(ctx, row, width, y)
    row = evolveStep(row, width, config, mode, sums, explicitRule, noiseP, emission, collisionMode, collisionFixed)
  }
  return rowsData
}

export interface ExtendDiagramParams {
  ctx: CanvasRenderingContext2D
  width: number
  config: CaConfig
  mode: RuleMode
  sums: number[] | null
  explicitRule: string
  emission?: number[] | null
  collisionMode?: CollisionMode
  collisionFixed?: number
  noiseP: number
  /** Rows already rendered/kept from a previous run() or extendDiagram() call. */
  previousRows: Uint8Array[]
  /** How many additional generations to simulate past `previousRows`. */
  extraRows: number
}

/**
 * Continues simulating a diagram that was already drawn by `renderDiagram`
 * (or a prior `extendDiagram` call), instead of restarting from the initial
 * row. Assumes `ctx`'s canvas has already been resized to fit
 * `(previousRows.length + extraRows)` rows and repaints the whole thing
 * (canvas resizing clears pixel contents), reusing the already-known rows
 * so nothing is re-evolved. Returns the full row set (previous + new).
 */
export function extendDiagram(params: ExtendDiagramParams): Uint8Array[] {
  const { ctx, width, config, mode, sums, explicitRule, emission, collisionMode, collisionFixed, noiseP, previousRows, extraRows } =
    params
  const totalHeight = previousRows.length + extraRows

  ctx.fillStyle = CA_COLORS[0]
  ctx.fillRect(0, 0, width * CA_PIXEL_SIZE, totalHeight * CA_PIXEL_SIZE)

  const rowsData: Uint8Array[] = new Array(totalHeight)
  let row = previousRows[previousRows.length - 1] || new Uint8Array(width)
  for (let y = 0; y < previousRows.length; y++) {
    rowsData[y] = previousRows[y]
    paintRow(ctx, previousRows[y], width, y)
  }
  for (let i = 0; i < extraRows; i++) {
    const y = previousRows.length + i
    row = evolveStep(row, width, config, mode, sums, explicitRule, noiseP, emission, collisionMode, collisionFixed)
    rowsData[y] = row
    paintRow(ctx, row, width, y)
  }
  return rowsData
}
