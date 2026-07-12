// "Convert to patterns" view helper: tiles the rendered diagram into M×M blocks,
// assigns each distinct block pattern a unique colour and returns the reduced map.
import type { PatternEntry, PatternMap, PatternPalette } from '../../types/ca'

/**
 * Derives a visually distinct colour for pattern `index` by walking the hue
 * circle with the golden angle, so neighbouring indices never land on
 * adjacent hues. Saturation/lightness are kept muted (soft, low-contrast
 * pastel tones) for a calmer, easier-on-the-eyes palette regardless of how
 * many patterns exist. In `grayscale` mode the hue is dropped and a spread
 * of lightness levels (also walked with the golden ratio) is used instead.
 */
function patternColor(index: number, palette: PatternPalette = 'color'): string {
  if (palette === 'grayscale') {
    const frac = (index * 0.6180339887498949) % 1
    const lightness = 12 + frac * 76 // spread across 12%-88%
    return `hsl(0, 0%, ${lightness.toFixed(1)}%)`
  }
  const hue = (index * 137.508) % 360
  return `hsl(${hue.toFixed(1)}, 45%, 65%)`
}

export function buildPatternMap(
  rows: Uint8Array[],
  states: number,
  blockSize: number,
  palette: PatternPalette = 'color',
): PatternMap {
  const M = Math.max(1, Math.floor(blockSize))
  const height = rows.length
  const width = height > 0 ? rows[0].length : 0
  const cols = Math.floor(width / M)
  const blockRows = Math.floor(height / M)
  const cellIndex = new Int32Array(cols * blockRows)

  const map = new Map<string, PatternEntry>()
  const patterns: PatternEntry[] = []
  const scratch = new Array<number>(M * M)

  for (let by = 0; by < blockRows; by++) {
    const y0 = by * M
    for (let bx = 0; bx < cols; bx++) {
      const x0 = bx * M
      let idx = 0
      for (let y = 0; y < M; y++) {
        const rowData = rows[y0 + y]
        for (let x = 0; x < M; x++) {
          scratch[idx++] = rowData[x0 + x]
        }
      }
      const key = String.fromCharCode.apply(null, scratch)
      let entry = map.get(key)
      if (!entry) {
        const cells = new Uint8Array(M * M)
        for (let i = 0; i < cells.length; i++) {
          cells[i] = scratch[i]
        }
        entry = { cells, color: '', count: 0, index: patterns.length }
        map.set(key, entry)
        patterns.push(entry)
      }
      entry.count += 1
      cellIndex[by * cols + bx] = entry.index
    }
  }

  // Sort by descending frequency (ties broken by original order) so the most
  // common patterns get the first, most saturated palette slots, then remap the
  // pixel indices onto the new ordering.
  const sorted = patterns.slice().sort((a, b) => b.count - a.count || a.index - b.index)
  const remap = new Int32Array(patterns.length)
  for (let newIdx = 0; newIdx < sorted.length; newIdx++) {
    const entry = sorted[newIdx]
    remap[entry.index] = newIdx
    entry.index = newIdx
    entry.color = patternColor(newIdx, palette)
  }
  for (let i = 0; i < cellIndex.length; i++) {
    cellIndex[i] = remap[cellIndex[i]]
  }

  return { blockSize: M, cols, rows: blockRows, states, cellIndex, patterns: sorted }
}
