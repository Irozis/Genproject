import { describe, it, expect } from 'vitest'
import { buildScene, resolveCompositionSelection } from '../buildScene'
import { contrastRatio } from '../color'
import { DEFAULT_MASTER, DEFAULT_BRAND_KIT, DEFAULT_ENABLED, newProject } from '../defaults'
import { checkOverflow } from '../fixLayout'
import { DEFAULT_COMPOSITION_BY_FORMAT, getFormat } from '../formats'
import type { AssetHint, BlockKind, CompositionModel, EnabledMap, Scene } from '../types'

describe('buildScene composition auto mode', () => {
  it('auto mode with no override uses deterministic selector', () => {
    const selection = resolveCompositionSelection(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)

    expect(selection.autoSelectorUsed).toBe(true)
    expect(selection.manualOverride).toBeUndefined()
    expect(selection.selectionDebug?.scores).toBeDefined()
    expect(selection.selectedArchetype).toBe(selection.selectionDebug?.selectedArchetype)
  })

  it('runtime auto override is normalized and still uses selector', () => {
    const selection = resolveCompositionSelection(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      override: 'auto',
    })

    expect(selection.autoSelectorUsed).toBe(true)
    expect(selection.manualOverride).toBeUndefined()
    expect(selection.selectionDebug?.scores).toBeDefined()
  })

  it('manual layout override bypasses selector', () => {
    const selection = resolveCompositionSelection(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      override: 'text-dominant',
    })

    expect(selection.autoSelectorUsed).toBe(false)
    expect(selection.manualOverride).toBe('text-dominant')
    expect(selection.selectedArchetype).toBe('text-dominant')
    expect(selection.selectionDebug).toBeUndefined()
  })

  it('newProject has no default per-format overrides', () => {
    expect(newProject('auto-test').formatOverrides).toBeUndefined()
  })

  it('compact format in auto mode still uses selector and policy', () => {
    const selection = resolveCompositionSelection(DEFAULT_MASTER, 'yandex-rsy-728x90', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)

    expect(selection.autoSelectorUsed).toBe(true)
    expect(selection.selectionDebug?.compactTextPolicyApplied).toBe(true)
    expect(selection.selectedArchetype).toBeDefined()
  })

  it('non-compact format in auto mode is not forced to compact policy', () => {
    const selection = resolveCompositionSelection(DEFAULT_MASTER, 'vk-landscape', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)

    expect(selection.autoSelectorUsed).toBe(true)
    expect(selection.selectionDebug?.compactTextPolicyApplied).toBe(false)
    expect(selection.selectionDebug?.smallTextRisk).toBe('low')
  })
})

describe('buildScene safe-zone clamping', () => {
  it('moves CTA upward instead of shrinking its height at the bottom edge', () => {
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      override: 'text-dominant',
      blockOverrides: {
        cta: { x: 8, y: 97, w: 34, h: 7 },
      },
    })

    expect(scene.cta?.h).toBe(7)
    expect((scene.cta?.y ?? 0) + (scene.cta?.h ?? 0)).toBeLessThanOrEqual(94)
  })
})

