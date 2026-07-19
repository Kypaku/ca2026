<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { buildPatternMap } from '../../utils/caAnalysis'
import type { PatternMap, PatternPalette } from '../../types/ca'

const props = defineProps<{
  grid: Uint8Array[]
  states: number
  colors: string[]
}>()

// Maximum number of legend entries rendered (a chaotic rule can produce
// thousands of distinct patterns; the pixel map still shows them all).
const LEGEND_CAP = 240

const blockSize = ref(4)
const palette = ref<PatternPalette>('color')
const patternMap = ref<PatternMap | null>(null)
const mapCanvasRef = ref<HTMLCanvasElement | null>(null)

interface LegendPreview {
  index: number
  color: string
  count: number
  preview: string
}
const legend = ref<LegendPreview[]>([])

const distinctCount = computed(() => patternMap.value?.patterns.length ?? 0)
const hiddenCount = computed(() => Math.max(0, distinctCount.value - legend.value.length))
const hasGrid = computed(() => props.grid.length > 0)

function clampBlockSize(value: number): number {
  const num = Math.floor(Number(value))
  if (Number.isNaN(num)) {
    return 4
  }
  return Math.max(1, Math.min(64, num))
}

/** Renders one M×M pattern to a data URL used as its legend thumbnail. */
function makePreview(cells: Uint8Array, size: number): string {
  const cell = 8
  const canvas = document.createElement('canvas')
  canvas.width = size * cell
  canvas.height = size * cell
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return ''
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      ctx.fillStyle = props.colors[cells[y * size + x]] || props.colors[0]
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }
  return canvas.toDataURL()
}

/** Paints the reduced pattern map (one pixel per block) onto the map canvas. */
function renderMap(map: PatternMap): void {
  const canvas = mapCanvasRef.value
  if (!canvas) {
    return
  }
  const scale = Math.max(2, Math.min(12, Math.floor(720 / Math.max(1, map.cols))))
  canvas.width = map.cols * scale
  canvas.height = map.rows * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }
  for (let by = 0; by < map.rows; by++) {
    for (let bx = 0; bx < map.cols; bx++) {
      const patternIdx = map.cellIndex[by * map.cols + bx]
      ctx.fillStyle = map.patterns[patternIdx].color
      ctx.fillRect(bx * scale, by * scale, scale, scale)
    }
  }
}

async function convert(): Promise<void> {
  if (!hasGrid.value) {
    return
  }
  const size = clampBlockSize(blockSize.value)
  blockSize.value = size
  const map = buildPatternMap(props.grid, props.states, size, palette.value)
  patternMap.value = map
  legend.value = map.patterns.slice(0, LEGEND_CAP).map((entry) => ({
    index: entry.index,
    color: entry.color,
    count: entry.count,
    preview: makePreview(entry.cells, map.blockSize),
  }))
  await nextTick()
  renderMap(map)
}

// Re-paint with the new colour scheme (without re-scanning) whenever the
// palette toggle changes, as long as a map has already been built.
watch(palette, () => {
  if (patternMap.value) {
    void convert()
  }
})
</script>

<template>
  <div class="ca-analysis">
    <h3 class="ca-panel-title">View: convert field to patterns</h3>
    <div class="ca-control ca-control--wide">
      <label class="ca-label">
        The field is cut into square M×M chunks. Each chunk becomes one
        pixel: identical patterns get the same unique color. Below is a
        legend showing which pattern corresponds to which color.
      </label>

      <div class="ca-inline">
        <label class="ca-field">
          <span class="ca-field-cap">chunk size M</span>
          <input class="ca-number" type="number" min="1" max="64" step="1" v-model.number="blockSize" />
        </label>
        <div class="ca-seg">
          <button type="button" :class="{ on: palette === 'color' }" @click="palette = 'color'">
            colored
          </button>
          <button type="button" :class="{ on: palette === 'grayscale' }" @click="palette = 'grayscale'">
            grayscale
          </button>
        </div>
        <button type="button" @click="convert" :disabled="!hasGrid">▦ convert to patterns</button>
        <button type="button" v-if="patternMap" @click="patternMap = null">✕ hide patterns</button>
      </div>

      <div class="ca-meter" v-if="!hasGrid">build the diagram first (field is empty)</div>

      <template v-if="patternMap">
        <div class="ca-meter">
          grid {{ patternMap.cols }}×{{ patternMap.rows }} chunks,
          distinct patterns: {{ distinctCount }}
        </div>
        <canvas ref="mapCanvasRef" class="ca-canvas ca-pattern-map" role="img"
          aria-label="Pattern map: each pixel is the pattern of one field chunk"></canvas>

        <div class="ca-pattern-legend">
          <div class="ca-pattern-item" v-for="entry in legend" :key="entry.index">
            <img class="ca-pattern-thumb" :src="entry.preview" :alt="`pattern #${entry.index}`" />
            <span class="ca-pattern-swatch" :style="{ background: entry.color }"></span>
            <span class="ca-pattern-count">×{{ entry.count }}</span>
          </div>
        </div>
        <div class="ca-meter" v-if="hiddenCount > 0">
          showing {{ legend.length }} of {{ distinctCount }} patterns (remaining {{ hiddenCount }} are on the map only)
        </div>
      </template>
    </div>
  </div>
</template>
