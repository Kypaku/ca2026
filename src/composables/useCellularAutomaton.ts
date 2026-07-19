import { ref, reactive, computed, shallowRef } from 'vue'
import type { Ref } from 'vue'
import { CA_WIDTH, CA_PIXEL_SIZE, CA_COLORS } from '../constants/ca'
import {
  getConfig,
  sanitizeStateString,
  padRight,
  totalisticTable,
  toBaseN,
  buildLocalRuleFromTotalistic,
  localRuleToCode,
  codeToLocalRule,
  normalizeStateCount,
  localCodeExceedsSafeInteger,
  cycleLocalRuleDigit,
  cycleTotalisticDigit,
} from '../utils/caMath'
import { buildInitialRow, extendDiagram, renderDiagram } from '../utils/caRender'
import type { RenderContext } from '../utils/caLargeRender'
import type { CaConfig, InitMode, LegendItem, RuleMode, RuleSnapshot } from '../types/ca'

/** Reads the current value out of an input `Event` target. */
function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

/**
 * Encapsulates all state and behaviour of the 2-5 state cellular
 * automaton explorer: rule selection (totalistic or local), initial
 * conditions, canvas rendering and the derived UI text/legend data.
 */
export function useCellularAutomaton() {
  const canvasRef = ref<HTMLCanvasElement | null>(null)

  const H = ref(110)
  const W = ref(CA_WIDTH)
  const mode = ref<RuleMode>('local') // 'totalistic' | 'local'
  const stateCount = ref(2) // 2 | 3 | 4 | 5
  const init = ref<InitMode>('random') // 'single' | 'random' | 'custom'
  const noise = ref(0) // 0-100, % of cells on each step get a random value against the rule
  const extraRows = ref(50) // how many more generations "continue simulation" adds

  const totalisticCodes = reactive<Record<number, number>>({ 2: 6, 3: 1155, 4: 0, 5: 0 })
  const localRules = reactive<Record<number, string>>({ 2: '', 3: '', 4: '', 5: '' })
  const localRuleDirty = reactive<Record<number, boolean>>({ 2: false, 3: false, 4: false, 5: false })
  const seedValues = reactive<Record<number, string>>({ 2: '', 3: '', 4: '', 5: '' })

  const ruleInputValue = ref('')
  const seedInputValue = ref('')
  const codeValue = ref(1155)

  const sliderLabelText = ref('')
  const codeMax = ref(2186)
  const ruleLabelText = ref('')
  const ruleStatusText = ref('')
  const seedLabelText = ref('')
  const seedStatusText = ref('')
  const legendItems: Ref<LegendItem[]> = ref([])
  const keyText = ref('neighbor sum map -> new state')

  // Last rendered space-time diagram (H rows × W cells), kept so the "convert to
  // patterns" view can reduce exactly what is on screen without re-evolving.
  const grid = shallowRef<Uint8Array[]>([])

  // The numeric rule code is only meaningful while it fits in a JS double.
  // For local rules with 4+ states the code space (states^(states^3)) overflows
  // that precision, so the code slider/input would show a bogus float in
  // scientific notation — hide it and let the rule string input be the editor.
  const showCodeControl = computed(() => !(mode.value === 'local' && localCodeExceedsSafeInteger(stateCount.value)))

  const heightStatusText = computed(() => `${H.value} rows`)
  const widthStatusText = computed(() => `${W.value} cells per row`)
  const noiseStatusText = computed(() =>
    noise.value > 0
      ? `${noise.value}% of cells on each step get a random value against the rule`
      : 'the rule is applied with no random deviations'
  )
  const seedPlaceholder = computed(() => {
    if (stateCount.value === 2) {
      return 'e.g. 00011100101'
    }
    let sample = ''
    for (let digit = 0; digit < stateCount.value; digit++) {
      sample += String(digit).repeat(2)
    }
    return `e.g. ${sample}0`
  })

  function activeConfig(): CaConfig {
    return getConfig(stateCount.value)
  }

  function currentLocalRule(): string {
    const config = activeConfig()
    return padRight(sanitizeStateString(ruleInputValue.value, config.localDigits, stateCount.value), config.localDigits)
  }

  function activeCodeMax(): number {
    const config = activeConfig()
    return mode.value === 'totalistic' ? config.totalisticMax : Math.pow(config.states, config.localDigits) - 1
  }

  function activeCodeValue(): number {
    return mode.value === 'totalistic'
      ? totalisticCodes[stateCount.value]
      : localRuleToCode(currentLocalRule(), stateCount.value)
  }

  function setActiveCode(value: number): void {
    const nextValue = Math.max(0, Math.min(activeCodeMax(), Math.floor(value)))
    if (mode.value === 'totalistic') {
      totalisticCodes[stateCount.value] = nextValue
      syncLocalRule(false)
      return
    }
    localRules[stateCount.value] = codeToLocalRule(nextValue, stateCount.value)
    localRuleDirty[stateCount.value] = true
    ruleInputValue.value = localRules[stateCount.value]
  }

  function clampHeight(value: number): number {
    return Math.max(40, value)
  }

  function clampWidth(value: number): number {
    return Math.max(11, value)
  }

  function clampNoise(value: number): number {
    return Math.max(0, Math.min(1, value))
  }

  function setNoise(value: number): void {
    if (isNaN(value)) {
      return
    }
    noise.value = clampNoise(value)
  }

  function setHeight(value: number): void {
    if (isNaN(value)) {
      return
    }
    H.value = clampHeight(value)
  }

  function setWidth(value: number): void {
    if (isNaN(value)) {
      return
    }
    W.value = clampWidth(value)
  }

  function storeCurrentRule(): void {
    localRules[stateCount.value] = sanitizeStateString(ruleInputValue.value, activeConfig().localDigits, stateCount.value)
  }

  function storeCurrentSeed(): void {
    seedValues[stateCount.value] = sanitizeStateString(seedInputValue.value, W.value, stateCount.value)
  }

  function syncLocalRule(force: boolean): void {
    if (force || !localRuleDirty[stateCount.value]) {
      localRules[stateCount.value] = buildLocalRuleFromTotalistic(totalisticCodes[stateCount.value], stateCount.value)
    }
    ruleInputValue.value = localRules[stateCount.value]
    updateRuleStatus()
  }

  function updateRuleStatus(): void {
    const config = activeConfig()
    const clean = sanitizeStateString(ruleInputValue.value, config.localDigits, stateCount.value)
    if (ruleInputValue.value !== clean) {
      ruleInputValue.value = clean
    }
    localRules[stateCount.value] = clean
    ruleLabelText.value =
      'Local rule: ' +
      config.localDigits +
      ' digits from 0 to ' +
      config.maxDigit +
      ' in order ' +
      toBaseN(0, 3, config.states) +
      '..' +
      toBaseN(config.localDigits - 1, 3, config.states)
    ruleStatusText.value =
      clean.length === config.localDigits
        ? `${config.localDigits}/${config.localDigits} positions filled`
        : `${clean.length}/${config.localDigits} positions, the rest are treated as 0`
  }

  function updateSeedStatus(): void {
    const config = activeConfig()
    const clean = sanitizeStateString(seedInputValue.value, W.value, stateCount.value)
    if (seedInputValue.value !== clean) {
      seedInputValue.value = clean
    }
    seedValues[stateCount.value] = clean
    seedLabelText.value = `Initial row: digits 0-${config.maxDigit}, the row is centered`
    seedStatusText.value = clean.length
      ? `${clean.length}/${W.value} cells, the row will be centered`
      : 'if left empty, "custom field" mode will use a single central cell'
  }

  function updateStateUI(): void {
    const config = activeConfig()
    codeMax.value = activeCodeMax()
    sliderLabelText.value =
      mode.value === 'totalistic'
        ? `Code totalistic (0-${config.totalisticMax})`
        : `Local rule code (0-${codeMax.value})`
  }

  function drawLegend(): void {
    const config = activeConfig()
    const items: LegendItem[] = []
    if (mode.value === 'totalistic') {
      keyText.value = 'neighbor sum map -> new state'
      const sums = totalisticTable(totalisticCodes[stateCount.value], stateCount.value)
      for (let sum = 0; sum < config.totalisticDigits; sum++) {
        items.push({ color: CA_COLORS[sums[sum]], caption: `S=${sum}` })
      }
    } else {
      keyText.value = 'local left-center-right map -> new state'
      const rule = currentLocalRule()
      for (let index = 0; index < config.localDigits; index++) {
        items.push({
          color: CA_COLORS[rule.charCodeAt(index) - 48],
          caption: `${toBaseN(index, 3, config.states)}->${rule.charAt(index)}`,
        })
      }
    }
    legendItems.value = items
  }

  function buildInitialRowForState(): Uint8Array {
    return buildInitialRow(W.value, activeConfig(), stateCount.value, init.value, seedInputValue.value)
  }

  function run(): void {
    const canvas = canvasRef.value
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    canvas.width = W.value * CA_PIXEL_SIZE
    canvas.height = H.value * CA_PIXEL_SIZE
    const config = activeConfig()
    const sums = mode.value === 'totalistic' ? totalisticTable(totalisticCodes[stateCount.value], stateCount.value) : null
    const explicitRule = mode.value === 'local' ? currentLocalRule() : ''

    grid.value = renderDiagram({
      ctx,
      width: W.value,
      height: H.value,
      config,
      mode: mode.value,
      sums,
      explicitRule,
      noiseP: noise.value / 100,
      initialRow: buildInitialRowForState(),
    })
  }

  function clampExtraRows(value: number): number {
    return Math.max(1, Math.min(5000, value))
  }

  function setExtraRows(value: number): void {
    if (isNaN(value)) {
      return
    }
    extraRows.value = clampExtraRows(value)
  }

  function onExtraRowsInput(event: Event): void {
    const raw = inputValue(event)
    if (raw === '') {
      return
    }
    const nextValue = parseInt(raw, 10)
    if (isNaN(nextValue)) {
      return
    }
    setExtraRows(nextValue)
  }

  /**
   * Continues the current diagram past its last generation instead of
   * re-simulating from the initial row: keeps every already-rendered row and
   * evolves `extraRows` more generations on top of the last one, growing the
   * canvas and `H` to fit. No-op fallback to a full `run()` if nothing has
   * been rendered yet.
   */
  function continueSimulation(): void {
    const canvas = canvasRef.value
    if (!canvas || grid.value.length === 0) {
      run()
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }
    const addRows = clampExtraRows(extraRows.value)
    const config = activeConfig()
    const sums = mode.value === 'totalistic' ? totalisticTable(totalisticCodes[stateCount.value], stateCount.value) : null
    const explicitRule = mode.value === 'local' ? currentLocalRule() : ''

    const newHeight = grid.value.length + addRows
    canvas.width = W.value * CA_PIXEL_SIZE
    canvas.height = newHeight * CA_PIXEL_SIZE

    grid.value = extendDiagram({
      ctx,
      width: W.value,
      config,
      mode: mode.value,
      sums,
      explicitRule,
      noiseP: noise.value / 100,
      previousRows: grid.value,
      extraRows: addRows,
    })
    H.value = newHeight
  }

  function refresh(): void {
    updateStateUI()
    updateRuleStatus()
    codeValue.value = activeCodeValue()
    updateSeedStatus()
    drawLegend()
    run()
  }

  function onCodeSliderInput(event: Event): void {
    setActiveCode(parseInt(inputValue(event), 10))
    refresh()
  }

  function onCodeNumberInput(event: Event): void {
    const raw = inputValue(event)
    if (raw === '') {
      return
    }
    const nextValue = parseInt(raw, 10)
    if (isNaN(nextValue)) {
      return
    }
    setActiveCode(nextValue)
    refresh()
  }

  function onHeightSliderInput(event: Event): void {
    setHeight(parseInt(inputValue(event), 10))
    run()
  }

  function onHeightNumberInput(event: Event): void {
    const raw = inputValue(event)
    if (raw === '') {
      return
    }
    setHeight(parseInt(raw, 10))
    run()
  }

  function onWidthSliderInput(event: Event): void {
    setWidth(parseInt(inputValue(event), 10))
    run()
  }

  function onWidthNumberInput(event: Event): void {
    const raw = inputValue(event)
    if (raw === '') {
      return
    }
    setWidth(parseInt(raw, 10))
    run()
  }

  function onNoiseSliderInput(event: Event): void {
    setNoise(parseFloat(inputValue(event)))
    run()
  }

  function onNoiseNumberInput(event: Event): void {
    const raw = inputValue(event)
    if (raw === '') {
      return
    }
    setNoise(parseFloat(raw))
    run()
  }

  function onNoisePreset(value: number): void {
    setNoise(value)
    run()
  }

  function onRuleInput(event: Event): void {
    ruleInputValue.value = inputValue(event)
    localRuleDirty[stateCount.value] = true
    storeCurrentRule()
    updateRuleStatus()
    if (mode.value !== 'local') {
      setMode('local')
      return
    }
    refresh()
  }

  function onSeedInput(event: Event): void {
    seedInputValue.value = inputValue(event)
    storeCurrentSeed()
    updateSeedStatus()
    init.value = 'custom'
    run()
  }

  /**
   * Clicking a legend square steps that cell's output value to the next
   * state (wrapping back to 0): the neighbor-sum output in totalistic mode,
   * or the local rule digit at that neighborhood index in local mode.
   */
  function onLegendCellClick(index: number): void {
    if (mode.value === 'totalistic') {
      totalisticCodes[stateCount.value] = cycleTotalisticDigit(totalisticCodes[stateCount.value], stateCount.value, index)
      syncLocalRule(false)
    } else {
      const nextRule = cycleLocalRuleDigit(currentLocalRule(), stateCount.value, index)
      ruleInputValue.value = nextRule
      localRules[stateCount.value] = nextRule
      localRuleDirty[stateCount.value] = true
      updateRuleStatus()
    }
    refresh()
  }

  function onRandomRule(): void {
    const config = activeConfig()
    if (mode.value === 'totalistic') {
      totalisticCodes[stateCount.value] = Math.floor(Math.random() * (config.totalisticMax + 1))
      syncLocalRule(false)
    } else {
      let randomRule = ''
      for (let i = 0; i < config.localDigits; i++) {
        randomRule += String(Math.floor(Math.random() * config.states))
      }
      ruleInputValue.value = randomRule
      localRules[stateCount.value] = randomRule
      localRuleDirty[stateCount.value] = true
      updateRuleStatus()
    }
    refresh()
  }

  function setInit(nextInit: InitMode): void {
    init.value = nextInit
    run()
  }

  function setMode(nextMode: RuleMode): void {
    mode.value = nextMode
    refresh()
  }

  function setStateCount(nextCount: number): void {
    if (nextCount === stateCount.value) {
      return
    }
    storeCurrentRule()
    storeCurrentSeed()
    stateCount.value = nextCount
    ruleInputValue.value = localRules[nextCount]
    seedInputValue.value = seedValues[nextCount]
    syncLocalRule(false)
    refresh()
  }

  function init3AndRefresh(): void {
    ;[2, 3, 4, 5].forEach((count) => {
      localRules[count] = buildLocalRuleFromTotalistic(totalisticCodes[count], count)
    })
    ruleInputValue.value = localRules[stateCount.value]
    refresh()
  }

  /** Captures everything needed to reproduce the current rule/init/height later. */
  function captureRuleSnapshot(): RuleSnapshot {    storeCurrentRule()
    storeCurrentSeed()
    return {
      stateCount: stateCount.value,
      mode: mode.value,
      code: totalisticCodes[stateCount.value],
      localRule: localRules[stateCount.value],
      init: init.value,
      seed: seedValues[stateCount.value],
      height: H.value,
      width: W.value,
      noise: noise.value,
    }
  }

  /**
   * Restores a snapshot produced by `captureRuleSnapshot`, applying only the
   * rule-defining fields (state count, mode, code/local rule). Current
   * settings (init, seed, height, width, noise) are left untouched so they
   * persist across rule changes.
   */
  function applyRuleSnapshot(snapshot: RuleSnapshot | null | undefined): void {
    if (!snapshot) {
      return
    }
    const nextStateCount = normalizeStateCount(snapshot.stateCount)
    if (nextStateCount !== stateCount.value) {
      storeCurrentRule()
      storeCurrentSeed()
    }
    stateCount.value = nextStateCount
    totalisticCodes[nextStateCount] = snapshot.code || 0
    localRules[nextStateCount] =
      snapshot.localRule || buildLocalRuleFromTotalistic(totalisticCodes[nextStateCount], nextStateCount)
    localRuleDirty[nextStateCount] = true
    seedInputValue.value = seedValues[nextStateCount]
    ruleInputValue.value = localRules[nextStateCount]
    mode.value = snapshot.mode === 'local' ? 'local' : 'totalistic'
    refresh()
  }

  /**
   * Bundles the immutable inputs needed to render the current rule at any
   * width/height off-screen (used by the large-scale image renderer). The
   * rule/mode/noise reflect the current UI state; the initial row is rebuilt
   * for the requested width so the export can use dimensions that differ from
   * the on-screen diagram without touching the interactive canvas.
   */
  function getRenderContext(): RenderContext {
    const config = activeConfig()
    const sums =
      mode.value === 'totalistic' ? totalisticTable(totalisticCodes[stateCount.value], stateCount.value) : null
    const explicitRule = mode.value === 'local' ? currentLocalRule() : ''
    return {
      config,
      mode: mode.value,
      sums,
      explicitRule,
      noiseP: noise.value / 100,
      makeInitialRow: (width: number) =>
        buildInitialRow(width, config, stateCount.value, init.value, seedInputValue.value),
    }
  }

  return {
    // constants re-exported for template use
    COL: CA_COLORS,
    // dom ref
    canvasRef,
    // state
    H,
    W,
    mode,
    stateCount,
    init,
    noise,
    extraRows,
    codeValue,
    codeMax,
    showCodeControl,
    sliderLabelText,
    ruleInputValue,
    ruleLabelText,
    ruleStatusText,
    seedInputValue,
    seedLabelText,
    seedStatusText,
    seedPlaceholder,
    heightStatusText,
    widthStatusText,
    noiseStatusText,
    legendItems,
    keyText,
    grid,
    // actions
    run,
    refresh,
    continueSimulation,
    onExtraRowsInput,
    setInit,
    setMode,
    setStateCount,
    onCodeSliderInput,
    onCodeNumberInput,
    onHeightSliderInput,
    onHeightNumberInput,
    onWidthSliderInput,
    onWidthNumberInput,
    onNoiseSliderInput,
    onNoiseNumberInput,
    onNoisePreset,
    onRuleInput,
    onSeedInput,
    onRandomRule,
    onLegendCellClick,
    initialize: init3AndRefresh,
    captureRuleSnapshot,
    applyRuleSnapshot,
    getRenderContext,
  }
}
