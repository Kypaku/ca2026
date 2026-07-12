<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { RANDOM_SAMPLE_DEFAULTS } from '../../constants/ca'
import type { AnalysisInitMode, AnalysisRunConfig, AnalysisSourceMode, TaggedRule } from '../../types/ca'

/**
 * Shared run controls reused by every batch analysis (class analysis, fields,
 * gliders, custom search and sub-analysis). It owns the parameters that are
 * common to all of them — evolution width/height, the initial-row strategy and
 * the *source* of rules to evaluate — and hands them back on run so each panel
 * can merge its own extra parameters on top.
 *
 * The source can be a sequential code range, a fixed-size random sample of that
 * range (for astronomically large rule spaces) or the union of rules already
 * carrying one of a set of selected tags. Panel-specific inputs go in the
 * `#params` slot, the explanatory text in `#description`, and anything shown
 * below the progress bar (counts, results…) in the `#footer` slot.
 */
const props = withDefaults(
  defineProps<{
    codeMax: number
    running: boolean
    done: number
    total: number
    progress: number
    currentCode: number
    currentName?: string
    runLabel: string
    tags: string[]
    tagCounts: Record<string, number>
    rules: TaggedRule[]
    found?: number
    foundLabel?: string
    showWidth?: boolean
    showHeight?: boolean
    widthMin?: number
    widthMax?: number
    heightMin?: number
    heightMax?: number
    initialWidth?: number
    initialHeight?: number
    canRun?: boolean
  }>(),
  {
    currentName: '',
    found: undefined,
    foundLabel: '',
    showWidth: true,
    showHeight: true,
    widthMin: 16,
    widthMax: 1000,
    heightMin: 20,
    heightMax: 2000,
    initialWidth: 201,
    initialHeight: 200,
    canRun: true,
  }
)

const emit = defineEmits<{
  (e: 'run', config: AnalysisRunConfig): void
  (e: 'stop'): void
}>()

const width = ref(props.initialWidth)
const height = ref(props.initialHeight)
const init = ref<AnalysisInitMode>('random')
const sourceMode = ref<AnalysisSourceMode>('range')
const rangeFrom = ref(0)
const rangeTo = ref(props.codeMax)
const sampleCount = ref(RANDOM_SAMPLE_DEFAULTS.count)
const selectedTags = ref(new Set<string>())

// Reset the code range whenever the rule space changes (different states/mode).
watch(
  () => props.codeMax,
  (max: number) => {
    rangeFrom.value = 0
    rangeTo.value = max
  }
)

const spanCount = computed(() => {
  const from = clampCode(rangeFrom.value)
  const to = clampCode(rangeTo.value)
  return to < from ? 0 : to - from + 1
})

const matchedCount = computed(() => {
  if (!selectedTags.value.size) {
    return 0
  }
  return props.rules.filter(
    (rule) => Array.isArray(rule.tags) && rule.tags.some((t) => selectedTags.value.has(t))
  ).length
})

const plannedCount = computed(() => {
  if (sourceMode.value === 'tags') {
    return matchedCount.value
  }
  if (sourceMode.value === 'random') {
    return Math.min(spanCount.value, Math.max(1, Math.floor(sampleCount.value) || 1))
  }
  return spanCount.value
})

const sourceNote = computed(() => {
  if (sourceMode.value === 'tags') {
    return `rules selected: ${matchedCount.value}`
  }
  if (sourceMode.value === 'random') {
    return `will test ${plannedCount.value} random rules out of range (${spanCount.value})`
  }
  return `will test ${plannedCount.value} rules`
})

const canStart = computed(() => {
  if (props.running || !props.canRun) {
    return false
  }
  return plannedCount.value > 0
})

function clampCode(value: number): number {
  const num = Math.floor(Number(value))
  if (Number.isNaN(num)) {
    return 0
  }
  return Math.max(0, Math.min(props.codeMax, num))
}

function clampInt(value: number, min: number, max: number, fallback: number): number {
  const num = Math.floor(Number(value))
  if (Number.isNaN(num)) {
    return fallback
  }
  return Math.max(min, Math.min(max, num))
}

function toggleTag(tag: string): void {
  const next = new Set(selectedTags.value)
  if (next.has(tag)) {
    next.delete(tag)
  } else {
    next.add(tag)
  }
  selectedTags.value = next
}

