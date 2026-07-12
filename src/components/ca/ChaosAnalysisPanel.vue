<script setup lang="ts">
import { ref, computed } from 'vue'
import { CHAOS_DEFAULTS, CHAOS_TAG } from '../../constants/ca'
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

const cutTop = ref(CHAOS_DEFAULTS.cutTop)
const blockSize = ref(CHAOS_DEFAULTS.blockSize)
const maxDominant = ref(CHAOS_DEFAULTS.maxDominant)

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
  cutTop.value = clampInt(cutTop.value, 0, 90, CHAOS_DEFAULTS.cutTop)
  blockSize.value = clampInt(blockSize.value, 1, 32, CHAOS_DEFAULTS.blockSize)
  maxDominant.value = clampInt(maxDominant.value, 0, 100, CHAOS_DEFAULTS.maxDominant)
  emit('run', {
    ...config,
    cutTop: cutTop.value,
    blockSize: blockSize.value,
    maxDominant: maxDominant.value,
  })
}
</script>

<template>
  <div class="ca-analysis">
    <h3 class="ca-panel-title">Chaos test ({{ CHAOS_TAG }})</h3>
    <AnalysisRunControls
      :code-max="codeMax"
      :running="running"
      :done="done"
      :total="total"
      :progress="progress"
      :current-code="currentCode"
      :current-name="currentName"
      run-label="▶ run chaos test"
      :found="found"
      found-label="no chaos in"
      :tags="tags"
      :tag-counts="tagCounts"
      :rules="rules"
      :width-max="1000"
      :height-max="2000"
      :initial-width="CHAOS_DEFAULTS.width"
      :initial-height="CHAOS_DEFAULTS.height"
      @run="onRun"
      @stop="emit('stop')"
    >
      <template #description>
        <label class="ca-label">
          Separate run: the top {{ cutTop }}% of the W×H generation is cut off (transient process),
          the rest is reduced to {{ blockSize }}×{{ blockSize }} patterns (like in the "to patterns" block).
          A rule is considered chaotic if the most frequent ("dominant") pattern doesn't stand out from
          the distribution — it covers no more than {{ maxDominant }}% of all blocks. The tag «{{ CHAOS_TAG }}»
          is applied to rules WITHOUT chaos (to filter out chaotic ones): wild chaos like rule 30 doesn't get
          the tag, while rules with a dominant repeating background (e.g. rule 110) do.
          The tag is independent and can coexist with any class (currently {{ modeLabel }} for
          {{ stateCount }} states).
        </label>
      </template>

      <template #params>
        <div class="ca-inline">
          <label class="ca-field">
            <span class="ca-field-cap">cut off top, %</span>
            <input class="ca-number" type="number" min="0" max="90" step="1" v-model.number="cutTop" :disabled="running" />
          </label>
          <label class="ca-field">
            <span class="ca-field-cap">pattern M×M</span>
            <input class="ca-number" type="number" min="1" max="32" step="1" v-model.number="blockSize" :disabled="running" />
          </label>
          <label class="ca-field">
            <span class="ca-field-cap">max dominant share, %</span>
            <input class="ca-number" type="number" min="0" max="100" step="1" v-model.number="maxDominant" :disabled="running" />
          </label>
        </div>
      </template>

      <template #footer>
        <div class="ca-meter">total tagged «{{ CHAOS_TAG }}»: {{ tagCount }}</div>
      </template>
    </AnalysisRunControls>
  </div>
</template>
