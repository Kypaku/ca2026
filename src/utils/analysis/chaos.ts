// "Chaos" test: reduces the space-time diagram to an M×M pattern
// map (exactly like the "convert to patterns" view, default M = 5) and looks at
// how the block patterns are distributed. In a genuinely chaotic rule (e.g. rule
// 30) almost every 5×5 block is unique, so the single most frequent ("dominant")
// pattern stays small and does not stick out of the distribution. In a rule with
// a dominant repeating background (e.g. rule 110's ether) that background tiles
// the field, so its pattern occupies a large share of all blocks and clearly
// sticks out. The rule is deemed chaotic when the top pattern's share of all
// blocks does not exceed `maxDominant`.
import type { AnalysisInitMode, ChaosOptions, ChaosResult, RuleParts } from '../../types/ca'
import { evolveRows } from './evolve'
import { buildPatternMap } from './patternMap'

export function detectChaos(parts: RuleParts, options: ChaosOptions): ChaosResult {
  const width = Math.max(2, Math.floor(options.width))
  const height = Math.max(1, Math.floor(options.height))
  const init: AnalysisInitMode = options.init === 'single' ? 'single' : 'random'
  const cutFraction = Math.max(0, Math.min(90, Number(options.cutTop))) / 100
  const blockSize = Math.max(1, Math.floor(options.blockSize))
  const maxDominant = Math.max(0, Math.min(100, Number(options.maxDominant))) / 100

  const { rows, states } = evolveRows(parts, { width, height, keep: height, init })

  // Drop the transient top so the settled behaviour drives the verdict.
  const startRow = Math.min(height - 1, Math.floor(height * cutFraction))
  const kept = rows.slice(startRow)

  // buildPatternMap tiles the kept field into blockSize×blockSize patterns and
  // returns them sorted by descending frequency, so patterns[0] is the "dominant" one.
  const map = buildPatternMap(kept, states, blockSize)
  const totalBlocks = map.cols * map.rows
  const distinctPatterns = map.patterns.length

  if (totalBlocks <= 0 || distinctPatterns === 0) {
    return {
      isChaotic: false,
      dominantFraction: 0,
      dominantCount: 0,
      meanCount: 0,
      distinctPatterns: 0,
      totalBlocks: 0,
    }
  }

  const dominantCount = map.patterns[0].count
  const dominantFraction = dominantCount / totalBlocks
  const meanCount = totalBlocks / distinctPatterns
  // Chaotic ⇔ the top pattern does not stick out of the distribution, i.e. it
  // covers no more than maxDominant of all blocks. A dominant background pushes
  // dominantFraction up (uniform/dead fields → ~1) and fails the test.
  const isChaotic = dominantFraction <= maxDominant

  return { isChaotic, dominantFraction, dominantCount, meanCount, distinctPatterns, totalBlocks }
}
