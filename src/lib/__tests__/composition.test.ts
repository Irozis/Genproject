import { describe, it, expect } from 'vitest'
import { chooseLayoutArchetype, chooseModel, isCompactTextFormat, profile, LAYOUTS } from '../composition'
import { buildScene } from '../buildScene'
import { getFormat } from '../formats'
import { DEFAULT_MASTER, DEFAULT_ENABLED, DEFAULT_BRAND_KIT } from '../defaults'
import type { AssetHint, EnabledMap, Scene } from '../types'

// Helpers for the smart-anchor tests below. We only ever care about
// `brightnessGrid` and `bottomBandBrightness`, but AssetHint requires a
// few more fields — fill them with neutral values so the layout still
// behaves like there's a real image attached.
function hintWithGrid(grid: number[][], bottomBand = 0.5): AssetHint {
  return {
    width: 1080,
    height: 1080,
    aspectRatio: 1,
    dominantColors: ['#777777'],
    isDarkBackground: false,
    bottomBandBrightness: bottomBand,
    brightnessGrid: grid,
  }
}

function fontPx(fontSize: number, formatKey: Parameters<typeof getFormat>[0]): number {
  return (fontSize / 100) * getFormat(formatKey).width
}

// Master without an image src (src is null → hasImage = false)
const masterNoImage: Scene = {
  ...DEFAULT_MASTER,
  image: DEFAULT_MASTER.image ? { ...DEFAULT_MASTER.image, src: null } : undefined,
}

// Master with a fake image src
const masterWithImage: Scene = {
  ...DEFAULT_MASTER,
  image: { x: 50, y: 8, w: 44, h: 84, src: 'data:image/png;base64,abc', rx: 16, fit: 'cover' },
}

describe('profile', () => {
  it('hasImage=false when image is disabled', () => {
    const rules = getFormat('vk-square')
    const enabled: EnabledMap = { ...DEFAULT_ENABLED, image: false }
    const p = profile(masterWithImage, rules, enabled)
    expect(p.hasImage).toBe(false)
  })

  it('hasImage=false when image.src is null', () => {
    const rules = getFormat('vk-square')
    const p = profile(masterNoImage, rules, DEFAULT_ENABLED)
    expect(p.hasImage).toBe(false)
  })

  it('hasImage=true when image is enabled and has src', () => {
    const rules = getFormat('vk-square')
    const p = profile(masterWithImage, rules, DEFAULT_ENABLED)
    expect(p.hasImage).toBe(true)
  })

  it('isPortrait=true for instagram-story', () => {
    const rules = getFormat('instagram-story')
    const p = profile(masterNoImage, rules, DEFAULT_ENABLED)
    expect(p.isPortrait).toBe(true)
  })

  it('isPortrait=false for vk-square (1:1)', () => {
    const rules = getFormat('vk-square')
    const p = profile(masterNoImage, rules, DEFAULT_ENABLED)
    expect(p.isPortrait).toBe(false)
  })
})