describe('buildScene manual composition modes', () => {
  const masterWithImage: Scene = {
    ...DEFAULT_MASTER,
    image: DEFAULT_MASTER.image ? { ...DEFAULT_MASTER.image, src: 'data:image/png;base64,manual' } : undefined,
  }

  function signature(scene: Scene) {
    return {
      image: scene.image
        ? {
            x: Math.round(scene.image.x),
            y: Math.round(scene.image.y),
            w: Math.round(scene.image.w),
            h: Math.round(scene.image.h ?? 0),
          }
        : null,
      title: scene.title
        ? {
            x: Math.round(scene.title.x),
            y: Math.round(scene.title.y),
            w: Math.round(scene.title.w),
          }
        : null,
      cta: scene.cta
        ? {
            x: Math.round(scene.cta.x),
            y: Math.round(scene.cta.y),
          }
        : null,
      overlay: Boolean(scene.scrim),
    }
  }

  it('respects manual modes and keeps their layout signatures distinct', () => {
    const modes: CompositionModel[] = ['text-dominant', 'hero-overlay', 'image-top-stack', 'split-right-image', 'split-left-image', 'product-card-safe']
    const brightHint: AssetHint = {
      width: 1200,
      height: 900,
      aspectRatio: 4 / 3,
      dominantColors: ['#F8FAFC'],
      isDarkBackground: false,
      bottomBandBrightness: 0.88,
      brightnessGrid: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => 0.88)),
    }
    const scenes = Object.fromEntries(
      modes.map((mode) => [
        mode,
        buildScene(masterWithImage, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
          override: mode,
          assetHint: mode === 'hero-overlay' ? brightHint : undefined,
        }),
      ]),
    ) as Record<CompositionModel, Scene>

    expect(scenes['text-dominant'].image).toBeUndefined()
    expect(scenes['hero-overlay'].scrim).toBeDefined()
    expect((scenes['image-top-stack'].image?.y ?? 999)).toBeLessThan(scenes['image-top-stack'].title?.y ?? 0)
    expect((scenes['split-right-image'].image?.x ?? 0)).toBeGreaterThan(scenes['split-right-image'].title?.x ?? 100)
    expect((scenes['split-left-image'].image?.x ?? 100)).toBeLessThan(scenes['split-left-image'].title?.x ?? 0)

    expect(signature(scenes['text-dominant'])).not.toEqual(signature(scenes['hero-overlay']))
    expect(signature(scenes['hero-overlay'])).not.toEqual(signature(scenes['image-top-stack']))
    expect(signature(scenes['image-top-stack'])).not.toEqual(signature(scenes['split-right-image']))
    expect(signature(scenes['split-left-image'])).not.toEqual(signature(scenes['split-right-image']))
    expect(signature(scenes['product-card-safe'])).not.toEqual(signature(scenes['split-right-image']))
  })

  it('applies spacing settings to split and image-top layouts without changing the selected mode shape', () => {
    const splitTight = buildScene(masterWithImage, 'vk-landscape', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      override: 'split-right-image',
      compositionSettings: { imageTextGap: 0.45 },
    })
    const splitWide = buildScene(masterWithImage, 'vk-landscape', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      override: 'split-right-image',
      compositionSettings: { imageTextGap: 1.8 },
    })
    const splitTightGap = (splitTight.image?.x ?? 0) - (splitTight.title ? splitTight.title.x + splitTight.title.w : 0)
    const splitWideGap = (splitWide.image?.x ?? 0) - (splitWide.title ? splitWide.title.x + splitWide.title.w : 0)

    expect(splitWideGap).toBeGreaterThanOrEqual(splitTightGap)
    expect(splitWide.image?.x ?? 0).toBeGreaterThan(splitWide.title?.x ?? 100)

    const stackTight = buildScene(masterWithImage, 'instagram-story', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      override: 'image-top-stack',
      compositionSettings: { imageTextGap: 0.45 },
    })
    const stackWide = buildScene(masterWithImage, 'instagram-story', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      override: 'image-top-stack',
      compositionSettings: { imageTextGap: 1.8 },
    })
    const stackTightGap = (stackTight.title?.y ?? 0) - ((stackTight.image?.y ?? 0) + (stackTight.image?.h ?? 0))
    const stackWideGap = (stackWide.title?.y ?? 0) - ((stackWide.image?.y ?? 0) + (stackWide.image?.h ?? 0))

    expect(stackWideGap).toBeGreaterThan(stackTightGap)
    expect(stackWide.image?.y ?? 100).toBeLessThan(stackWide.title?.y ?? 0)
  })
})

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
  it('strips generated gradients by default via demo-safe policy', () => {
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
    expect(scene.background.kind).toBe('solid')
  })

  it('preserves explicit gradients when gradientEnabled is true', () => {
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      gradientEnabled: true,
    })
    expect(scene.background).toEqual(DEFAULT_MASTER.background)
  })
})

