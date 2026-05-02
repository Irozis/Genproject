import { describe, it, expect } from 'vitest'
import { chooseModel, profile, LAYOUTS } from '../composition'
import { getFormat } from '../formats'
import { DEFAULT_MASTER, DEFAULT_ENABLED } from '../defaults'
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
    }
    expect(chooseModel(p)).toBe('split-right-image')
  })

  it('returns image-top-text-bottom for portrait formats', () => {
    for (const fmt of ['vk-vertical', 'instagram-story'] as const) {
      const rules = getFormat(fmt)
      const p = profile(masterWithImage, rules, DEFAULT_ENABLED)
      expect(chooseModel(p)).toBe('image-top-text-bottom')
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
      'hero-overlay',
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

  it('728x90 banner keeps content in one horizontal row', () => {
    const rules = getFormat('yandex-rsy-728x90')
    const result = LAYOUTS['split-right-image'](masterWithImage, rules, DEFAULT_ENABLED)

    expect(result.title?.maxLines).toBe(1)
    expect(result.subtitle?.maxLines).toBe(1)
    expect(result.cta?.x).toBeGreaterThan((result.title?.x ?? 0) + (result.title?.w ?? 0))
    expect(result.image?.x).toBeGreaterThan(result.cta?.x ?? 0)
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
