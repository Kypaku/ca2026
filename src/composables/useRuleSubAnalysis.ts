import { ref, reactive, computed } from 'vue'
import { subAnalyzeRule } from '../utils/caAnalysis'
import { codeToLocalRule, buildLocalRuleFromTotalistic, pickRandomCodes } from '../utils/caMath'
import type {
  AnalysisInitMode,
  AnalysisRuleInput,
  AnalysisSourceMode,
  RuleMode,
  RuleParts,
  RuleSnapshot,
  SubAnalyzeOptions,
  SubAnalyzeResult,
} from '../types/ca'

/** One row of sub-analysis output. */
export interface SubAnalysisResultRow extends SubAnalyzeResult {
  id: string
  name: string
  snapshot: RuleSnapshot
}

/** Parameters accepted by {@link useRuleSubAnalysis.start}. */
export interface SubAnalysisStartParams {
  stateCount: number
  mode: RuleMode
  from: number
  to: number
  init: AnalysisInitMode
  height: number
  sourceMode?: AnalysisSourceMode
  sampleCount?: number
  rules?: AnalysisRuleInput[]
  options: SubAnalyzeOptions
}

/**
 * Drives the per-rule sub-analysis. Just like the other batch analyses it can
 * draw its rules from a sequential code range, a fixed-size random sample of
 * that range, or the union of rules already carrying selected tags. Each rule
 * is run through `subAnalyzeRule`, collecting the smallest width at which the
 * pattern becomes spatially uniform. Rules are processed one per animation
 * frame so the UI stays responsive and the run can be stopped at any time.
 */
export function useRuleSubAnalysis() {
  const running = ref(false)
  const done = ref(0)
  const total = ref(0)
  const results = reactive<SubAnalysisResultRow[]>([])
  const currentName = ref('')

  let frame: number | null = null

  const progress = computed(() => (total.value ? Math.round((done.value / total.value) * 100) : 0))

  function buildParts(stateCount: number, mode: RuleMode, code: number): RuleParts {
    return mode === 'totalistic'
      ? { stateCount, mode: 'totalistic', code, localRule: '' }
      : { stateCount, mode: 'local', code: 0, localRule: codeToLocalRule(code, stateCount) }
  }

  function buildSnapshot(
    stateCount: number,
    mode: RuleMode,
    code: number,
    init: AnalysisInitMode,
    height: number
  ): RuleSnapshot {
    const localRule =
      mode === 'local' ? codeToLocalRule(code, stateCount) : buildLocalRuleFromTotalistic(code, stateCount)
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

  function start(params: SubAnalysisStartParams): void {
    if (running.value) {
      return
    }
    const { stateCount, mode, init, height, options } = params
    const from = Math.max(0, Math.floor(params.from))
    const to = Math.max(from, Math.floor(params.to))
    const ruleItems = params.sourceMode === 'tags' ? params.rules || [] : null
    const randomCodes =
      params.sourceMode === 'random' ? pickRandomCodes(from, to, params.sampleCount || 1) : null

    results.splice(0, results.length)
    done.value = 0
    currentName.value = ''
    total.value = ruleItems ? ruleItems.length : randomCodes ? randomCodes.length : to - from + 1

    if (!total.value) {
      return
    }
    running.value = true

    let index = 0
    const step = () => {
      if (!running.value) {
        return
      }
      let parts: RuleParts
      let snapshot: RuleSnapshot
      let name: string
      let id: string
      if (ruleItems) {
        const item = ruleItems[index]
        parts = item.parts
        snapshot = item.snapshot
        name = item.name || `rule ${index + 1}`
        id = `sub-tag-${index}`
      } else {
        const code = randomCodes ? randomCodes[index] : from + index
        parts = buildParts(stateCount, mode, code)
        snapshot = buildSnapshot(stateCount, mode, code, init, height)
        name = mode === 'totalistic' ? `tot. ${code}` : `loc. ${code}`
        id = `sub-code-${code}`
      }
      currentName.value = name
      const res = subAnalyzeRule(parts, options)
      results.push({ id, name, snapshot, ...res })
      done.value += 1
      index += 1
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
    results,
    currentName,
    progress,
    start,
    stop,
  }
}
