// Pure, non-reactive helpers backing useRuleTags: localStorage (de)serialization,
// id generation, record normalization and rule identity/name derivation.
import type { RuleParts, TaggedRule } from '../types/ca'

export const TAGS_STORAGE_KEY = 'ca-rule-tags'
export const RULES_STORAGE_KEY = 'ca-tagged-rules'

let uidCounter = 0
export function nextId(): string {
  uidCounter += 1
  return `${Date.now()}-${uidCounter}`
}

export function loadJSON(key: string, fallback: unknown[]): unknown[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return fallback
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage errors (private mode, quota exceeded, etc.)
  }
}

export function normalizeRule(rule: unknown): TaggedRule | null {
  if (!rule || typeof rule !== 'object') {
    return null
  }
  const candidate = rule as Partial<TaggedRule>
  if (!candidate.snapshot) {
    return null
  }
  return {
    id: typeof candidate.id === 'string' ? candidate.id : nextId(),
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name : 'rule',
    signature: typeof candidate.signature === 'string' ? candidate.signature : null,
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter((t): t is string => typeof t === 'string') : [],
    snapshot: candidate.snapshot,
    createdAt: typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now(),
  }
}

/** Canonical string identifying "the same rule" regardless of init/seed/height. */
export function signatureOf(parts: RuleParts): string {
  return parts.mode === 'totalistic'
    ? `${parts.stateCount}|totalistic|${parts.code}`
    : `${parts.stateCount}|local|${parts.localRule}`
}

export function defaultRuleName(parts: RuleParts): string {
  return parts.mode === 'totalistic'
    ? `${parts.stateCount} states, totalistic ${parts.code}`
    : `${parts.stateCount} states, local ${parts.localRule}`
}
