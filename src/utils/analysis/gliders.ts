// "Gliders" test: detects translating localized structures (gliders / spaceships)
// while rejecting space-filling fields via stationary-spaceship and locality gates.
import type { AnalysisInitMode, GlidersOptions, GlidersResult, RuleParts } from '../../types/ca'
import { evolveRows } from './evolve'
import { isUniformPatch, patchesEqual } from './patches'

/**
 * "Gliders" test. Detects translating localized structures (gliders / spaceships):
 * a non-uniform reference patch (`blockWidth` × `blockHeight`) taken at the top of
 * the space-time diagram that reappears further down in time, shifted sideways.
 *
 * For every horizontal start `x0` whose reference patch is non-uniform, the scan
 * walks down in time by `dy = 1 .. maxPeriods × blockHeight` rows. At each `dy` it
 * searches the light cone `|x - x0| <= dy` for an identical patch. The `condition`
 * decides which recurrences count: `'all'` accepts any shift (including a
 * zero-shift oscillator / "spaceship without displacement"); `'moving'` requires a
 * shift of at least `minShift` cells (a real glider); `'bidirectional'` further
 * demands confirmed movers going both left and right. For `'moving'` and
 * For `'moving'` and `'bidirectional'` two extra guards reject space-filling
 * FIELDS masquerading as motion: (1) a *locality gate* — the diagram's most common
 * (background) value must fill at least `backgroundMin`% of the cells, since a
 * glider is a localized structure on a quiescent background whereas a field splits
 * space roughly evenly; and (2) *temporal novelty* — the matched column must not
 * already hold the same pattern at time 0. Requiring `minMatches` hits filters out
 * chance coincidences (a period-`p` spaceship reappears at `dy = p, 2p, 3p, …`).
 * `hasGliders` reflects the chosen condition.
 */
export function detectGliders(parts: RuleParts, options: GlidersOptions): GlidersResult {
  const width = Math.max(2, Math.floor(options.width))
  const height = Math.max(1, Math.floor(options.height))
  const blockWidth = Math.max(1, Math.min(width, Math.floor(options.blockWidth)))
  const blockHeight = Math.max(1, Math.min(height, Math.floor(options.blockHeight)))
  const maxPeriods = Math.max(1, Math.floor(options.maxPeriods))
  const minShift = Math.max(1, Math.floor(options.minShift))
  const minMatches = Math.max(1, Math.floor(options.minMatches))
  const condition =
    options.condition === 'all' || options.condition === 'bidirectional' ? options.condition : 'moving'
  const effMinShift = condition === 'all' ? 0 : minShift
  const requireNovelty = condition !== 'all'
  const backgroundMin = Math.max(0, Math.min(100, Number(options.backgroundMin))) / 100
  const spaceshipRepeats = Math.max(1, Math.floor(options.spaceshipRepeats))
  const spaceshipGap = Math.max(1, Math.floor(options.spaceshipGap))
  const spaceshipStep = Math.max(1, Math.floor(options.spaceshipStep))
  const spaceshipDetections = Math.max(1, Math.floor(options.spaceshipDetections))
  const init: AnalysisInitMode = options.init === 'single' ? 'single' : 'random'

  const { rows } = evolveRows(parts, { width, height, keep: height, init })

  // Stationary-spaceship gate (moving conditions only): starting from the settled
  // bottom of the diagram, if a column's patch repeats in place (same x) over time,
  // the structure recurs WITHOUT horizontal displacement — an oscillator or striped
  // field, not a glider. Because a single in-place column looks identical to a lone
  // spaceship, the gate only fires when the recurrence holds across `spaceshipDetections`
  // stepped columns (stride `spaceshipStep`) — the signature of a space-filling field.
  // A real glider leaves its column, so it never repeats in place. Such rules are
  // excluded when the "no spaceships" (moving) conditions are active.
  if (
    requireNovelty &&
    hasStationarySpaceship(
      rows,
      width,
      height,
      blockWidth,
      blockHeight,
      spaceshipGap,
      spaceshipRepeats,
      spaceshipStep,
      spaceshipDetections
    )
  ) {
    return { hasGliders: false, matches: 0, bestShift: 0, bestDy: 0, bestX0: -1 }
  }

  // Locality gate (moving conditions only): a glider/spaceship is a localized
  // structure travelling over a mostly-quiescent background, whereas a field fills
  // space (~evenly split between values). Reject diagrams whose most common value
  // does not dominate — this kills striped / checker / chaotic space-filling
  // textures, including oscillating stripe fields whose phase-flip mimics motion.
  if (requireNovelty && backgroundMin > 0) {
    const freq = new Map<number, number>()
    for (let y = 0; y < height; y++) {
      const rowData = rows[y]
      for (let x = 0; x < width; x++) {
        const v = rowData[x]
        freq.set(v, (freq.get(v) || 0) + 1)
      }
    }
    let dominant = 0
    for (const count of freq.values()) {
      if (count > dominant) {
        dominant = count
      }
    }
    if (dominant / (width * height) < backgroundMin) {
      return { hasGliders: false, matches: 0, bestShift: 0, bestDy: 0, bestX0: -1 }
    }
  }

  const maxDy = Math.min(height - blockHeight, maxPeriods * blockHeight)

  let matches = 0
  let bestShift = 0
  let bestDy = 0
  let bestX0 = -1
  let confirmedAny = false
  let confirmedLeft = false
  let confirmedRight = false

  for (let x0 = 0; x0 + blockWidth <= width; x0++) {
    if (isUniformPatch(rows, x0, 0, blockWidth, blockHeight)) {
      continue
    }
    let hits = 0
    let lastShift = 0
    let lastDy = 0
    for (let dy = 1; dy <= maxDy; dy++) {
      const xMin = Math.max(0, x0 - dy)
      const xMax = Math.min(width - blockWidth, x0 + dy)
      let foundShift = 0
      let found = false
      for (let x = xMin; x <= xMax; x++) {
        const shift = x - x0
        if (Math.abs(shift) < effMinShift) {
          continue
        }
        if (!patchesEqual(rows, x0, 0, x, dy, blockWidth, blockHeight)) {
          continue
        }
        // Reject static spatial periodicity (e.g. striped fields): a genuine mover
        // arrives at a column that did NOT already hold the same pattern at time 0.
        if (requireNovelty && patchesEqual(rows, x0, 0, x, 0, blockWidth, blockHeight)) {
          continue
        }
        found = true
        foundShift = shift
        break
      }
      if (found) {
        hits += 1
        lastShift = foundShift
        lastDy = dy
        if (hits >= minMatches) {
          confirmedAny = true
          if (lastShift > 0) {
            confirmedRight = true
          } else if (lastShift < 0) {
            confirmedLeft = true
          }
          if (condition !== 'bidirectional') {
            return { hasGliders: true, matches: hits, bestShift: lastShift, bestDy: lastDy, bestX0: x0 }
          }
          if (confirmedLeft && confirmedRight) {
            return { hasGliders: true, matches: hits, bestShift: lastShift, bestDy: lastDy, bestX0: x0 }
          }
          break
        }
      }
    }
    if (hits > matches) {
      matches = hits
      bestShift = lastShift
      bestDy = lastDy
      bestX0 = x0
    }
  }

  const hasGliders = condition === 'bidirectional' ? confirmedLeft && confirmedRight : confirmedAny
  return { hasGliders, matches, bestShift, bestDy, bestX0 }
}

