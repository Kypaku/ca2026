<script setup lang="ts">
import { computed, onMounted } from 'vue'
import '../assets/cellular-automaton.css'
import { useCellularAutomaton } from '../composables/useCellularAutomaton'
import { useRuleTags } from '../composables/useRuleTags'
import { useRuleAnalysis } from '../composables/useRuleAnalysis'
import { useRuleFieldsAnalysis } from '../composables/useRuleFieldsAnalysis'
import { useRuleGlidersAnalysis } from '../composables/useRuleGlidersAnalysis'
import { useRuleCustomSearchAnalysis } from '../composables/useRuleCustomSearchAnalysis'
import { useRuleLinesAnalysis } from '../composables/useRuleLinesAnalysis'
import { useRuleChaosAnalysis } from '../composables/useRuleChaosAnalysis'
import { useRuleSubAnalysis } from '../composables/useRuleSubAnalysis'
import { FIELDS_TAG, GLIDERS_TAG, CUSTOM_SEARCH_TAG, LINES_TAG, CHAOS_TAG } from '../constants/ca'
import type {
  AnalysisInitMode,
  AnalysisRuleInput,
  AnalysisSourceMode,
  CustomPattern,
  GliderCondition,
  RuleParts,
  RuleSnapshot,
  SubAnalyzeOptions,
} from '../types/ca'
import { partsFromSnapshot } from '../utils/caMath'
import RuleControls from './ca/RuleControls.vue'
import InitControls from './ca/InitControls.vue'
import LegendPanel from './ca/LegendPanel.vue'
import ViewPanel from './ca/ViewPanel.vue'
import TagsPanel from './ca/TagsPanel.vue'
import AnalysisPanel from './ca/AnalysisPanel.vue'
import FieldsAnalysisPanel from './ca/FieldsAnalysisPanel.vue'
import GlidersAnalysisPanel from './ca/GlidersAnalysisPanel.vue'
import CustomSearchPanel from './ca/CustomSearchPanel.vue'
import LinesAnalysisPanel from './ca/LinesAnalysisPanel.vue'
import ChaosAnalysisPanel from './ca/ChaosAnalysisPanel.vue'
import SubAnalysisPanel from './ca/SubAnalysisPanel.vue'

const {
  COL,
  canvasRef,
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
  initialize,
  captureRuleSnapshot,
  applyRuleSnapshot,
} = useCellularAutomaton()

const {
  tags,
  rules,
  activeTag,
  activeIndex,
  rulesForActiveTag,
  navStatusText,
  tagCounts,
  addTag,
  renameTag,
  deleteTag,
  closeBrowse,
  selectTag,
  tagsForRule,
  toggleTagOnRule,
  deleteRule,
  next: nextTaggedRule,
  prev: prevTaggedRule,
  jumpTo,
  exportToFile,
  importFromFile,
  activeRule,
  applyAnalysisTag,
  applyFieldsTag,
  applyGlidersTag,
  applyCustomSearchTag,
  applyLinesTag,
  applyChaosTag,
} = useRuleTags()

const {
  running: analysisRunning,
  done: analysisDone,
  total: analysisTotal,
  progress: analysisProgress,
  currentCode: analysisCurrentCode,
  counts: analysisCounts,
  start: startAnalysis,
  stop: stopAnalysis,
} = useRuleAnalysis()

const {
  running: fieldsRunning,
  done: fieldsDone,
  total: fieldsTotal,
  progress: fieldsProgress,
  currentCode: fieldsCurrentCode,
  found: fieldsFound,
  start: startFieldsAnalysis,
  stop: stopFieldsAnalysis,
} = useRuleFieldsAnalysis()

const {
  running: glidersRunning,
  done: glidersDone,
  total: glidersTotal,
  progress: glidersProgress,
  currentCode: glidersCurrentCode,
  found: glidersFound,
  start: startGlidersAnalysis,
  stop: stopGlidersAnalysis,
} = useRuleGlidersAnalysis()

const {
  running: customRunning,
  done: customDone,
  total: customTotal,
  progress: customProgress,
  currentCode: customCurrentCode,
  found: customFound,
  start: startCustomSearch,
  stop: stopCustomSearch,
} = useRuleCustomSearchAnalysis()

