import { ref, computed } from 'vue'
import { detectLines } from '../utils/caAnalysis'
import {
  codeToLocalRule,
  buildLocalRuleFromTotalistic,
  pickRandomCodes,
  pickRandomLocalRules,
  localCodeExceedsSafeInteger,
} from '../utils/caMath'
import type {
  AnalysisInitMode,
  AnalysisRuleInput,
  AnalysisSourceMode,
  RuleMode,
  RuleParts,
  RuleSnapshot,
} from '../types/ca'

/** Callback invoked with the "no lines" verdict for each scanned rule. */
export type ApplyLines = (noLines: boolean, parts: RuleParts, snapshot: RuleSnapshot) => void

/** Parameters accepted by {@link useRuleLinesAnalysis.start}. */
export interface LinesAnalysisStartParams {
  stateCount: number
  mode: RuleMode
  from: number
  to: number
  width: number
  height: number
  init: AnalysisInitMode
  cutTop: number
  minBlock: number
  maxBlock: number
  blockStep: number
  lineCount: number
  ignoreBackground: boolean
  sourceMode?: AnalysisSourceMode
  sampleCount?: number
  rules?: AnalysisRuleInput[]
  apply: ApplyLines
}

/**
 * Drives the standalone "absence of lines" test: it scans a range of rule codes,
 * runs `detectLines` on each one and hands the *inverse* verdict (`noLines =
 * !hasLines`) to an `apply` callback, which attaches or removes the independent
 * `NoLines` tag. Kept separate from the class analysis because the tag is
 * orthogonal and may coexist with any class. The scan runs in small batches via
 * requestAnimationFrame so the UI stays responsive and can be stopped any time.
 */
export function useRuleLinesAnalysis() {
  const running = ref(false)
  const done = ref(0)
  const total = ref(0)
  const found = ref(0)
  const currentCode = ref(0)
  const currentName = ref('')

  let frame: number | null = null

  const progress = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))

  function buildParts(stateCount: number, mode: RuleMode, code: number, localRule?: string): RuleParts {
    return mode === 'totalistic'
      ? { stateCount, mode: 'totalistic', code, localRule: '' }
      : { stateCount, mode: 'local', code: 0, localRule: localRule ?? codeToLocalRule(code, stateCount) }
  }

  function buildSnapshot(
    stateCount: number,
    mode: RuleMode,
    code: number,
    init: AnalysisInitMode,
    height: number,
    localRuleOverride?: string
  ): RuleSnapshot {
    const localRule =
      mode === 'local'
        ? localRuleOverride ?? codeToLocalRule(code, stateCount)
        : buildLocalRuleFromTotalistic(code, stateCount)
    return {
      stateCount,
      mode,
      code: mode === 'totalistic' ? code : 0,
      localRule,
      init: init === 'single' ? 'single' : 'random',
      seed: '',
      height,
    }
  }

  function stop(): void {
    running.value = false
    if (frame !== null) {
      cancelAnimationFrame(frame)
      frame = null
    }
  }

  function start(params: LinesAnalysisStartParams): void {
    if (running.value) {
      return
    }
    const {
      stateCount,
      mode,
      width,
      height,
      init,
      cutTop,
      minBlock,
      maxBlock,
      blockStep,
      lineCount,
      ignoreBackground,
      apply,
    } = params
    const from = Math.max(0, Math.floor(params.from))
    const to = Math.max(from, Math.floor(params.to))
    const ruleItems = params.sourceMode === 'tags' ? params.rules || [] : null
    const randomLocalRules =
      params.sourceMode === 'random' && mode === 'local' && localCodeExceedsSafeInteger(stateCount)
        ? pickRandomLocalRules(stateCount, params.sampleCount || 1)
        : null
    const randomCodes =
      params.sourceMode === 'random' && !randomLocalRules
        ? pickRandomCodes(from, to, params.sampleCount || 1)
        : null

    done.value = 0
    found.value = 0
    currentName.value = ''
    total.value = ruleItems
      ? ruleItems.length
      : randomLocalRules
        ? randomLocalRules.length
        : randomCodes
          ? randomCodes.length
          : to - from + 1
    running.value = true

    let index = 0
    const batchSize = 25

    const step = () => {
      if (!running.value) {
        return
      }
      const batchEnd = Math.min(total.value - 1, index + batchSize - 1)
      while (index <= batchEnd) {
        let parts: RuleParts
        let snapshot: RuleSnapshot
        if (ruleItems) {
          const item = ruleItems[index]
          parts = item.parts
          snapshot = item.snapshot
          currentName.value = item.name || ''
        } else {
          const localRuleOverride = randomLocalRules ? randomLocalRules[index] : undefined
          const code = randomCodes ? randomCodes[index] : from + index
          currentCode.value = code
          parts = buildParts(stateCount, mode, code, localRuleOverride)
          snapshot = buildSnapshot(stateCount, mode, code, init, height, localRuleOverride)
        }
        const { hasLines } = detectLines(parts, {
          width,
          height,
          init,
          cutTop,
          minBlock,
          maxBlock,
          blockStep,
          lineCount,
          ignoreBackground,
        })
        const noLines = !hasLines
        if (noLines) {
          found.value += 1
        }
        apply(noLines, parts, snapshot)
        done.value += 1
        index += 1
      }
      if (index >= total.value) {
        running.value = false
        currentName.value = ''
        frame = null
        return
      }
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
  }

  return {
    running,
    done,
    total,
    found,
    currentCode,
    currentName,
    progress,
    start,
    stop,
  }
}
