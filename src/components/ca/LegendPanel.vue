<script setup lang="ts">
import type { LegendItem } from '../../types/ca'

defineProps<{
  colors: string[]
  stateCount: number
  keyText: string
  legendItems: LegendItem[]
  legendModeLocal: boolean
}>()
</script>

<template>
  <div class="ca-key">
    <span v-for="s in stateCount" :key="s"><span class="ca-dot" :style="{ background: colors[s - 1] }"></span>{{ s - 1 }}</span>
    <span class="ca-key-text">{{ keyText }}</span>
  </div>

  <div class="ca-legend" :class="{ 'ca-legend--local': legendModeLocal }">
    <div class="ca-cell" v-for="(item, index) in legendItems" :key="index">
      <div class="ca-sq" :style="{ background: item.color }"></div>
      <div class="ca-cap">{{ item.caption }}</div>
    </div>
  </div>
</template>