describe('chooseModel', () => {
  it('returns text-dominant when no image', () => {
    const rules = getFormat('vk-square')
    const p = profile(masterNoImage, rules, DEFAULT_ENABLED)
    expect(chooseModel(p)).toBe('text-dominant')
  })

  it('returns text-dominant for any format when image disabled', () => {
    for (const fmt of ['vk-square', 'vk-landscape', 'instagram-story'] as const) {
      const rules = getFormat(fmt)
      const enabled: EnabledMap = { ...DEFAULT_ENABLED, image: false }
      const p = profile(masterWithImage, rules, enabled)
      expect(chooseModel(p)).toBe('text-dominant')
    }
  })

  it('returns hero-overlay for square format when image is large', () => {
    const rules = getFormat('vk-square')
    const p = profile(masterWithImage, rules, DEFAULT_ENABLED)
    expect(chooseModel(p)).toBe('hero-overlay')
  })

  it('returns split-right-image for horizontal formats', () => {
    const p = {
      hasImage: true,
      imageIsLarge: true,
      isPortrait: false,
      isWide: true,
      textDensity: 'medium',
      hasSubtitle: true,
      hasCTA: true,
      ctaLength: 8,
      hasBadge: false,
      imageImportance: 'medium',
      totalEnabledBlocks: 4,
    } as const
    expect(chooseModel(p)).toBe('split-right-image')
  })

  it('returns image-top-text-bottom for portrait formats', () => {
    for (const fmt of ['vk-vertical', 'instagram-story'] as const) {
      const rules = getFormat(fmt)
      const p = profile(masterWithImage, rules, DEFAULT_ENABLED)
      expect(chooseModel(p)).toBe('image-top-stack')
    }
  })

  it('is deterministic — same profile → same model', () => {
    const rules = getFormat('vk-square')
    const p1 = profile(masterWithImage, rules, DEFAULT_ENABLED)
    const p2 = profile(masterWithImage, rules, DEFAULT_ENABLED)
    expect(chooseModel(p1)).toBe(chooseModel(p2))
  })
})