describe('buildScene demo-safe layout policy', () => {
  const masterWithImage: Scene = {
    ...DEFAULT_MASTER,
    image: DEFAULT_MASTER.image ? { ...DEFAULT_MASTER.image, src: 'data:image/png;base64,policy' } : undefined,
  }

  it.each([
    ['vk-teaser-image-text-145x85', 'horizontal'],
    ['yandex-rsy-320x50', 'ultraWideHorizontal'],
    ['yandex-rsy-728x90', 'ultraWideHorizontal'],
    ['yandex-rsy-300x250', 'tinySmall'],
    ['vk-square', 'square'],
    ['instagram-story', 'vertical'],
    ['yandex-rsy-160x600', 'tallVertical'],
    ['yandex-rsy-300x600', 'tallVertical'],
  ] as const)('marks representative format %s as %s', (formatKey, expectedKind) => {
    const scene = buildScene(masterWithImage, formatKey, DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
    expect(scene.layoutPolicy?.formatKind).toBe(expectedKind)
    expect(scene.layoutPolicy?.source.type).toBe('heuristic')
    expect(scene.background.kind).not.toBe('gradient')
  })

  it('uses split-style placement for horizontal banners with meaningful image coverage', () => {
    for (const formatKey of ['yandex-rsy-728x90', 'yandex-rsy-300x250'] as const) {
      const scene = buildScene(masterWithImage, formatKey, DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
      expect(scene.image).toBeDefined()
      expect(scene.title).toBeDefined()
      expect(scene.image!.w).toBeGreaterThanOrEqual(24)
      expect(scene.image!.x).toBeGreaterThan(scene.title!.x)
      expect(scene.title!.w).toBeLessThanOrEqual(58)
      if (scene.cta) {
        expect(scene.cta.x).toBeGreaterThanOrEqual(scene.title!.x)
        expect(scene.image ? scene.cta.x + scene.cta.w : scene.cta.x).toBeLessThanOrEqual(scene.image ? scene.image.x : 100)
      }
    }
  })

  it('uses reduced content for tiny and micro formats', () => {
    for (const formatKey of ['yandex-rsy-300x250'] as const) {
      const scene = buildScene(masterWithImage, formatKey, DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
      expect(scene.subtitle).toBeUndefined()
      expect(scene.badge).toBeUndefined()
      expect(scene.decor).toBeUndefined()
      expect(scene.title?.maxLines).toBeLessThanOrEqual(2)
    }
  })

  it('keeps vertical formats in top or background image layouts with CTA attached to text', () => {
    for (const formatKey of ['instagram-story', 'yandex-rsy-160x600', 'yandex-rsy-300x600'] as const) {
      const scene = buildScene(masterWithImage, formatKey, DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
      expect(scene.image).toBeDefined()
      expect(scene.title).toBeDefined()
      expect(scene.image!.y).toBeLessThanOrEqual(scene.title!.y)
      if (scene.cta) {
        expect(scene.cta.x).toBeGreaterThanOrEqual(scene.title!.x - 0.01)
        expect(scene.cta.y).toBeGreaterThan(scene.title!.y)
      }
    }
  })

  it('keeps square formats balanced between image and text', () => {
    const scene = buildScene(masterWithImage, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
    expect(scene.image).toBeDefined()
    expect(scene.title).toBeDefined()
    expect(scene.image!.w).toBeGreaterThanOrEqual(32)
    expect(scene.title!.w).toBeLessThanOrEqual(72)
    if (scene.cta) expect(scene.cta.x).toBe(scene.title!.x)
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

  it('does not overwrite manual CTA width overrides with auto sizing', () => {
    const scene = buildScene(DEFAULT_MASTER, 'vk-square', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      blockOverrides: {
        cta: { w: 18, h: 7 },
      },
    })

    expect(scene.cta?.w).toBe(18)
    expect(scene.cta?.h).toBe(7)
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

    expect(subtitle.y - titleBottom).toBeGreaterThanOrEqual(format.gutter * 0.5)
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

    expect(subtitle.y - titleBottom).toBeGreaterThanOrEqual(format.gutter * 0.5)
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

describe('buildScene readability guard', () => {
  const imageHint = (luma: number, isDarkBackground = luma < 0.5): AssetHint => ({
    width: 1200,
    height: 1600,
    aspectRatio: 0.75,
    dominantColors: [isDarkBackground ? '#111827' : '#F8FAFC'],
    isDarkBackground,
    bottomBandBrightness: luma,
    brightnessGrid: Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => luma)),
  })

  it('uses light title text for a dark image/background', () => {
    const master: Scene = {
      ...DEFAULT_MASTER,
      background: { kind: 'solid', color: '#101214' },
      title: DEFAULT_MASTER.title ? { ...DEFAULT_MASTER.title, fill: '#0E1014' } : undefined,
      image: DEFAULT_MASTER.image ? { ...DEFAULT_MASTER.image, src: 'data:image/png;base64,dark' } : undefined,
    }
    const scene = buildScene(master, 'telegram-story', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      assetHint: imageHint(0.12, true),
      override: 'hero-overlay',
    })

    expect(scene.title?.fill).toBe('#FFFFFF')
  })

  it('keeps dark title text for a light image/background', () => {
    const master: Scene = {
      ...DEFAULT_MASTER,
      background: { kind: 'solid', color: '#F8FAFC' },
      title: DEFAULT_MASTER.title ? { ...DEFAULT_MASTER.title, fill: '#FFFFFF' } : undefined,
      image: DEFAULT_MASTER.image ? { ...DEFAULT_MASTER.image, src: 'data:image/png;base64,light' } : undefined,
    }
    const scene = buildScene(master, 'yandex-market-card', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      assetHint: imageHint(0.9, false),
      override: 'split-right-image',
    })

    expect(scene.title?.fill).toBe('#0E1014')
  })

  it('keeps CTA text readable against the CTA background', () => {
    const brand = {
      ...DEFAULT_BRAND_KIT,
      palette: { ...DEFAULT_BRAND_KIT.palette, accent: '#F2F4F7' },
    }
    const scene = buildScene(DEFAULT_MASTER, 'yandex-market-card', brand, DEFAULT_ENABLED)

    expect(scene.cta).toBeDefined()
    expect(contrastRatio(scene.cta!.fill, scene.cta!.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('generates focused export formats without throwing', () => {
    const formats = [
      'telegram-story',
      'instagram-story',
      'vk-stories',
      'avito-fullscreen',
      'yandex-market-card',
      'avito-listing',
    ] as const
    const master: Scene = {
      ...DEFAULT_MASTER,
      image: DEFAULT_MASTER.image ? { ...DEFAULT_MASTER.image, src: 'data:image/png;base64,export' } : undefined,
    }

    for (const format of formats) {
      const scene = buildScene(master, format, DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
        assetHint: imageHint(0.18, true),
      })
      expect(scene.title).toBeDefined()
      expect(scene.cta).toBeDefined()
    }
  })
})
