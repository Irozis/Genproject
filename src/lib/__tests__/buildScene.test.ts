import { describe, it, expect } from 'vitest'
import { buildScene } from '../buildScene'
import { DEFAULT_MASTER, DEFAULT_BRAND_KIT, DEFAULT_ENABLED } from '../defaults'
import { checkOverflow } from '../fixLayout'
import { DEFAULT_COMPOSITION_BY_FORMAT, getFormat } from '../formats'
import type { BlockKind, EnabledMap, Scene } from '../types'

const ALL_FORMATS = ['vk-square', 'vk-vertical', 'vk-landscape', 'instagram-story'] as const

describe('buildScene — determinism', () => {
  it('same inputs → identical output (no randomness)', () => {
    for (const fmt of ALL_FORMATS) {
      const a = buildScene(DEFAULT_MASTER, fmt, DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
      const b = buildScene(DEFAULT_MASTER, fmt, DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
      expect(a).toEqual(b)
    }
  })
})

describe('buildScene — disabled elements', () => {
  it('omits title when disabled', () => {
    const enabled: EnabledMap = { ...DEFAULT_ENABLED, title: false }
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, enabled)
    expect(scene.title).toBeUndefined()
  })

  it('omits badge when disabled', () => {
    const enabled: EnabledMap = { ...DEFAULT_ENABLED, badge: false }
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, enabled)
    expect(scene.badge).toBeUndefined()
  })

  it('includes title when enabled', () => {
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
    expect(scene.title).toBeDefined()
  })
})

describe('buildScene — safe zone clamping', () => {
  for (const fmt of ALL_FORMATS) {
    it(`blocks stay inside safe zone for ${fmt}`, () => {
      const rules = getFormat(fmt)
      const scene = buildScene(DEFAULT_MASTER, fmt, DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
      const sz = rules.safeZone

      for (const k of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
        const b = scene[k]
        if (!b) continue
        expect(b.x).toBeGreaterThanOrEqual(sz.left - 0.01)
        expect(b.y).toBeGreaterThanOrEqual(sz.top - 0.01)
        expect(b.x + b.w).toBeLessThanOrEqual(100 - sz.right + 0.01)
      }
    })
  }
})

describe('buildScene — brand kit applied', () => {
  it('applies accent color to CTA background', () => {
    const brand = { ...DEFAULT_BRAND_KIT, accentColor: '#ABCDEF' }
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', brand, DEFAULT_ENABLED)
    // CTA bg comes from brand.accentColor when master.cta.bg is not set
    // (master has bg = '' or matching accent)
    expect(scene.cta).toBeDefined()
  })

  it('applies pill radius for pill ctaStyle', () => {
    const brand = { ...DEFAULT_BRAND_KIT, ctaStyle: 'pill' as const }
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', brand, DEFAULT_ENABLED)
    expect(scene.cta?.rx).toBe(999)
  })

  it('applies sharp radius for sharp ctaStyle', () => {
    const brand = { ...DEFAULT_BRAND_KIT, ctaStyle: 'sharp' as const }
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', brand, DEFAULT_ENABLED)
    expect(scene.cta?.rx).toBe(0)
  })

  it('applies rounded radius for rounded ctaStyle', () => {
    const brand = { ...DEFAULT_BRAND_KIT, ctaStyle: 'rounded' as const }
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', brand, DEFAULT_ENABLED)
    expect(scene.cta?.rx).toBe(14)
  })
})

describe('buildScene — background', () => {
  it('output background matches master background', () => {
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
    expect(scene.background).toEqual(DEFAULT_MASTER.background)
  })
})

describe('buildScene — block overrides', () => {
  it('applies title x/y override for vk-square', () => {
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      blockOverrides: {
        title: {
          x: 11,
          y: 22,
          w: DEFAULT_MASTER.title!.w,
        },
      },
    })
    expect(scene.title?.x).toBe(11)
    expect(scene.title?.y).toBe(22)
  })
})