describe('LAYOUTS', () => {
  it('each layout returns a scene with background', () => {
    const rules = getFormat('vk-square')
    for (const model of [
      'text-dominant',
      'split-right-image',
      'split-left-image',
      'hero-overlay',
      'image-top-stack',
      'centered-card',
      'image-top-text-bottom',
    ] as const) {
      const result = LAYOUTS[model](masterWithImage, rules, DEFAULT_ENABLED)
      expect(result.background).toBeDefined()
      expect(result.background.kind).toBeDefined()
    }
  })

  it('hero-overlay attaches a scrim for text contrast', () => {
    const rules = getFormat('vk-square')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.scrim).toBeDefined()
    expect(result.scrim?.opacity).toBeGreaterThan(0)
  })

  it('image-top-text-bottom places image at top and CTA at bottom', () => {
    const rules = getFormat('instagram-story')
    const result = LAYOUTS['image-top-text-bottom'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.image?.y).toBe(0)
    // CTA is in the bottom half
    expect((result.cta?.y ?? 0)).toBeGreaterThan(50)
  })

  it('text-dominant does not place an image block', () => {
    const rules = getFormat('vk-square')
    const result = LAYOUTS['text-dominant'](masterWithImage, rules, DEFAULT_ENABLED)
    // text-dominant has no image in output (it doesn't call image placement)
    expect(result.image).toBeUndefined()
  })

  it('hero-overlay places image at full frame (x=0, y=0, w=100, h=100)', () => {
    const rules = getFormat('vk-square')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.image?.x).toBe(0)
    expect(result.image?.y).toBe(0)
    expect(result.image?.w).toBe(100)
    expect(result.image?.h).toBe(100)
  })

  it('split-right-image places image in right half (x >= 50)', () => {
    const rules = getFormat('vk-square')
    const result = LAYOUTS['split-right-image'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.image?.x).toBeGreaterThanOrEqual(50)
  })

  it('avito split layout keeps product photos fully visible', () => {
    const rules = getFormat('avito-listing')
    const result = LAYOUTS['split-right-image'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.image?.fit).toBe('contain')
  })

  it('300x250 banner uses a compact split layout', () => {
    const rules = getFormat('yandex-rsy-300x250')
    const result = LAYOUTS['split-right-image'](masterWithImage, rules, DEFAULT_ENABLED)

    expect(result.title?.maxLines).toBe(2)
    expect(result.image?.x).toBeGreaterThanOrEqual(55)
    expect(result.cta?.y).toBeGreaterThan(result.subtitle?.y ?? 0)
    expect(result.cta?.w).toBeGreaterThanOrEqual(40)
  })

  it('728x90 banner keeps all core content in a compact horizontal layout', () => {
    const rules = getFormat('yandex-rsy-728x90')
    const result = LAYOUTS['split-right-image'](masterWithImage, rules, DEFAULT_ENABLED)

    expect(result.title?.maxLines).toBe(1)
    expect(result.subtitle).toBeDefined()
    expect(result.subtitle?.maxLines).toBe(1)
    expect(result.cta?.x).toBeGreaterThan((result.title?.x ?? 0) + (result.title?.w ?? 0))
    expect(result.image?.x).toBeLessThan(result.title?.x ?? 100)
  })

  it('avito skyscraper uses a dedicated listing-style vertical layout', () => {
    const rules = getFormat('avito-skyscraper')
    const result = LAYOUTS['image-top-text-bottom'](masterWithImage, rules, DEFAULT_ENABLED)

    expect(result.image?.x).toBe(rules.safeZone.left)
    expect(result.image?.fit).toBe('contain')
    expect(result.title?.maxLines).toBeLessThanOrEqual(2)
    expect(result.cta?.w).toBeGreaterThanOrEqual(65)
  })

  it('story CTA bottom edge stays inside the platform thumb-zone', () => {
    // VK story safeZone.bottom = 14% (so without anchor CTA bottom would be
    // at y=86%). The platform anchor keeps it near the lower action zone.
    const rules = getFormat('vk-stories')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED)
    const ctaBottom = (result.cta?.y ?? 0) + (result.cta?.h ?? 0)
    expect(ctaBottom).toBeLessThanOrEqual(87.5)
    expect(ctaBottom).toBeGreaterThan(80)
  })

  it('hero-overlay defaults to a bottom-anchored stack without a hint', () => {
    // No image hint → no subject info → keep the legacy bottom-anchor.
    // Title+subtitle+CTA all live in the lower 60% of the canvas.
    const rules = getFormat('vk-square')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.title!.y).toBeGreaterThan(40)
    expect(result.scrim?.direction ?? 'down').toBe('down')
  })

  it('hero-overlay flips to top anchor when bottom is busy and top is calm', () => {
    // brightnessGrid: top half is uniform (low contrast), bottom half is a
    // checkerboard (high contrast). regionContrast should detect the bottom
    // as subject-laden and flip the stack up.
    const hint = hintWithGrid([
      [0.5, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
      [0.05, 0.95, 0.05, 0.95],
      [0.95, 0.05, 0.95, 0.05],
    ])
    const rules = getFormat('vk-square')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED, hint)
    // Title now sits in the upper half of the canvas.
    expect(result.title!.y).toBeLessThan(30)
    expect(result.scrim?.direction).toBe('up')
  })

  it('hero-overlay split-anchors story formats when bottom is busy', () => {
    // For story formats (CTA must stay near the thumb-zone) the layout
    // splits: title+subtitle climb to the top, CTA stays at the bottom.
    const hint = hintWithGrid([
      [0.5, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
      [0.05, 0.95, 0.05, 0.95],
      [0.95, 0.05, 0.95, 0.05],
    ])
    const rules = getFormat('instagram-story')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED, hint)
    expect(result.title!.y).toBeLessThan(30)
    // CTA bottom stays in the lower action zone for IG.
    const ctaBottom = (result.cta?.y ?? 0) + (result.cta?.h ?? 0)
    expect(ctaBottom).toBeLessThanOrEqual(86.5)
    expect(ctaBottom).toBeGreaterThan(80)
  })

  it('hero-overlay keeps story CTA on the left instead of drifting into the image center', () => {
    // Realistic story photo: calm sky on top half; cat silhouette on the
    // left (uniformly dark), bright snow gap in the middle, bright snow on
    // the right too. The CTA default `left` slot would land on top of the
    // cat. We expect smart-anchor to flip the stack to split (subjects in
    // the bottom band), then smart CTA-X to slide the button toward the
    // calmer middle/right slot — anywhere off the silhouette is a win.
    const hint = hintWithGrid([
      [0.5, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
      [0.15, 0.15, 0.85, 0.85],
      [0.15, 0.15, 0.85, 0.85],
    ])
    const rules = getFormat('instagram-story')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED, hint)
    // Smart-anchor flipped to split (title at top).
    expect(result.title!.y).toBeLessThan(30)
    // Story CTA keeps a stable ad-like position. We don't let image scoring
    // move it into the center of the frame.
    expect(result.cta!.x).toBeCloseTo(rules.safeZone.left, 1)
  })

  it('hero-overlay keeps CTA on the left when both sides are similarly busy', () => {
    // Bottom band busy on both halves equally. The default left position
    // wins because hysteresis (Δ ≥ 0.10) blocks low-confidence flips.
    const hint = hintWithGrid([
      [0.5, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
      [0.05, 0.95, 0.05, 0.95],
      [0.95, 0.05, 0.95, 0.05],
    ])
    const rules = getFormat('instagram-story')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED, hint)
    expect(result.cta!.x).toBeCloseTo(rules.safeZone.left, 1)
  })

  it('hero-overlay always halos the subtitle in top/split mode', () => {
    // In bottom mode the subtitle halo follows haloForBrightness threshold;
    // in top/split mode we always provide at least a subtle halo so body
    // copy stays readable on snow / sky / mid-luminance noise.
    const hint = hintWithGrid([
      [0.5, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
      [0.05, 0.95, 0.05, 0.95],
      [0.95, 0.05, 0.95, 0.05],
    ])
    const rules = getFormat('vk-square')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED, hint)
    expect(result.subtitle!.halo).toBeDefined()
    expect((result.subtitle!.halo!.opacity ?? 0)).toBeGreaterThan(0)
  })

  it('hero-overlay flips to split on tall portraits when the stack would creep past 58%', () => {
    // No image hint, but the master title is multi-line — projected
    // bottom-mode titleY would land in the upper-middle (~51–57% on
    // 9:16) where the photo subject lives. The tall-portrait floor
    // forces split: title at the top, CTA pinned to the thumb-zone,
    // middle clear for the image. Even without any contrast signal.
    const rules = getFormat('vk-stories')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.title!.y).toBeLessThan(30)
    const ctaBottom = (result.cta?.y ?? 0) + (result.cta?.h ?? 0)
    expect(ctaBottom).toBeGreaterThan(60)
    expect(ctaBottom).toBeLessThanOrEqual(87.5)
    expect(result.scrim?.direction).toBe('up')
  })

  it('hero-overlay keeps story copy out of the center even when the copy is short', () => {
    // Single-line title + no subtitle would fit at the bottom, but story
    // formats reserve the image center for the subject/product. The title
    // stays near the top and CTA stays near the lower action zone.
    const sceneShort: Scene = {
      ...masterWithImage,
      title: { ...masterWithImage.title!, text: 'Лето', maxLines: 1 },
      subtitle: undefined,
    }
    const rules = getFormat('instagram-story')
    const result = LAYOUTS['hero-overlay'](sceneShort, rules, DEFAULT_ENABLED)
    expect(result.title!.y).toBeLessThan(25)
    const ctaBottom = (result.cta?.y ?? 0) + (result.cta?.h ?? 0)
    expect(ctaBottom).toBeGreaterThan(80)
    expect(result.scrim?.direction).toBe('up')
  })

  it('hero-overlay keeps bottom anchor when both bands are similarly busy', () => {
    // Both bands have the same level of subject mass. Hysteresis keeps the
    // stack at the bottom — we don't flip on noise.
    const hint = hintWithGrid([
      [0.05, 0.95, 0.05, 0.95],
      [0.95, 0.05, 0.95, 0.05],
      [0.05, 0.95, 0.05, 0.95],
      [0.95, 0.05, 0.95, 0.05],
    ])
    const rules = getFormat('vk-square')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED, hint)
    expect(result.title!.y).toBeGreaterThan(40)
    expect(result.scrim?.direction ?? 'down').toBe('down')
  })
})

