<script setup lang="ts">
import CellularAutomatonExplorer from './components/CellularAutomatonExplorer.vue'
</script>

<template>
  <main class="app-shell">
    <h1>Cellular Automaton Simulator</h1>
    <CellularAutomatonExplorer />
  </main>
</template>

<style scoped>
.app-shell {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem;
  text-align: left;
}
h1 {
  font-size: 1.6em;
  margin-bottom: 1rem;
}
</style>
