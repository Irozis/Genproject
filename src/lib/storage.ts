// localStorage wrapper for project state. Boundary code: side effects allowed here.

import { projectSchema } from './serialize'
import { DEFAULT_FORMATS } from './defaults'
import type { FormatKey, Project } from './types'

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
    return migrateProject(result.data as Project)
  } catch {
    return null
  }
}

function migrateProject(project: Project): Project {
  let next: Project = {
    ...project,
    selectedFormats: normalizeFormats(project.selectedFormats),
    formatOverrides: remapFormatRecord(project.formatOverrides),
    imageFocals: remapFormatRecord(project.imageFocals),
    blockOverrides: remapFormatRecord(project.blockOverrides),
    formatDensities: remapFormatRecord(project.formatDensities),
  }

  for (const key of ['avito-listing', 'avito-fullscreen', 'avito-skyscraper'] as const) {
    const imageOverride = next.blockOverrides?.[key]?.image
    if (imageOverride?.fit !== 'cover') continue
    next = {
      ...next,
      blockOverrides: {
        ...next.blockOverrides,
        [key]: {
          ...next.blockOverrides?.[key],
          image: { ...imageOverride, fit: 'contain' },
        },
      },
    }
  }

  return next
}

const FORMAT_MIGRATIONS: Record<string, FormatKey> = {
  'marketplace-card': 'vk-square',
  'marketplace-highlight': 'vk-vertical',
  'social-square': 'vk-square',
  'story-vertical': 'instagram-story',
  'avito-square': 'yandex-market-card',
}

function normalizeFormats(keys: Project['selectedFormats']): FormatKey[] {
  const out: FormatKey[] = []
  for (const key of keys) {
    const next = key.startsWith('custom:') ? key : FORMAT_MIGRATIONS[key] ?? key
    if (!out.includes(next)) out.push(next)
  }
  return out.length > 0 ? out : [...DEFAULT_FORMATS]
}

function remapFormatRecord<T>(record: Partial<Record<FormatKey, T>> | undefined) {
  if (!record) return undefined
  const out: Partial<Record<FormatKey, T>> = {}
  for (const [key, value] of Object.entries(record)) {
    const next = key.startsWith('custom:') ? key : FORMAT_MIGRATIONS[key] ?? key
    out[next as FormatKey] = value as T
  }
  return out
}

export function clearProject(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
