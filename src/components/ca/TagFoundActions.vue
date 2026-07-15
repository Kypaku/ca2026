<script setup lang="ts">
// Footer stats + actions shared by every orthogonal-tag batch analysis panel:
// shows how many rules currently carry the target tag, and offers to undo the
// tags the last completed run applied, or wipe the tag off every rule.
const props = defineProps<{
  targetTag: string
  tagCount: number
  found: number
  running: boolean
  canUndoFound?: boolean
}>()

const emit = defineEmits<{ 'undo-found': []; 'clear-tag': [tag: string] }>()

function onClearTag(): void {
  if (window.confirm(`Remove tag «${props.targetTag}» from all ${props.tagCount} rule(s) that have it?`)) {
    emit('clear-tag', props.targetTag)
  }
}
</script>

<template>
  <div class="ca-meter">total tagged «{{ targetTag }}»: {{ tagCount }}</div>
  <div class="ca-inline">
    <button type="button" @click="emit('undo-found')" :disabled="running || !canUndoFound">
      ↩ undo last search's found ({{ found }})
    </button>
    <button type="button" @click="onClearTag" :disabled="running || !tagCount">
      🗑 clear tag «{{ targetTag }}» completely
    </button>
  </div>
</template>