const {
  running: linesRunning,
  done: linesDone,
  total: linesTotal,
  progress: linesProgress,
  currentCode: linesCurrentCode,
  found: linesFound,
  start: startLinesAnalysis,
  stop: stopLinesAnalysis,
} = useRuleLinesAnalysis()

const {
  running: chaosRunning,
  done: chaosDone,
  total: chaosTotal,
  progress: chaosProgress,
  currentCode: chaosCurrentCode,
  found: chaosFound,
  start: startChaosAnalysis,
  stop: stopChaosAnalysis,
} = useRuleChaosAnalysis()

const {
  running: subRunning,
  done: subDone,
  total: subTotal,
  progress: subProgress,
  currentName: subCurrentName,
  results: subResults,
  start: startSubAnalysis,
  stop: stopSubAnalysis,
} = useRuleSubAnalysis()

onMounted(initialize)

/** Fields that identify "the same rule" for tagging, independent of init/seed/height. */
function currentRuleParts(): RuleParts {
  return mode.value === 'totalistic'
    ? { stateCount: stateCount.value, mode: 'totalistic', code: codeValue.value, localRule: '' }
    : { stateCount: stateCount.value, mode: 'local', code: 0, localRule: ruleInputValue.value }
}

const currentRuleTags = computed(() => tagsForRule(currentRuleParts()))

function loadActiveTaggedRule(): void {
  if (activeRule.value) {
    applyRuleSnapshot(activeRule.value.snapshot)
  }
}

function onToggleTag(tagName: string): void {
  toggleTagOnRule(tagName, currentRuleParts(), captureRuleSnapshot())
}

function onBrowseTag(tagName: string): void {
  selectTag(tagName)
}

function onNextTaggedRule(): void {
  nextTaggedRule()
  loadActiveTaggedRule()
}

function onPrevTaggedRule(): void {
  prevTaggedRule()
  loadActiveTaggedRule()
}

function onJumpToTaggedRule(index: number): void {
  jumpTo(index)
  loadActiveTaggedRule()
}

function onImportFile(file: File): void {
  importFromFile(file)
}

/** Resolves the union of saved rules carrying any of the given tags into
 * classifier-ready inputs (parts + snapshot + display name). */
function rulesForTags(tagNames: string[]): AnalysisRuleInput[] {
  const selected = new Set(tagNames)
  if (!selected.size) {
    return []
  }
  return rules
    .filter((rule) => Array.isArray(rule.tags) && rule.tags.some((t) => selected.has(t)))
    .map((rule) => ({
      parts: partsFromSnapshot(rule.snapshot),
      snapshot: rule.snapshot,
      name: rule.name,
    }))
}

interface RunAnalysisPayload {
  from: number
  to: number
  width: number
  height: number
  init: AnalysisInitMode
  chaosFlux: number
  sparseFill: number
  windowFraction: number
  sourceMode: AnalysisSourceMode
  sampleCount: number
  tags: string[]
}

function onRunAnalysis({
  from,
  to,
  width,
  height,
  init: analysisInit,
  chaosFlux,
  sparseFill,
  windowFraction,
  sourceMode,
  sampleCount,
  tags: selectedTags,
}: RunAnalysisPayload): void {
  startAnalysis({
    stateCount: stateCount.value,
    mode: mode.value,
    from,
    to,
    width,
    height,
    init: analysisInit,
    chaosFlux,
    sparseFill,
    windowFraction,
    sourceMode,
    sampleCount,
    rules: sourceMode === 'tags' ? rulesForTags(selectedTags) : undefined,
    apply: applyAnalysisTag,
  })
}

interface RunFieldsAnalysisPayload {
  from: number
  to: number
  width: number
  height: number
  init: AnalysisInitMode
  blockWidth: number
  blockHeight: number
  minPercent: number
  sourceMode: AnalysisSourceMode
  sampleCount: number
  tags: string[]
}

function onRunFieldsAnalysis({
  from,
  to,
  width,
  height,
  init: fieldsInit,
  blockWidth,
  blockHeight,
  minPercent,
  sourceMode,
  sampleCount,
  tags: selectedTags,
}: RunFieldsAnalysisPayload): void {
  startFieldsAnalysis({
    stateCount: stateCount.value,
    mode: mode.value,
    from,
    to,
    width,
    height,
    init: fieldsInit,
    blockWidth,
    blockHeight,
    minPercent,
    sourceMode,
    sampleCount,
    rules: sourceMode === 'tags' ? rulesForTags(selectedTags) : undefined,
    apply: applyFieldsTag,
  })
}

