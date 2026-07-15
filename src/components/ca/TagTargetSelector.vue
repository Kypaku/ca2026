<script setup lang="ts">
import { computed } from 'vue'

// Lets a batch-analysis panel tag its found rules with ANY tag instead of its
// built-in default — an input with a datalist of existing tags (plus the
// panel's own default) so the user can pick one or type a brand new name.
const props = defineProps<{
  modelValue: string
  tags: string[]
  defaultTag: string
  running: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

// Unique per mounted instance (several of these panels render at once), so their
// <datalist> ids never collide.
const listId = `ca-tag-target-${Math.random().toString(36).slice(2)}`

// Selectable tags: the panel's own default first, then every other tag, de-duplicated.
const tagOptions = computed<string[]>(() => {
  const seen = new Set<string>()
  const list: string[] = []
  for (const tag of [props.defaultTag, ...props.tags]) {
    if (!seen.has(tag)) {
      seen.add(tag)
      list.push(tag)
    }
  }
  return list
})

function onInput(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <label class="ca-field">
    <span class="ca-field-cap">target tag</span>
    <input
      class="ca-input ca-tag-input"
      type="text"
      :list="listId"
      :value="modelValue"
      :disabled="running"
      :placeholder="defaultTag"
      @input="onInput"
    />
    <datalist :id="listId">
      <option v-for="tag in tagOptions" :key="tag" :value="tag" />
    </datalist>
  </label>
</template>
