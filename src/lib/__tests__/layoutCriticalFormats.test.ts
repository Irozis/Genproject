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
})

function blocks(scene: Scene): Array<{ kind: BlockKind; x: number; y: number; w: number; h?: number }> {
  return importantBlocks.flatMap((kind) => {
    const block = scene[kind]
    return block ? [{ kind, x: block.x, y: block.y, w: block.w, h: block.h }] : []
  })
}