interface RunGlidersAnalysisPayload {
  from: number
  to: number
  width: number
  height: number
  init: AnalysisInitMode
  blockWidth: number
  blockHeight: number
  maxPeriods: number
  minShift: number
  minMatches: number
  backgroundMin: number
  spaceshipRepeats: number
  spaceshipGap: number
  spaceshipStep: number
  spaceshipDetections: number
  condition: GliderCondition
  sourceMode: AnalysisSourceMode
  sampleCount: number
  tags: string[]
}

function onRunGlidersAnalysis({
  from,
  to,
  width,
  height,
  init: glidersInit,
  blockWidth,
  blockHeight,
  maxPeriods,
  minShift,
  minMatches,
  backgroundMin,
  spaceshipRepeats,
  spaceshipGap,
  spaceshipStep,
  spaceshipDetections,
  condition,
  sourceMode,
  sampleCount,
  tags: selectedTags,
}: RunGlidersAnalysisPayload): void {
  startGlidersAnalysis({
    stateCount: stateCount.value,
    mode: mode.value,
    from,
    to,
    width,
    height,
    init: glidersInit,
    blockWidth,
    blockHeight,
    maxPeriods,
    minShift,
    minMatches,
    backgroundMin,
    spaceshipRepeats,
    spaceshipGap,
    spaceshipStep,
    spaceshipDetections,
    condition,
    sourceMode,
    sampleCount,
    rules: sourceMode === 'tags' ? rulesForTags(selectedTags) : undefined,
    apply: applyGlidersTag,
  })
}

interface RunCustomSearchPayload {
  from: number
  to: number
  width: number
  height: number
  init: AnalysisInitMode
  negativePatterns: CustomPattern[]
  sourceMode: AnalysisSourceMode
  sampleCount: number
  tags: string[]
}

function onRunCustomSearch({
  from,
  to,
  width,
  height,
  init: customInit,
  negativePatterns,
  sourceMode,
  sampleCount,
  tags: selectedTags,
}: RunCustomSearchPayload): void {
  startCustomSearch({
    stateCount: stateCount.value,
    mode: mode.value,
    from,
    to,
    width,
    height,
    init: customInit,
    negativePatterns,
    sourceMode,
    sampleCount,
    rules: sourceMode === 'tags' ? rulesForTags(selectedTags) : undefined,
    apply: applyCustomSearchTag,
  })
}

interface RunLinesAnalysisPayload {
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
  sourceMode: AnalysisSourceMode
  sampleCount: number
  tags: string[]
}

function onRunLinesAnalysis({
  from,
  to,
  width,
  height,
  init: linesInit,
  cutTop,
  minBlock,
  maxBlock,
  blockStep,
  lineCount,
  ignoreBackground,
  sourceMode,
  sampleCount,
  tags: selectedTags,
}: RunLinesAnalysisPayload): void {
  startLinesAnalysis({
    stateCount: stateCount.value,
    mode: mode.value,
    from,
    to,
    width,
    height,
    init: linesInit,
    cutTop,
    minBlock,
    maxBlock,
    blockStep,
    lineCount,
    ignoreBackground,
    sourceMode,
    sampleCount,
    rules: sourceMode === 'tags' ? rulesForTags(selectedTags) : undefined,
    apply: applyLinesTag,
  })
}

interface RunChaosAnalysisPayload {
  from: number
  to: number
  width: number
  height: number
  init: AnalysisInitMode
  cutTop: number
  blockSize: number
  maxDominant: number
  sourceMode: AnalysisSourceMode
  sampleCount: number
  tags: string[]
}

function onRunChaosAnalysis({
  from,
  to,
  width,
  height,
  init: chaosInit,
  cutTop,
  blockSize,
  maxDominant,
  sourceMode,
  sampleCount,
  tags: selectedTags,
}: RunChaosAnalysisPayload): void {
  startChaosAnalysis({
    stateCount: stateCount.value,
    mode: mode.value,
    from,
    to,
    width,
    height,
    init: chaosInit,
    cutTop,
    blockSize,
    maxDominant,
    sourceMode,
    sampleCount,
    rules: sourceMode === 'tags' ? rulesForTags(selectedTags) : undefined,
    apply: applyChaosTag,
  })
}

