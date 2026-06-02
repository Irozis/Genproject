import { describe, expect, it } from 'vitest'
import { buildScene } from '../buildScene'
import { checkOverflow } from '../fixLayout'
import { DEFAULT_ENABLED } from '../defaults'
import type { BlockKind, Scene } from '../types'
import {
  assetHintFromAnalysis,
  minimalTestFormats,
  testBrandLight,
  testContentLong,
  testContentWithImageHorizontal,
  testImageAnalysisHorizontal,
} from '../../test/fixtures'

const importantBlocks: BlockKind[] = ['title', 'subtitle', 'cta', 'badge', 'logo', 'image']

describe('layout generator for critical fixture formats', () => {
  for (const format of minimalTestFormats) {
    it(`creates bounded scene blocks for ${format.width}x${format.height}`, () => {
      const scene = buildScene(testContentLong, format.key, testBrandLight, DEFAULT_ENABLED, {
        customFormats: minimalTestFormats,
      })

      expect(scene.background).toBeDefined()
      for (const block of blocks(scene)) {
        expect(Number.isFinite(block.x)).toBe(true)
        expect(Number.isFinite(block.y)).toBe(true)
        expect(Number.isFinite(block.w)).toBe(true)
        expect(Number.isFinite(block.h ?? 0)).toBe(true)
        expect(block.x).toBeGreaterThanOrEqual(-0.5)
        expect(block.y).toBeGreaterThanOrEqual(-0.5)
        expect(block.x + block.w).toBeLessThanOrEqual(100.5)
        expect(block.y + (block.h ?? 0)).toBeLessThanOrEqual(100.5)
      }
    })
  }

  it('keeps headline and CTA inside safe area for compact horizontal formats', () => {
    for (const format of minimalTestFormats.filter((item) => item.height <= 100)) {
      const scene = buildScene(testContentLong, format.key, testBrandLight, DEFAULT_ENABLED, {
        customFormats: minimalTestFormats,
      })
      const messages = checkOverflow(scene, format)
        .filter((issue) => issue.block === 'title' || issue.block === 'cta')
        .map((issue) => issue.message)

      expect(messages.filter((message) => /safe area|outside visible area/.test(message))).toEqual([])
      if (scene.cta) {
        const ctaHeightPx = ((scene.cta.h ?? 0) / 100) * format.height
        expect(ctaHeightPx).toBeLessThanOrEqual(Math.max(44, format.height * 0.68))
      }
    }
  })

  it('does not let CTA overlap headline or body in generated layouts', () => {
    for (const format of minimalTestFormats.filter((item) => item.aspectRatio < 4)) {
      const scene = buildScene(testContentLong, format.key, testBrandLight, DEFAULT_ENABLED, {
        customFormats: minimalTestFormats,
      })
      const messages = checkOverflow(scene, format).map((issue) => issue.message)

      expect(messages.some((message) => /Cta overlaps Title|Cta overlaps Subtitle|Title overlaps Cta|Subtitle overlaps Cta/.test(message))).toBe(false)
    }
  })

  it('uses image-aware layouts without placing large hero images into micro banners', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    for (const format of minimalTestFormats) {
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
      })
      if (!scene.image) continue
      const imageArea = scene.image.w * (scene.image.h ?? 0)
      if (format.height <= 100) expect(imageArea).toBeLessThan(4200)
      if (format.aspectRatio > 2) expect(scene.image.w).toBeLessThanOrEqual(68)
      if (format.aspectRatio < 0.8) expect(scene.image.h ?? 0).toBeLessThanOrEqual(72)
    }
  })

  it('keeps text and CTA out of image region when logo is disabled', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    for (const format of minimalTestFormats.filter((item) => item.aspectRatio >= 2.2 || item.aspectRatio < 0.9)) {
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true, logo: false }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
      })

      expect(scene.logo).toBeUndefined()
      expect(scene.image).toBeDefined()
      for (const block of [scene.title, scene.subtitle, scene.cta]) {
        if (!block || !scene.image) continue
        expect(rectsOverlap(blockRect(block, format), blockRect(scene.image, format))).toBe(false)
      }
    }
  })

  it('applies compact banner rules to the requested horizontal formats', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const formats = minimalTestFormats.filter((item) => item.aspectRatio >= 2.2 || item.height <= 120)
    for (const format of formats) {
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
      })
      const messages = checkOverflow(scene, format).map((issue) => issue.message)
      expect(messages.some((message) => /overlaps/.test(message))).toBe(false)
      if (format.height <= 70) expect(scene.subtitle).toBeUndefined()
      if (scene.cta) {
        const ctaHeightPx = ((scene.cta.h ?? 0) / 100) * format.height
        const maxHeight = format.height <= 70 ? format.height * 0.45 : format.height <= 120 ? 34 : Math.max(48, format.height * 0.18)
        expect(ctaHeightPx).toBeLessThanOrEqual(maxHeight + 0.5)
      }
    }
  })

  it('uses vertical space in portrait cards without tiny text or empty lower halves', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const formats = minimalTestFormats.filter((item) => item.aspectRatio < 0.9 && item.height >= 1000)
    for (const format of formats) {
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
      })
      expect(scene.title).toBeDefined()
      expect(scene.cta).toBeDefined()
      const titleFontPx = ((scene.title?.fontSize ?? 0) / 100) * format.width
      expect(titleFontPx).toBeGreaterThanOrEqual(Math.max(14, format.width * 0.035))
      const bottomMost = Math.max(...blocks(scene).map((block) => block.y + (block.h ?? 0)))
      expect(100 - bottomMost).toBeLessThanOrEqual(30)
      if (scene.image && scene.title) {
        expect(rectsOverlap(blockRect(scene.image, format), blockRect(scene.title, format))).toBe(false)
      }
    }
  })
})

function blocks(scene: Scene): Array<{ kind: BlockKind; x: number; y: number; w: number; h?: number }> {
  return importantBlocks.flatMap((kind) => {
    const block = scene[kind]
    return block ? [{ kind, x: block.x, y: block.y, w: block.w, h: block.h }] : []
  })
}

function blockRect(block: { x: number; y: number; w: number; h?: number; fontSize?: number; maxLines?: number; lineHeight?: number }, format: { aspectRatio: number }) {
  return {
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h ?? (block.fontSize ?? 3) * (block.maxLines ?? 1) * (block.lineHeight ?? 1.2) * format.aspectRatio,
  }
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x + a.w > b.x + 0.3 && b.x + b.w > a.x + 0.3 && a.y + a.h > b.y + 0.3 && b.y + b.h > a.y + 0.3
}
