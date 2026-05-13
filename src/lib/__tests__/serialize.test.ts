// Tests for serialize.ts — round-trip import/export, zod rejection of bad
// payloads, snapshot-list parse helper, tone fallback coercion, custom format
// + blockOverrides pass-through.

import { describe, it, expect } from 'vitest'
import { buildScene } from '../buildScene'
import { getFormat } from '../formats'
import { ensureProjectFormatDocuments } from '../formatDocuments'
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
        'vk-square': { title: { x: 10, y: 20, w: 50, h: 10 } },
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
      expect(result.data.blockOverrides?.['vk-square']?.title?.x).toBe(10)
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
      selectedFormats: ['vk-square', 'custom:sq300'],
    }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(withCustom)))
    expect(result.success).toBe(true)
  })

  it('preserves per-format background extension entries', () => {
    const p: Project = {
      ...newProject('per-format-bg'),
      useExtendedImage: true,
      extendedImageByFormat: {
        'vk-square': {
          imageSrc: 'data:image/png;base64,extended-square',
          metadata: {
            changed: true,
            reason: 'extended',
            originalSize: { width: 100, height: 100 },
            extendedSize: { width: 140, height: 140 },
            targetFormatKey: 'vk-square',
            targetAspectRatioRaw: 1,
            targetAspectRatioUsed: 1,
            aspectRatioPreserved: true,
            drawScaleX: 1,
            drawScaleY: 1,
            drawOffsetX: 20,
            drawOffsetY: 20,
            backgroundUniformity: 0.95,
          },
        },
      },
      backgroundExtensionByFormat: {
        'vk-square': {
          changed: true,
          reason: 'extended',
          originalSize: { width: 100, height: 100 },
          extendedSize: { width: 140, height: 140 },
          targetFormatKey: 'vk-square',
          backgroundUniformity: 0.95,
        },
      },
    }
    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(p)))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.extendedImageByFormat?.['vk-square']?.imageSrc).toBe('data:image/png;base64,extended-square')
      expect(result.data.backgroundExtensionByFormat?.['vk-square']?.changed).toBe(true)
    }
  })

  it('preserves formatDocuments through parse, including custom objects', () => {
    const generated = ensureProjectFormatDocuments(
      { ...newProject('format-docs'), selectedFormats: ['vk-square'] },
      new Date('2026-05-13T00:00:00.000Z'),
    )
    const document = generated.formatDocuments!['vk-square']!
    const p: Project = {
      ...generated,
      formatDocuments: {
        'vk-square': {
          ...document,
          objects: [
            ...document.objects,
            {
              id: 'custom-1',
              type: 'custom-image',
              name: 'Uploaded sticker',
              visible: true,
              x: 10,
              y: 12,
              width: 20,
              height: 18,
              zIndex: 90,
              imageSrc: 'data:image/png;base64,custom',
              fit: 'contain',
              metadata: { source: 'user' },
            },
          ],
        },
      },
    }

    const result = projectSchema.safeParse(JSON.parse(JSON.stringify(p)))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.formatDocuments?.['vk-square']?.objects.some((object) => object.id === 'custom-1')).toBe(true)
      expect(result.data.formatDocuments?.['vk-square']?.scene.title?.text).toBe(document.scene.title?.text)
    }
  })

  it('accepts old projects without formatDocuments', () => {
    const oldProject = JSON.parse(JSON.stringify(newProject('old-project')))
    delete oldProject.formatDocuments
    delete oldProject.activeFormatKey

    const result = projectSchema.safeParse(oldProject)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.formatDocuments).toBeUndefined()
    }
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

  it('preserves project image data URL and buildScene uses it after restore', async () => {
    const dataUrl =
      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMCAxMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZmYwIi8+PC9zdmc+'
    const p: Project = {
      ...newProject('image-round-trip'),
      imageSrc: dataUrl,
      selectedFormats: ['vk-square'],
      enabled: { ...newProject('enabled').enabled, image: true },
      master: {
        ...newProject('master').master,
        image: {
          x: 50,
          y: 8,
          w: 44,
          h: 84,
          src: null,
          rx: 16,
          fit: 'cover',
        },
      },
    }

    const restored = await importJson(asFile(JSON.parse(JSON.stringify(p))))
    expect(restored.imageSrc).toBe(dataUrl)

    const input = {
      ...restored.master,
      image: restored.master.image ? { ...restored.master.image, src: restored.imageSrc } : undefined,
    }
    const scene = buildScene(input, 'vk-square', restored.brandKit, restored.enabled, {
      customFormats: restored.customFormats,
    })
    expect(scene.image?.src).toBe(dataUrl)
    expect(getFormat('vk-square').key).toBe('vk-square')
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