function onRun(): void {
  const from = clampCode(rangeFrom.value)
  let to = clampCode(rangeTo.value)
  if (to < from) {
    to = from
  }
  width.value = clampInt(width.value, props.widthMin, props.widthMax, props.initialWidth)
  height.value = clampInt(height.value, props.heightMin, props.heightMax, props.initialHeight)
  sampleCount.value = clampInt(sampleCount.value, 1, 100000000, RANDOM_SAMPLE_DEFAULTS.count)
  rangeFrom.value = from
  rangeTo.value = to
  emit('run', {
    width: width.value,
    height: height.value,
    init: init.value,
    sourceMode: sourceMode.value,
    from,
    to,
    sampleCount: sampleCount.value,
    tags: [...selectedTags.value],
  })
}
</script>

<template>
  <div class="ca-control ca-control--wide">
    <slot name="description" />

    <div class="ca-inline" v-if="showWidth || showHeight">
      <label class="ca-field" v-if="showWidth">
        <span class="ca-field-cap">width W</span>
        <input class="ca-number" type="number" :min="widthMin" :max="widthMax" step="1" v-model.number="width" :disabled="running" />
      </label>
      <label class="ca-field" v-if="showHeight">
        <span class="ca-field-cap">height H</span>
        <input class="ca-number" type="number" :min="heightMin" :max="heightMax" step="1" v-model.number="height" :disabled="running" />
      </label>
      <span class="ca-seg">
        <button type="button" :class="{ on: init === 'random' }" :disabled="running" @click="init = 'random'">random field</button>
        <button type="button" :class="{ on: init === 'single' }" :disabled="running" @click="init = 'single'">single cell</button>
      </span>
    </div>
    <div class="ca-inline" v-else>
      <span class="ca-seg">
        <button type="button" :class="{ on: init === 'random' }" :disabled="running" @click="init = 'random'">random field</button>
        <button type="button" :class="{ on: init === 'single' }" :disabled="running" @click="init = 'single'">single cell</button>
      </span>
    </div>

    <slot name="params" />

    <div class="ca-inline">
      <span class="ca-field-cap">source:</span>
      <span class="ca-seg">
        <button type="button" :class="{ on: sourceMode === 'range' }" :disabled="running" @click="sourceMode = 'range'">full range</button>
        <button type="button" :class="{ on: sourceMode === 'random' }" :disabled="running" @click="sourceMode = 'random'">random, N rules</button>
        <button type="button" :class="{ on: sourceMode === 'tags' }" :disabled="running" @click="sourceMode = 'tags'">by tags</button>
      </span>
    </div>

    <div class="ca-inline" v-if="sourceMode !== 'tags'">
      <label class="ca-field">
        <span class="ca-field-cap">code from</span>
        <input class="ca-number" type="number" min="0" :max="codeMax" step="1" v-model.number="rangeFrom" :disabled="running" />
      </label>
      <label class="ca-field">
        <span class="ca-field-cap">code to</span>
        <input class="ca-number" type="number" min="0" :max="codeMax" step="1" v-model.number="rangeTo" :disabled="running" />
      </label>
      <label class="ca-field" v-if="sourceMode === 'random'">
        <span class="ca-field-cap">number of random samples N</span>
        <input class="ca-number" type="number" min="1" step="1" v-model.number="sampleCount" :disabled="running" />
      </label>
      <span class="ca-meter">{{ sourceNote }}</span>
    </div>

    <template v-else>
      <div class="ca-tag-list">
        <button
          v-for="tag in tags"
          :key="tag"
          type="button"
          class="ca-tag-name"
          :class="{ 'ca-sub-tag-on': selectedTags.has(tag) }"
          :disabled="running"
          @click="toggleTag(tag)"
        >
          {{ tag }}<span class="ca-tag-count">{{ tagCounts[tag] || 0 }}</span>
        </button>
        <span v-if="!tags.length" class="ca-meter">no tags yet</span>
      </div>
      <div class="ca-meter">{{ sourceNote }}</div>
    </template>

    <div class="ca-inline">
      <button type="button" @click="onRun" :disabled="!canStart">{{ runLabel }}</button>
      <button type="button" @click="emit('stop')" :disabled="!running">■ stop</button>
      <slot name="run-extra" />
    </div>

    <div class="ca-progress" v-if="total > 0">
      <div class="ca-progress-track">
        <div class="ca-progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div class="ca-meter">
        {{ done }} / {{ total }} ({{ progress }}%)<template v-if="running"> — <template v-if="currentName">{{ currentName }}</template><template v-else>rule {{ currentCode }}</template></template>
        <template v-if="!running && total && foundLabel"> — {{ foundLabel }} {{ found }} of {{ total }}</template>
      </div>
    </div>

    <slot name="footer" />
  </div>
</template>
