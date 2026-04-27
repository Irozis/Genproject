// localStorage wrapper for project state. Boundary code: side effects allowed here.

import { projectSchema } from './serialize'
import type { Project } from './types'

// v2: BrandKit reshape (palette + displayFont/textFont). Old v1 entries are
// silently ignored so users don't hit a white screen after the upgrade.
const KEY = 'adaptive-graphics:project:v2'
const LEGACY_KEYS = ['adaptive-graphics:project:v1']

export function saveProject(p: Project): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // quota or privacy mode — silently ignore in MVP
  }
}

export function loadProject(): Project | null {
  try {
    // Drop any legacy payloads so they can't haunt future loads.
    for (const k of LEGACY_KEYS) localStorage.removeItem(k)
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const result = projectSchema.safeParse(parsed)
    if (!result.success) {
      // Shape mismatch — probably a stale schema. Drop it.
      localStorage.removeItem(KEY)
      return null
    }
    return result.data as Project
  } catch {
    return null
  }
}

export function clearProject(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