interface RunSubAnalysisPayload {
  sourceMode: AnalysisSourceMode
  from: number
  to: number
  sampleCount: number
  tags: string[]
  init: AnalysisInitMode
  height: number
  options: SubAnalyzeOptions
}

function onRunSubAnalysis({
  sourceMode,
  from,
  to,
  sampleCount,
  tags: selectedTags,
  init: subInit,
  height,
  options,
}: RunSubAnalysisPayload): void {
  startSubAnalysis({
    stateCount: stateCount.value,
    mode: mode.value,
    sourceMode,
    from,
    to,
    sampleCount,
    init: subInit,
    height,
    rules: sourceMode === 'tags' ? rulesForTags(selectedTags) : undefined,
    options,
  })
}

function onSelectSubRule(snapshot: RuleSnapshot): void {
  applyRuleSnapshot(snapshot)
}
</script>

<template>
  <div class="ca-wrap">
    <h2 class="sr-only">One-dimensional cellular automaton simulator with 2-5 states, totalistic and local rules</h2>

    <div class="ca-layout">
    <div class="ca-main">
    <div class="ca-row">

      <RuleControls
        :state-count="stateCount"
        :mode="mode"
        :code-value="codeValue"
        :code-max="codeMax"
        :show-code-control="showCodeControl"
        :slider-label-text="sliderLabelText"
        :rule-label-text="ruleLabelText"
        :rule-status-text="ruleStatusText"
        :rule-input-value="ruleInputValue"
        @set-state-count="setStateCount"
        @set-mode="setMode"
        @code-slider-input="onCodeSliderInput"
        @code-number-input="onCodeNumberInput"
        @code-number-change="refresh"
        @rule-input="onRuleInput"
        @random-rule="onRandomRule"
        @regen="run"
      />
    </div>

    <div class="ca-row">
      <InitControls
        :init="init"
        :seed-label-text="seedLabelText"
        :seed-input-value="seedInputValue"
        :seed-status-text="seedStatusText"
        :seed-placeholder="seedPlaceholder"
        :height="H"
        :height-status-text="heightStatusText"
        :width="W"
        :width-status-text="widthStatusText"
        :noise="noise"
        :noise-status-text="noiseStatusText"
        @set-init="setInit"
        @seed-input="onSeedInput"
        @height-slider-input="onHeightSliderInput"
        @height-number-input="onHeightNumberInput"
        @height-number-change="run"
        @width-slider-input="onWidthSliderInput"
        @width-number-input="onWidthNumberInput"
        @width-number-change="run"
        @noise-slider-input="onNoiseSliderInput"
        @noise-number-input="onNoiseNumberInput"
        @noise-number-change="run"
        @noise-preset="onNoisePreset"
      />
    </div>

    <LegendPanel
      :colors="COL"
      :state-count="stateCount"
      :key-text="keyText"
      :legend-items="legendItems"
      :legend-mode-local="mode === 'local'"
    />

    <canvas
      ref="canvasRef"
      class="ca-canvas"
      role="img"
      aria-label="Spatiotemporal diagram of the cellular automaton"
    ></canvas>

    <div class="ca-row">
      <div class="ca-control">
        <label class="ca-label">Continue simulating</label>
        <div class="ca-inline">
          <input
            class="ca-number"
            type="number"
            min="1"
            max="5000"
            step="1"
            :value="extraRows"
            @input="onExtraRowsInput"
          />
          <button type="button" @click="continueSimulation">continue {{ extraRows }} generations</button>
        </div>
        <div class="ca-meter">adds generations past the last row, without restarting from the initial row</div>
      </div>
    </div>

    <div class="ca-row">
      <ViewPanel
        :grid="grid"
        :states="stateCount"
        :colors="COL"
      />
    </div>
    </div>

    <div class="ca-side">
    <div class="ca-row">
      <TagsPanel
        :tags="tags"
        :current-rule-tags="currentRuleTags"
        :tag-counts="tagCounts"
        :active-tag="activeTag"
        :rules-for-active-tag="rulesForActiveTag"
        :active-index="activeIndex"
        :nav-status-text="navStatusText"
        @add-tag="addTag"
        @rename-tag="renameTag"
        @delete-tag="deleteTag"
        @toggle-tag="onToggleTag"
        @browse-tag="onBrowseTag"
        @close-browse="closeBrowse"
        @delete-rule="deleteRule"
        @next-rule="onNextTaggedRule"
        @prev-rule="onPrevTaggedRule"
        @jump-to-rule="onJumpToTaggedRule"
        @export-file="exportToFile"
        @import-file="onImportFile"
      />
    </div>

    <div class="ca-row">
      <AnalysisPanel
        :state-count="stateCount"
        :mode="mode"
        :code-max="codeMax"
        :running="analysisRunning"
        :done="analysisDone"
        :total="analysisTotal"
        :progress="analysisProgress"
        :current-code="analysisCurrentCode"
        :counts="analysisCounts"
        :tags="tags"
        :tag-counts="tagCounts"
        :rules="rules"
        @run="onRunAnalysis"
        @stop="stopAnalysis"
      />
    </div>

    <div class="ca-row">
      <FieldsAnalysisPanel
        :state-count="stateCount"
        :mode="mode"
        :code-max="codeMax"
        :running="fieldsRunning"
        :done="fieldsDone"
        :total="fieldsTotal"
        :progress="fieldsProgress"
        :current-code="fieldsCurrentCode"
        :found="fieldsFound"
        :tag-count="tagCounts[FIELDS_TAG] || 0"
        :tags="tags"
        :tag-counts="tagCounts"
        :rules="rules"
        @run="onRunFieldsAnalysis"
        @stop="stopFieldsAnalysis"
      />
    </div>

    <div class="ca-row">
      <GlidersAnalysisPanel
        :state-count="stateCount"
        :mode="mode"
        :code-max="codeMax"
        :running="glidersRunning"
        :done="glidersDone"
        :total="glidersTotal"
        :progress="glidersProgress"
        :current-code="glidersCurrentCode"
        :found="glidersFound"
        :tag-count="tagCounts[GLIDERS_TAG] || 0"
        :tags="tags"
        :tag-counts="tagCounts"
        :rules="rules"
        @run="onRunGlidersAnalysis"
        @stop="stopGlidersAnalysis"
      />
    </div>

    <div class="ca-row">
      <CustomSearchPanel
        :state-count="stateCount"
        :mode="mode"
        :code-max="codeMax"
        :running="customRunning"
        :done="customDone"
        :total="customTotal"
        :progress="customProgress"
        :current-code="customCurrentCode"
        :found="customFound"
        :tag-count="tagCounts[CUSTOM_SEARCH_TAG] || 0"
        :tags="tags"
        :tag-counts="tagCounts"
        :rules="rules"
        @run="onRunCustomSearch"
        @stop="stopCustomSearch"
      />
    </div>

    <div class="ca-row">
      <LinesAnalysisPanel
        :state-count="stateCount"
        :mode="mode"
        :code-max="codeMax"
        :running="linesRunning"
        :done="linesDone"
        :total="linesTotal"
        :progress="linesProgress"
        :current-code="linesCurrentCode"
        :found="linesFound"
        :tag-count="tagCounts[LINES_TAG] || 0"
        :tags="tags"
        :tag-counts="tagCounts"
        :rules="rules"
        @run="onRunLinesAnalysis"
        @stop="stopLinesAnalysis"
      />
    </div>

    <div class="ca-row">
      <ChaosAnalysisPanel
        :state-count="stateCount"
        :mode="mode"
        :code-max="codeMax"
        :running="chaosRunning"
        :done="chaosDone"
        :total="chaosTotal"
        :progress="chaosProgress"
        :current-code="chaosCurrentCode"
        :found="chaosFound"
        :tag-count="tagCounts[CHAOS_TAG] || 0"
        :tags="tags"
        :tag-counts="tagCounts"
        :rules="rules"
        @run="onRunChaosAnalysis"
        @stop="stopChaosAnalysis"
      />
    </div>

    <div class="ca-row">
      <SubAnalysisPanel
        :state-count="stateCount"
        :mode="mode"
        :code-max="codeMax"
        :tags="tags"
        :tag-counts="tagCounts"
        :rules="rules"
        :running="subRunning"
        :done="subDone"
        :total="subTotal"
        :progress="subProgress"
        :current-code="0"
        :current-name="subCurrentName"
        :results="subResults"
        @run="onRunSubAnalysis"
        @stop="stopSubAnalysis"
        @select-rule="onSelectSubRule"
      />
    </div>
    </div>
    </div>
  </div>
</template>
