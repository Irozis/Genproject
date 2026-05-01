import { describe, it, expect } from 'vitest'
import { checkOverflow, fixLayout } from '../fixLayout'
import { getFormat } from '../formats'
import type { CtaBlock, Scene, TextBlock } from '../types'

const baseScene: Scene = {
  background: { kind: 'gradient', stops: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] },
  accent: '#FF0000',
  title: {
    text: 'Hello',
    x: 6, y: 10, w: 50,
    fontSize: 7, charsPerLine: 18, maxLines: 3,
    weight: 800, fill: '#000000',
  },
}

describe('fixLayout — safe zone clamping', () => {
  it('clamps a block that starts before safe zone left', () => {
    const rules = getFormat('vk-square') // safeZone.left = 6
    const scene: Scene = {
      ...baseScene,
      title: { ...baseScene.title!, x: -5, y: 10, w: 50 },
    }
    const fixed = fixLayout(scene, rules)
    expect(fixed.title?.x).toBeGreaterThanOrEqual(rules.safeZone.left)
  })

  it('clamps a block that starts above safe zone top', () => {
    const rules = getFormat('vk-square') // safeZone.top = 6
    const scene: Scene = {
      ...baseScene,
      title: { ...baseScene.title!, x: 6, y: -10, w: 50 },
    }
    const fixed = fixLayout(scene, rules)
    expect(fixed.title?.y).toBeGreaterThanOrEqual(rules.safeZone.top)
  })

  it('trims width that overflows safe zone right', () => {
    const rules = getFormat('vk-square')
    const scene: Scene = {
      ...baseScene,
      title: { ...baseScene.title!, x: 6, y: 10, w: 200 },
    }
    const fixed = fixLayout(scene, rules)
    const maxRight = 100 - rules.safeZone.right
    expect((fixed.title?.x ?? 0) + (fixed.title?.w ?? 0)).toBeLessThanOrEqual(maxRight + 0.01)
  })

  it('preserves a block already within safe zone', () => {
    const rules = getFormat('vk-square')
    const fixed = fixLayout(baseScene, rules)
    expect(fixed.title?.x).toBe(baseScene.title!.x)
    expect(fixed.title?.y).toBe(baseScene.title!.y)
  })
})

describe('fixLayout — contrast check', () => {
  it('changes white title on white background to black', () => {
    const rules = getFormat('vk-square')
    const scene: Scene = {
      background: { kind: 'gradient', stops: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] },
      accent: '#000000',
      title: { ...baseScene.title!, fill: '#FFFFFF' },
    }
    const fixed = fixLayout(scene, rules)
    // White on white is low contrast → should invert to dark
    expect(fixed.title?.fill).toBe('#111111')
  })

  it('leaves dark title on white background unchanged', () => {
    const rules = getFormat('vk-square')
    const scene: Scene = {
      background: { kind: 'gradient', stops: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] },
      accent: '#FF0000',
      title: { ...baseScene.title!, fill: '#000000' },
    }
    const fixed = fixLayout(scene, rules)
    expect(fixed.title?.fill).toBe('#000000')
  })

  it('also fixes low-contrast subtitle fill', () => {
    const rules = getFormat('vk-square')
    const scene: Scene = {
      background: { kind: 'gradient', stops: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] },
      accent: '#000000',
      subtitle: {
        text: 'Sub',
        x: 8, y: 16, w: 60,
        fontSize: 3, charsPerLine: 24, maxLines: 2,
        weight: 400, fill: '#F8F8F8',
      },
    }
    const fixed = fixLayout(scene, rules)
    expect(fixed.subtitle?.fill).toBe('#111111')
  })

  it('inverts to white on dark solid background', () => {
    const rules = getFormat('vk-square')
    const scene: Scene = {
      background: { kind: 'solid', color: '#000000' },
      accent: '#FFFFFF',
      title: { ...baseScene.title!, fill: '#111111' },
    }
    const fixed = fixLayout(scene, rules)
    expect(fixed.title?.fill).toBe('#FFFFFF')
  })

  it('reads approx bg color for tonal and split backgrounds', () => {
    const rules = getFormat('vk-square')
    const tonal: Scene = {
      background: { kind: 'tonal', base: '#111111' },
      accent: '#FFFFFF',
      title: { ...baseScene.title!, fill: '#0A0A0A' },
    }
    expect(fixLayout(tonal, rules).title?.fill).toBe('#FFFFFF')

    const split: Scene = {
      background: { kind: 'split', a: '#FFFFFF', b: '#111111', angle: 0 },
      accent: '#000000',
      title: { ...baseScene.title!, fill: '#F0F0F0' },
    }
    expect(fixLayout(split, rules).title?.fill).toBe('#111111')
  })
})

describe('fixLayout — text font fitting', () => {
  it('shrinks text block fontSize when content overflows bounds', () => {
    const rules = getFormat('vk-square')
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#000000',
      title: {
        text: 'Very long title that should not fit inside a tiny text rectangle',
        x: 10, y: 10, w: 14, h: 6,
        fontSize: 10, charsPerLine: 18, maxLines: 2,
        weight: 800, fill: '#111111',
      },
    }
    const fixed = fixLayout(scene, rules)
    expect((fixed.title?.fontSize ?? 0)).toBeLessThan(scene.title!.fontSize)
    expect((fixed.title?.fontSize ?? 0) * rules.width / 100).toBeGreaterThanOrEqual(12)
  })
})

