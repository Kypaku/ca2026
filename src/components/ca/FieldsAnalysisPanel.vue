<script setup lang="ts">
import { ref, computed } from 'vue'
import { FIELDS_DEFAULTS, FIELDS_TAG } from '../../constants/ca'
import type { AnalysisRunConfig, TaggedRule } from '../../types/ca'
import AnalysisRunControls from './AnalysisRunControls.vue'

const props = defineProps<{
  stateCount: number
  mode: string
  codeMax: number
  running: boolean
  done: number
  total: number
  progress: number
  currentCode: number
  currentName?: string
  found: number
  tagCount: number
  tags: string[]
  tagCounts: Record<string, number>
  rules: TaggedRule[]
}>()

const emit = defineEmits(['run', 'stop'])

const blockWidth = ref(FIELDS_DEFAULTS.blockWidth)
const blockHeight = ref(FIELDS_DEFAULTS.blockHeight)
const minPercent = ref(FIELDS_DEFAULTS.minPercent)

const modeLabel = computed(() =>
  props.mode === 'totalistic' ? 'totalistic codes' : 'local rules'
)

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const num = Math.floor(Number(value))
  if (Number.isNaN(num)) {
    return fallback
  }
  return Math.max(min, Math.min(max, num))
}

function onRun(config: AnalysisRunConfig): void {
  blockWidth.value = clampInt(blockWidth.value, 1, 64, FIELDS_DEFAULTS.blockWidth)
  blockHeight.value = clampInt(blockHeight.value, 1, 64, FIELDS_DEFAULTS.blockHeight)
  minPercent.value = clampInt(minPercent.value, 1, 100, FIELDS_DEFAULTS.minPercent)
  emit('run', {
    ...config,
    blockWidth: blockWidth.value,
    blockHeight: blockHeight.value,
    minPercent: minPercent.value,
  })
}
</script>

<template>
  <div class="ca-analysis">
    <h3 class="ca-panel-title">Fields test ({{ FIELDS_TAG }})</h3>
    <AnalysisRunControls
      :code-max="codeMax"
      :running="running"
      :done="done"
      :total="total"
      :progress="progress"
      :current-code="currentCode"
      :current-name="currentName"
      run-label="▶ run fields test"
      :found="found"
      found-label="fields found in"
      :tags="tags"
      :tag-counts="tagCounts"
      :rules="rules"
      :width-max="1000"
      :height-max="2000"
      :initial-width="FIELDS_DEFAULTS.width"
      :initial-height="FIELDS_DEFAULTS.height"
      @run="onRun"
      @stop="emit('stop')"
    >
      <template #description>
        <label class="ca-label">
          Separate run: the W×H generation is cut into patches {{ blockWidth }}×{{ blockHeight }},
          patches are compared up to a horizontal shift (so field drift doesn't break a
          match). The tag «{{ FIELDS_TAG }}» is applied if the most frequent patch covers at least
          K% of all patches. The tag is independent and can coexist with any class
          (currently {{ modeLabel }} for {{ stateCount }} states).
        </label>
      </template>

      <template #params>
        <div class="ca-inline">
          <label class="ca-field">
            <span class="ca-field-cap">patch W</span>
            <input class="ca-number" type="number" min="1" max="64" step="1" v-model.number="blockWidth" :disabled="running" />
          </label>
          <label class="ca-field">
            <span class="ca-field-cap">patch H</span>
            <input class="ca-number" type="number" min="1" max="64" step="1" v-model.number="blockHeight" :disabled="running" />
          </label>
          <label class="ca-field">
            <span class="ca-field-cap">threshold K (% of patches)</span>
            <input class="ca-number" type="number" min="1" max="100" step="1" v-model.number="minPercent" :disabled="running" />
          </label>
        </div>
      </template>

      <template #footer>
        <div class="ca-meter">total tagged «{{ FIELDS_TAG }}»: {{ tagCount }}</div>
      </template>
    </AnalysisRunControls>
  </div>
</template>
