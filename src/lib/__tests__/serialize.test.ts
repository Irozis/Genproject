// Tests for serialize.ts — round-trip import/export, zod rejection of bad
// payloads, snapshot-list parse helper, tone fallback coercion, custom format
// + blockOverrides pass-through.

import { describe, it, expect } from 'vitest'
import { importJson, parseBrandSnapshotList, projectSchema } from '../serialize'
import { newProject } from '../defaults'
import type { Project } from '../types'

function asFile(obj: unknown): File {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' })
  return new File([blob], 'project.json', { type: 'application/json' })
}

describe('projectSchema — round trip', () => {
  it('parses a freshly-created default project', () => {
    const p = newProject('sample')
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(p)))
    expect(result.success).toBe(true)
  })

  it('preserves optional Project fields through parse', () => {
    const p: Project = {
      ...newProject('sample'),
      blockOverrides: {
        'marketplace-card': { title: { x: 10, y: 20, w: 50, h: 10 } },
      },
      paletteLocked: true,
      activeLocale: 'ru',
      availableLocales: ['en', 'ru'],
      customFormats: [
        {
          key: 'custom:sq300',
          label: 'Square 300',
          width: 300,
          height: 300,
          aspectRatio: 1,
          safeZone: { top: 8, right: 8, bottom: 8, left: 8 },
          gutter: 4,
          minTitleSize: 4,
          maxTitleLines: 2,
          requiredElements: ['title'],
        },
      ],
    }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(p)))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.blockOverrides?.['marketplace-card']?.title?.x).toBe(10)
      expect(result.data.paletteLocked).toBe(true)
      expect(result.data.activeLocale).toBe('ru')
      expect(result.data.customFormats?.[0]?.key).toBe('custom:sq300')
    }
  })

  it('parses a textBlock with textByLocale + transform', () => {
    const p = newProject('locales')
    const withLocale: Project = {
      ...p,
      master: {
        ...p.master,
        title: p.master.title
          ? {
              ...p.master.title,
              textByLocale: { en: 'Hi', ru: 'Привет' },
              transform: 'uppercase',
            }
          : undefined,
      },
    }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(withLocale)))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.master.title?.textByLocale?.ru).toBe('Привет')
      expect(result.data.master.title?.transform).toBe('uppercase')
    }
  })

  it('coerces unknown toneOfVoice to "neutral"', () => {
    const p = newProject('tone')
    const mangled = {
      ...p,
      brandKit: { ...p.brandKit, toneOfVoice: 'sarcastic' as unknown as 'neutral' },
    }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(mangled)))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.brandKit.toneOfVoice).toBe('neutral')
    }
  })

  it('accepts background with radial field', () => {
    const p = newProject('radial')
    const withRadial: Project = {
      ...p,
      master: {
        ...p.master,
        background: {
          kind: 'gradient',
          stops: ['#000', '#333', '#666'],
          radial: { cx: 0.3, cy: 0.4 },
        },
      },
    }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(withRadial)))
    expect(result.success).toBe(true)
  })

  it('accepts grain decor with seed + intensity', () => {
    const p = newProject('grain')
    const withGrain: Project = {
      ...p,
      master: { ...p.master, decor: { kind: 'grain', seed: 42, intensity: 0.3 } },
    }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(withGrain)))
    expect(result.success).toBe(true)
  })

  it('rejects a project missing required fields', () => {
    const bad = { id: 'x', name: 'x' }
    const result = projectSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects invalid background kind', () => {
    const p = newProject('bad-bg')
    const bad = {
      ...p,
      master: { ...p.master, background: { kind: 'plasma', color: '#000' } },
    }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(bad)))
    expect(result.success).toBe(false)
  })

  it('rejects selectedFormats with unknown format key', () => {
    const p = newProject('bad-format')
    const bad = { ...p, selectedFormats: ['not-a-format'] }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(bad)))
    expect(result.success).toBe(false)
  })

  it('accepts custom: prefixed format keys in selectedFormats', () => {
    const p = newProject('custom-formats')
    const withCustom = {
      ...p,
      selectedFormats: ['marketplace-card', 'custom:sq300'],
    }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(withCustom)))
    expect(result.success).toBe(true)
  })
})

describe('importJson', () => {
  it('round-trips a default project via File', async () => {
    const p = newProject('round-trip')
    const restored = await importJson(asFile(p))
    expect(restored.id).toBe(p.id)
    expect(restored.name).toBe(p.name)
    expect(restored.selectedFormats).toEqual(p.selectedFormats)
  })

  it('throws "Not a valid JSON file" on malformed JSON', async () => {
    const file = new File(['{not json'], 'x.json', { type: 'application/json' })
    await expect(importJson(file)).rejects.toThrow(/not a valid json/i)
  })

  it('throws a schema error on shape mismatch', async () => {
    const file = asFile({ id: 'x', name: 'x' })
    await expect(importJson(file)).rejects.toThrow(/does not match Project schema/)
  })
})

describe('parseBrandSnapshotList', () => {
  it('returns the list when valid', () => {
    const p = newProject('s')
    const snap = {
      id: 'abc',
      name: 'Bold red',
      brandKit: p.brandKit,
      createdAt: Date.now(),
    }
    const out = parseBrandSnapshotList([snap])
    expect(out).toHaveLength(1)
    expect(out[0]!.name).toBe('Bold red')
  })

  it('returns [] when invalid', () => {
    expect(parseBrandSnapshotList({ not: 'an array' })).toEqual([])
    expect(parseBrandSnapshotList([{ missing: 'fields' }])).toEqual([])
  })

  it('returns [] for null / undefined', () => {
    expect(parseBrandSnapshotList(null)).toEqual([])
    expect(parseBrandSnapshotList(undefined)).toEqual([])
  })
})