/**
 * Bottom-up stationary-"spaceship" test. Starting from the settled bottom row band
 * (`y0 = height - blockHeight`), for every column it takes a `blockWidth×blockHeight`
 * reference patch and scans UP in time looking for the SAME patch at the SAME
 * column. The first repeat must appear within `gap` rows; once repeats start they
 * must accumulate to `repeats` total, each within `gap` rows of the previous. A
 * column that satisfies this hosts a structure recurring in place — an oscillator
 * or striped field (a "spaceship without displacement").
 *
 * A SINGLE such in-place column cannot tell a localized stationary spaceship apart
 * from a space-filling field, so one detection is not enough. After the first hit
 * at column `x` the scan steps sideways by `step` and demands the same in-place
 * recurrence at `x + step`, `x + 2·step`, … until `detections` columns confirm it
 * in a row (any miss breaks the chain and the outer scan resumes at the next `x`).
 * Only a structure that repeats in place across several stepped columns — a genuine
 * field / striped background — passes, which is what the "no spaceships" mode wants
 * to exclude. A genuine glider leaves its column and never repeats at the same x.
 */
function hasStationarySpaceship(
  rows: Uint8Array[],
  width: number,
  height: number,
  blockWidth: number,
  blockHeight: number,
  gap: number,
  repeats: number,
  step: number,
  detections: number
): boolean {
  const y0 = height - blockHeight
  if (y0 < 1) {
    return false
  }

  // True when the column whose reference patch sits at (x, y0) recurs in place:
  // scanning UP in time it matches the same-x patch `repeats` times, each within
  // `gap` rows of the previous. Uniform columns never count.
  const columnRepeatsInPlace = (x: number): boolean => {
    if (x < 0 || x + blockWidth > width) {
      return false
    }
    if (isUniformPatch(rows, x, y0, blockWidth, blockHeight)) {
      return false
    }
    let matched = 0
    let since = 0
    for (let yy = y0 - 1; yy >= 0; yy--) {
      since += 1
      if (patchesEqual(rows, x, y0, x, yy, blockWidth, blockHeight)) {
        matched += 1
        if (matched >= repeats) {
          return true
        }
        since = 0
      } else if (since >= gap) {
        break
      }
    }
    return false
  }

  const needed = Math.max(1, detections)
  const stride = Math.max(1, step)
  for (let x = 0; x + blockWidth <= width; x++) {
    if (!columnRepeatsInPlace(x)) {
      continue
    }
    // Confirm it is a real field (not a lone stationary spaceship) by stepping
    // sideways and requiring the in-place recurrence to hold `detections` times.
    let found = 1
    for (let cx = x + stride; found < needed && cx + blockWidth <= width; cx += stride) {
      if (!columnRepeatsInPlace(cx)) {
        break
      }
      found += 1
    }
    if (found >= needed) {
      return true
    }
  }
  return false
}