describe('fixLayout — preserves scene-level extras', () => {
  it('copies scrim and decor through unchanged', () => {
    const rules = getFormat('vk-square')
    const scene: Scene = {
      ...baseScene,
      scrim: { y: 50, h: 50, color: '#000000', opacity: 0.4 },
      decor: { kind: 'diagonal-stripe', color: '#FF0000', opacity: 0.2 },
    }
    const fixed = fixLayout(scene, rules)
    expect(fixed.scrim).toEqual(scene.scrim)
    expect(fixed.decor).toEqual(scene.decor)
  })

  it('clamps logo and image blocks too', () => {
    const rules = getFormat('vk-square')
    const scene: Scene = {
      ...baseScene,
      logo: { x: -5, y: -5, w: 200, h: 10, src: null, bgOpacity: 1 },
      image: {
        x: 120, y: 120, w: 40, h: 40,
        src: null, rx: 0, fit: 'cover',
      },
    }
    const fixed = fixLayout(scene, rules)
    expect(fixed.logo?.x).toBeGreaterThanOrEqual(rules.safeZone.left)
    expect(fixed.logo?.y).toBeGreaterThanOrEqual(rules.safeZone.top)
    expect(fixed.image?.x).toBeLessThan(100 - rules.safeZone.right)
    expect(fixed.image?.y).toBeLessThan(100 - rules.safeZone.bottom)
  })
})

// ---------------------------------------------------------------------------
// checkOverflow — diagnostic coverage
// ---------------------------------------------------------------------------

const textDefaults: Omit<TextBlock, 'x' | 'y' | 'w' | 'text'> = {
  fontSize: 7, charsPerLine: 18, maxLines: 3, weight: 800, fill: '#111111',
}

const ctaDefaults: Omit<CtaBlock, 'x' | 'y' | 'w' | 'text'> = {
  ...textDefaults, bg: '#FF0000', rx: 12,
}

describe('checkOverflow', () => {
  const rules = getFormat('vk-square') // safeZone 6/6/6/6
  const cleanBg: Scene['background'] = { kind: 'gradient', stops: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] }

  it('returns no issues for a healthy scene', () => {
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title: { ...textDefaults, x: 10, y: 10, w: 60, h: 10, text: 'Hi' },
    }
    expect(checkOverflow(scene, rules)).toEqual([])
  })

  it('flags crossing left safe area', () => {
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title: { ...textDefaults, x: 2, y: 10, w: 50, h: 10, text: 'Hi' },
    }
    const issues = checkOverflow(scene, rules)
    expect(issues.some((i) => /left/.test(i.message))).toBe(true)
  })

  it('flags crossing right safe area', () => {
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title: { ...textDefaults, x: 60, y: 10, w: 50, h: 10, text: 'Hi' },
    }
    const issues = checkOverflow(scene, rules)
    expect(issues.some((i) => /right/.test(i.message))).toBe(true)
  })

  it('flags crossing top safe area', () => {
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title: { ...textDefaults, x: 10, y: 1, w: 50, h: 10, text: 'Hi' },
    }
    const issues = checkOverflow(scene, rules)
    expect(issues.some((i) => /top/.test(i.message))).toBe(true)
  })

  it('flags below-fold block', () => {
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      cta: { ...ctaDefaults, x: 10, y: 95, w: 30, h: 10, text: 'Buy' },
    }
    const issues = checkOverflow(scene, rules)
    expect(issues.some((i) => /below fold/.test(i.message))).toBe(true)
  })

  it('flags likely-truncated text when length >> capacity', () => {
    const long = 'x'.repeat(200)
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title: { ...textDefaults, x: 10, y: 10, w: 60, h: 10, text: long, charsPerLine: 10, maxLines: 2 },
    }
    const issues = checkOverflow(scene, rules)
    expect(issues.some((i) => /truncated/.test(i.message))).toBe(true)
  })

  it('flags overlap between title and subtitle', () => {
    const box = { x: 10, w: 60, h: 10 }
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title: { ...textDefaults, ...box, y: 20, text: 'a' },
      subtitle: { ...textDefaults, ...box, y: 22, text: 'b' },
    }
    const issues = checkOverflow(scene, rules)
    expect(issues.some((i) => /overlaps/.test(i.message))).toBe(true)
  })

  it('flags low contrast on title and subtitle independently', () => {
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title:    { ...textDefaults, x: 10, y: 10, w: 60, h: 10, text: 'a', fill: '#FDFDFD' },
      subtitle: { ...textDefaults, x: 10, y: 30, w: 60, h: 10, text: 'b', fill: '#F2F2F2' },
    }
    const issues = checkOverflow(scene, rules)
    const lowContrast = issues.filter((i) => /low contrast/.test(i.message))
    expect(lowContrast.length).toBeGreaterThanOrEqual(2)
  })

  it('ignores truncation check when text is empty', () => {
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title: { ...textDefaults, x: 10, y: 10, w: 60, h: 10, text: '   ' },
    }
    const issues = checkOverflow(scene, rules)
    expect(issues.some((i) => /truncated/.test(i.message))).toBe(false)
  })

  it('estimates height from fontSize when h is missing', () => {
    // fontSize 30 × lineHeight 1.2 × 3 lines = 108% — definitely below fold.
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title: { ...textDefaults, x: 10, y: 10, w: 60, text: 'x', fontSize: 30 },
    }
    const issues = checkOverflow(scene, rules)
    expect(issues.some((i) => /below fold/.test(i.message))).toBe(true)
  })

  it('fixLayout reduces warnings for below-fold + low-contrast scene', () => {
    const scene: Scene = {
      background: cleanBg, accent: '#000',
      title: { ...textDefaults, x: 10, y: 92, w: 60, text: 'Title', fill: '#FAFAFA' },
      subtitle: { ...textDefaults, x: 10, y: 93, w: 60, text: 'Subtitle', fill: '#F5F5F5' },
    }
    const before = checkOverflow(scene, rules).length
    const fixed = fixLayout(scene, rules)
    const after = checkOverflow(fixed, rules).length
    expect(after).toBeLessThan(before)
  })
})