describe('chooseLayoutArchetype', () => {
  function select(scene: Scene, formatKey: Parameters<typeof getFormat>[0], hint?: AssetHint | null) {
    return chooseLayoutArchetype({
      format: getFormat(formatKey),
      scene,
      enabled: DEFAULT_ENABLED,
      assetHint: hint,
    })
  }

  it('wide + low text + strong image selects hero-overlay', () => {
    const scene: Scene = {
      ...masterWithImage,
      title: { ...masterWithImage.title!, text: 'Летняя распродажа', maxLines: 1 },
      subtitle: undefined,
      cta: undefined,
      badge: undefined,
      image: { ...masterWithImage.image!, w: 70, h: 70 },
    }
    const result = select(scene, 'vk-landscape', { ...hintWithGrid([[0.4]]), aspectRatio: 16 / 9 })

    expect(result.selected).toBe('hero-overlay')
    expect(result.selectionDebug.formatFamily).toBe('wide')
    expect(result.selectionDebug.textDensity).toBe('low')
  })

  it('square + medium text + image selects split archetype', () => {
    const scene: Scene = {
      ...masterWithImage,
      title: { ...masterWithImage.title!, text: 'Новая коллекция для дома' },
      subtitle: { ...masterWithImage.subtitle!, text: 'Практичные товары и готовые наборы для уютного сезона.' },
    }
    const result = select(scene, 'vk-square', { ...hintWithGrid([[0.5]]), aspectRatio: 1 })

    expect(['split-right-image', 'split-left-image']).toContain(result.selected)
  })

  it('dark square marketplace image can prioritize hero over split', () => {
    const scene: Scene = {
      ...masterWithImage,
      title: { ...masterWithImage.title!, text: '8 недель до сильной формы' },
      subtitle: { ...masterWithImage.subtitle!, text: 'Тренер, питание и еженедельные замеры в одной программе.' },
    }
    const result = select(scene, 'avito-listing', {
      ...hintWithGrid([[0.18, 0.2], [0.22, 0.18]], 0.22),
      isDarkBackground: true,
      aspectRatio: 4 / 3,
    })

    expect(result.selected).toBe('hero-overlay')
  })

  it('portrait + medium text + product image selects image-top-stack', () => {
    const scene: Scene = {
      ...masterWithImage,
      title: { ...masterWithImage.title!, text: 'Набор для ухода' },
      subtitle: { ...masterWithImage.subtitle!, text: 'Три средства в одном комплекте для ежедневного ухода.' },
    }
    const result = select(scene, 'wb-card', { ...hintWithGrid([[0.5]]), aspectRatio: 1 })

    expect(result.selected).toBe('image-top-stack')
  })

  it('high text density keeps an image layout when the image fits', () => {
    const scene: Scene = {
      ...masterWithImage,
      title: { ...masterWithImage.title!, text: 'Большой сезонный набор с подробным описанием преимуществ, условий доставки и ограниченного предложения' },
      subtitle: { ...masterWithImage.subtitle!, text: 'Подходит для маркетплейсов, социальных сетей, промо-баннеров и карточек товара с длинным описанием.' },
      badge: { ...masterWithImage.badge!, text: 'Только сегодня' },
    }
    const result = chooseLayoutArchetype({
      format: getFormat('vk-square'),
      scene,
      enabled: { ...DEFAULT_ENABLED, badge: true },
      assetHint: { ...hintWithGrid([[0.5]]), aspectRatio: 1 },
    })

    expect(result.selected).not.toBe('text-dominant')
  })

  it('missing image selects text-dominant', () => {
    const result = chooseLayoutArchetype({
      format: getFormat('vk-square'),
      scene: masterNoImage,
      enabled: DEFAULT_ENABLED,
      assetHint: null,
    })

    expect(result.selected).toBe('text-dominant')
  })

  it('strongly unsuitable image can fall back to text-dominant', () => {
    const result = select(masterWithImage, 'vk-landscape', {
      ...hintWithGrid([[0.5]]),
      aspectRatio: 5,
      objectBounds: { x: 0.01, y: 0.02, w: 0.98, h: 0.96 },
    })

    expect(result.selected).toBe('text-dominant')
    expect(result.selectionDebug.cropRisk).toBe('high')
  })

  it('left focal image prefers split-right-image', () => {
    const scene: Scene = {
      ...masterWithImage,
      image: { ...masterWithImage.image!, focalX: 0.2 },
      title: { ...masterWithImage.title!, text: 'Новая коллекция для дома' },
      subtitle: { ...masterWithImage.subtitle!, text: 'Практичные товары для уютного сезона.' },
    }
    const result = select(scene, 'vk-square', { ...hintWithGrid([[0.5]]), aspectRatio: 1 })

    expect(result.selected).toBe('split-right-image')
  })

  it('right focal image prefers split-left-image', () => {
    const scene: Scene = {
      ...masterWithImage,
      image: { ...masterWithImage.image!, focalX: 0.8 },
      title: { ...masterWithImage.title!, text: 'Новая коллекция для дома' },
      subtitle: { ...masterWithImage.subtitle!, text: 'Практичные товары для уютного сезона.' },
    }
    const result = select(scene, 'vk-square', { ...hintWithGrid([[0.5]]), aspectRatio: 1 })

    expect(result.selected).toBe('split-left-image')
  })

  it('yandex-rsy-728x90 keeps subtitle and readable title/CTA', () => {
    const decision = select(masterWithImage, 'yandex-rsy-728x90', { ...hintWithGrid([[0.5]]), aspectRatio: 1 })
    const scene = buildScene(masterWithImage, 'yandex-rsy-728x90', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      assetHint: { ...hintWithGrid([[0.5]]), aspectRatio: 1 },
    })

    expect(isCompactTextFormat('yandex-rsy-728x90')).toBe(true)
    expect(decision.selectionDebug.compactTextPolicyApplied).toBe(true)
    expect(decision.selectionDebug.subtitleHiddenForCompactFormat).toBe(false)
    expect(decision.selectionDebug.minFontGuardApplied).toBe(true)
    expect(decision.selectionDebug.smallTextRisk).not.toBe('low')
    expect(scene.subtitle).toBeDefined()
    expect(scene.image?.x).toBeLessThan(10)
    expect(scene.cta).toBeDefined()
    expect(fontPx(scene.title!.fontSize, 'yandex-rsy-728x90')).toBeGreaterThanOrEqual(13)
    expect(fontPx(scene.cta!.fontSize, 'yandex-rsy-728x90')).toBeGreaterThanOrEqual(11)
  })

  it('yandex-rsy-240x400 uses compact vertical policy', () => {
    const decision = select(masterWithImage, 'yandex-rsy-240x400', { ...hintWithGrid([[0.5]]), aspectRatio: 1 })
    const scene = buildScene(masterWithImage, 'yandex-rsy-240x400', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      assetHint: { ...hintWithGrid([[0.5]]), aspectRatio: 1 },
    })

    expect(decision.selectionDebug.compactTextPolicyApplied).toBe(true)
    expect(decision.selectionDebug.smallTextRiskPenalty).toBeGreaterThan(0)
    expect(scene.subtitle).toBeDefined()
    expect(scene.image?.y).toBeLessThan(10)
    expect(scene.image?.fit).toBe('contain')
    expect(scene.cta!.y).toBeGreaterThan(scene.title!.y)
    expect(fontPx(scene.title!.fontSize, 'yandex-rsy-240x400')).toBeGreaterThanOrEqual(14)
    expect(fontPx(scene.cta!.fontSize, 'yandex-rsy-240x400')).toBeGreaterThanOrEqual(11)
  })

  it('avito-skyscraper uses compact policy', () => {
    const decision = select(masterWithImage, 'avito-skyscraper', { ...hintWithGrid([[0.5]]), aspectRatio: 1 })
    const scene = buildScene(masterWithImage, 'avito-skyscraper', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      assetHint: { ...hintWithGrid([[0.5]]), aspectRatio: 1 },
    })

    expect(decision.selectionDebug.compactTextPolicyApplied).toBe(true)
    expect(scene.subtitle).toBeDefined()
    expect(scene.image?.fit).toBe('contain')
    expect(fontPx(scene.title!.fontSize, 'avito-skyscraper')).toBeGreaterThanOrEqual(17)
    expect(fontPx(scene.cta!.fontSize, 'avito-skyscraper')).toBeGreaterThanOrEqual(11)
  })

  it('yandex-market-stretch keeps subtitle while prioritizing title/CTA', () => {
    const decision = select(masterWithImage, 'yandex-market-stretch', { ...hintWithGrid([[0.5]]), aspectRatio: 1 })
    const scene = buildScene(masterWithImage, 'yandex-market-stretch', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      assetHint: { ...hintWithGrid([[0.5]]), aspectRatio: 1 },
    })

    expect(decision.selectionDebug.compactTextPolicyApplied).toBe(true)
    expect(scene.subtitle).toBeDefined()
    expect(scene.title?.maxLines).toBe(1)
    expect(scene.cta).toBeDefined()
    expect(fontPx(scene.title!.fontSize, 'yandex-market-stretch')).toBeGreaterThanOrEqual(18)
    expect(fontPx(scene.cta!.fontSize, 'yandex-market-stretch')).toBeGreaterThanOrEqual(14)
  })

  it.each(['vk-square', 'ozon-fresh-square', 'yandex-market-card'] as const)(
    '%s product card with objectBounds uses contain image fit',
    (formatKey) => {
      const hint: AssetHint = {
        ...hintWithGrid([[0.5]]),
        aspectRatio: 2.2,
        objectBounds: { x: 0.01, y: 0.18, w: 0.72, h: 0.62 },
      }
      const scene = buildScene(masterWithImage, formatKey, DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
        assetHint: hint,
      })

      expect(scene.image?.fit).toBe('contain')
      expect(scene.image?.x).toBeGreaterThan(10)
      expect(scene.image?.w).toBeLessThan(84)
    },
  )

  it('yandex-rsy-300x250 product card with objectBounds uses contain image fit', () => {
    const hint: AssetHint = {
      ...hintWithGrid([[0.5]]),
      aspectRatio: 2.2,
      objectBounds: { x: 0.01, y: 0.18, w: 0.72, h: 0.62 },
    }
    const scene = buildScene(masterWithImage, 'yandex-rsy-300x250', DEFAULT_BRAND_KIT, DEFAULT_ENABLED, {
      assetHint: hint,
    })

    expect(scene.image?.fit).toBe('contain')
    expect(scene.image?.x).toBeGreaterThan(8)
    expect(scene.image?.w).toBeLessThan(82)
  })

  it('vk-square with high crop risk prefers product-safe over tight split', () => {
    const result = select(masterWithImage, 'vk-square', {
      ...hintWithGrid([[0.5]]),
      aspectRatio: 2.4,
      objectBounds: { x: 0.82, y: 0.12, w: 0.17, h: 0.7 },
    })

    expect(['product-card-safe', 'image-top-stack']).toContain(result.selected)
    expect(['split-right-image', 'split-left-image']).not.toContain(result.selected)
    expect(result.selectionDebug.cropRiskPenalty).toBeGreaterThan(0)
  })

  it('selector remains deterministic with compact/product penalties', () => {
    const hint: AssetHint = {
      ...hintWithGrid([[0.5]]),
      aspectRatio: 2.4,
      objectBounds: { x: 0.82, y: 0.12, w: 0.17, h: 0.7 },
    }
    const a = select(masterWithImage, 'vk-square', hint)
    const b = select(masterWithImage, 'vk-square', hint)

    expect(a).toEqual(b)
    expect(a.selectionDebug.selectedArchetype).toBe(a.selected)
    expect(a.selectionDebug.scores).toEqual(a.selectionDebug.archetypeScores)
  })
})
