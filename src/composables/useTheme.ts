import { ref, watch } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'ca-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function applyTheme(value: Theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', value === 'dark')
  root.classList.toggle('light', value === 'light')
}

const theme = ref<Theme>(getInitialTheme())
applyTheme(theme.value)

watch(theme, (value) => {
  applyTheme(value)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, value)
  }
})

export function useTheme() {
  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
  function setTheme(value: Theme) {
    theme.value = value
  }
  return { theme, toggleTheme, setTheme }
}
