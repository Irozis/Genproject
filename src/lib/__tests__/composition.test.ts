import { describe, it, expect } from 'vitest'
import { chooseModel, profile, LAYOUTS } from '../composition'
import { getFormat } from '../formats'
import { DEFAULT_MASTER, DEFAULT_ENABLED } from '../defaults'
import type { EnabledMap, Scene } from '../types'

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
    const rules = getFormat('marketplace-card')
    const enabled: EnabledMap = { ...DEFAULT_ENABLED, image: false }
    const p = profile(masterWithImage, rules, enabled)
    expect(p.hasImage).toBe(false)
  })

  it('hasImage=false when image.src is null', () => {
    const rules = getFormat('marketplace-card')
    const p = profile(masterNoImage, rules, DEFAULT_ENABLED)
    expect(p.hasImage).toBe(false)
  })

  it('hasImage=true when image is enabled and has src', () => {
    const rules = getFormat('marketplace-card')
    const p = profile(masterWithImage, rules, DEFAULT_ENABLED)
    expect(p.hasImage).toBe(true)
  })

  it('isPortrait=true for story-vertical', () => {
    const rules = getFormat('story-vertical')
    const p = profile(masterNoImage, rules, DEFAULT_ENABLED)
    expect(p.isPortrait).toBe(true)
  })

  it('isPortrait=false for marketplace-card (1:1)', () => {
    const rules = getFormat('marketplace-card')
    const p = profile(masterNoImage, rules, DEFAULT_ENABLED)
    expect(p.isPortrait).toBe(false)
  })
})

describe('chooseModel', () => {
  it('returns text-dominant when no image', () => {
    const rules = getFormat('marketplace-card')
    const p = profile(masterNoImage, rules, DEFAULT_ENABLED)
    expect(chooseModel(p)).toBe('text-dominant')
  })

  it('returns text-dominant for any format when image disabled', () => {
    for (const fmt of ['marketplace-card', 'social-square', 'story-vertical'] as const) {
      const rules = getFormat(fmt)
      const enabled: EnabledMap = { ...DEFAULT_ENABLED, image: false }
      const p = profile(masterWithImage, rules, enabled)
      expect(chooseModel(p)).toBe('text-dominant')
    }
  })

  it('returns hero-overlay for square format when image is large', () => {
    const rules = getFormat('marketplace-card')
    const p = profile(masterWithImage, rules, DEFAULT_ENABLED)
    expect(chooseModel(p)).toBe('hero-overlay')
  })

  it('returns image-top-text-bottom for portrait formats', () => {
    for (const fmt of ['marketplace-highlight', 'story-vertical'] as const) {
      const rules = getFormat(fmt)
      const p = profile(masterWithImage, rules, DEFAULT_ENABLED)
      expect(chooseModel(p)).toBe('image-top-text-bottom')
    }
  })

  it('is deterministic — same profile → same model', () => {
    const rules = getFormat('social-square')
    const p1 = profile(masterWithImage, rules, DEFAULT_ENABLED)
    const p2 = profile(masterWithImage, rules, DEFAULT_ENABLED)
    expect(chooseModel(p1)).toBe(chooseModel(p2))
  })
})

describe('LAYOUTS', () => {
  it('each layout returns a scene with background', () => {
    const rules = getFormat('marketplace-card')
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
    const rules = getFormat('marketplace-card')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.scrim).toBeDefined()
    expect(result.scrim?.opacity).toBeGreaterThan(0)
  })

  it('image-top-text-bottom places image at top and CTA at bottom', () => {
    const rules = getFormat('story-vertical')
    const result = LAYOUTS['image-top-text-bottom'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.image?.y).toBe(0)
    // CTA is in the bottom half
    expect((result.cta?.y ?? 0)).toBeGreaterThan(50)
  })

  it('text-dominant does not place an image block', () => {
    const rules = getFormat('marketplace-card')
    const result = LAYOUTS['text-dominant'](masterWithImage, rules, DEFAULT_ENABLED)
    // text-dominant has no image in output (it doesn't call image placement)
    expect(result.image).toBeUndefined()
  })

  it('hero-overlay places image at full frame (x=0, y=0, w=100, h=100)', () => {
    const rules = getFormat('marketplace-card')
    const result = LAYOUTS['hero-overlay'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.image?.x).toBe(0)
    expect(result.image?.y).toBe(0)
    expect(result.image?.w).toBe(100)
    expect(result.image?.h).toBe(100)
  })

  it('split-right-image places image in right half (x >= 50)', () => {
    const rules = getFormat('marketplace-card')
    const result = LAYOUTS['split-right-image'](masterWithImage, rules, DEFAULT_ENABLED)
    expect(result.image?.x).toBeGreaterThanOrEqual(50)
  })
})
