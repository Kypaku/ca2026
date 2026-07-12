<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  stateCount: number
  mode: string
  codeValue: number
  codeMax: number
  sliderLabelText: string
  ruleLabelText: string
  ruleStatusText: string
  ruleInputValue: string
}>()

const ruleMaxLength = computed(() => Math.pow(props.stateCount, 3))

const emit = defineEmits([
  'set-state-count',
  'set-mode',
  'code-slider-input',
  'code-number-input',
  'code-number-change',
  'rule-input',
  'random-rule',
  'regen',
])
</script>

<template>
  <span class="ca-label">States</span>
  <span class="ca-seg">
    <button type="button" :class="{ on: stateCount === 2 }" @click="emit('set-state-count', 2)">2 colors</button>
    <button type="button" :class="{ on: stateCount === 3 }" @click="emit('set-state-count', 3)">3 colors</button>
    <button type="button" :class="{ on: stateCount === 4 }" @click="emit('set-state-count', 4)">4 colors</button>
    <button type="button" :class="{ on: stateCount === 5 }" @click="emit('set-state-count', 5)">5 colors</button>
  </span>

  <span class="ca-label">Rule</span>
  <span class="ca-seg">
    <button type="button" :class="{ on: mode === 'totalistic' }" @click="emit('set-mode', 'totalistic')">totalistic</button>
    <button type="button" :class="{ on: mode === 'local' }" @click="emit('set-mode', 'local')">by templates</button>
  </span>

  <div class="ca-panel">
    <div class="ca-control">
      <label class="ca-label">{{ sliderLabelText }}</label>
      <div class="ca-inline">
        <input
          class="ca-slider"
          type="range"
          min="0"
          :max="codeMax"
          step="1"
          :value="codeValue"
          @input="emit('code-slider-input', $event)"
        />
        <input
          class="ca-number"
          type="number"
          min="0"
          :max="codeMax"
          step="1"
          :value="codeValue"
          @input="emit('code-number-input', $event)"
          @change="emit('code-number-change')"
        />
        <span class="ca-out">{{ codeValue }}</span>
      </div>
    </div>

    <div class="ca-control" v-if="mode === 'local'">
      <label class="ca-label">{{ ruleLabelText }}</label>
      <input
        class="ca-input"
        type="text"
        inputmode="numeric"
        :maxlength="ruleMaxLength"
        spellcheck="false"
        :value="ruleInputValue"
        @input="emit('rule-input', $event)"
      />
      <div class="ca-meter">{{ ruleStatusText }}</div>
    </div>
  </div>

  <button type="button" @click="emit('random-rule')">random rule</button>
  <button type="button" @click="emit('regen')">reset</button>
</template>