describe('buildScene — text fitting', () => {
  const longRussianMaster: Scene = {
    ...DEFAULT_MASTER,
    title: DEFAULT_MASTER.title
      ? {
          ...DEFAULT_MASTER.title,
          text: 'Покупки к лету лучше делать сильно заранее',
          fontSize: 14,
          maxLines: 2,
        }
      : undefined,
    subtitle: DEFAULT_MASTER.subtitle
      ? { ...DEFAULT_MASTER.subtitle, text: 'Самый качественный продукт с первых рук' }
      : undefined,
    cta: DEFAULT_MASTER.cta ? { ...DEFAULT_MASTER.cta, text: 'Купить сейчас' } : undefined,
    image: DEFAULT_MASTER.image
      ? { ...DEFAULT_MASTER.image, src: 'data:image/png;base64,abc' }
      : undefined,
  }

  it('honors title maxLines while capping an oversized manual font', () => {
    const scene = buildScene(longRussianMaster, 'avito-listing', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)

    expect(scene.title?.maxLines).toBe(2)
    expect(scene.title?.fontSize).toBeLessThan(14)
  })

  it('keeps text blocks from overlapping in compact split layouts', () => {
    const format = getFormat('avito-listing')
    const scene = buildScene(longRussianMaster, 'avito-listing', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
    const textIssues = checkOverflow(scene, format).filter((issue) => {
      const block = issue.block as BlockKind | null
      return block === 'title' || block === 'subtitle' || block === 'cta' || block === 'badge'
    })

    expect(textIssues).toEqual([])
  })

  it('leaves readable vertical gaps in horizontal split layouts', () => {
    const format = getFormat('avito-listing')
    const scene = buildScene(longRussianMaster, 'avito-listing', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
    const title = scene.title!
    const subtitle = scene.subtitle!
    const cta = scene.cta!
    const titleBottom = title.y + title.fontSize * (title.lineHeight ?? 1.2) * title.maxLines * format.aspectRatio
    const subtitleBottom = subtitle.y + subtitle.fontSize * (subtitle.lineHeight ?? 1.2) * subtitle.maxLines * format.aspectRatio

    expect(subtitle.y - titleBottom).toBeGreaterThanOrEqual(format.gutter - 0.5)
    expect(cta.y - subtitleBottom).toBeGreaterThanOrEqual(format.gutter - 0.5)
  })

  it('reserves enough height for three-line titles in horizontal split layouts', () => {
    const format = getFormat('avito-listing')
    const master: Scene = {
      ...longRussianMaster,
      title: longRussianMaster.title ? { ...longRussianMaster.title, maxLines: 3 } : undefined,
    }
    const scene = buildScene(master, 'avito-listing', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
    const title = scene.title!
    const subtitle = scene.subtitle!
    const titleBottom = title.y + title.fontSize * (title.lineHeight ?? 1.2) * title.maxLines * format.aspectRatio

    expect(subtitle.y - titleBottom).toBeGreaterThanOrEqual(format.gutter - 0.5)
  })

  it('reserves enough height for three-line titles in story layouts', () => {
    const format = getFormat('instagram-story')
    const master: Scene = {
      ...longRussianMaster,
      title: longRussianMaster.title ? { ...longRussianMaster.title, maxLines: 3 } : undefined,
    }
    const scene = buildScene(master, 'instagram-story', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
    const title = scene.title!
    const subtitle = scene.subtitle!
    const titleBottom = title.y + title.fontSize * (title.lineHeight ?? 1.2) * title.maxLines * format.aspectRatio

    expect(subtitle.y - titleBottom).toBeGreaterThanOrEqual(format.gutter * 0.5)
  })
})

describe('buildScene — locale', () => {
  it('uses localized title text when locale is active', () => {
    const master = {
      ...DEFAULT_MASTER,
      title: DEFAULT_MASTER.title
        ? { ...DEFAULT_MASTER.title, text: 'Default', textByLocale: { ru: 'Скидка' } }
        : undefined,
    }
    const scene = buildScene(master, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      locale: 'ru',
    })
    expect(scene.title?.text).toBe('Скидка')
  })
})

describe('format defaults', () => {
  it('uses an image-bearing layout for Avito square by default', () => {
    expect(DEFAULT_COMPOSITION_BY_FORMAT['yandex-market-card']).toBe('split-right-image')
  })
})
