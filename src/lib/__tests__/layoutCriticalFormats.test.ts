import { describe, expect, it } from 'vitest'
import { buildScene } from '../buildScene'
import { runCompliance } from '../compliance'
import { checkOverflow } from '../fixLayout'
import { DEFAULT_ENABLED } from '../defaults'
import { getFormat } from '../formats'
import type { BlockKind, CompositionModel, FormatRuleSet, Scene } from '../types'
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
    for (const format of minimalTestFormats.filter((item) => (item.aspectRatio >= 2.2 || item.aspectRatio < 0.9) && !isTiny(item))) {
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
        const maxHeight = format.height <= 70 ? format.height * 0.5 : format.height <= 120 ? 38 : Math.max(64, format.height * 0.2)
        expect(ctaHeightPx).toBeLessThanOrEqual(maxHeight + 0.5)
      }
    }
  })

  it('fills split image slots in representative horizontal formats', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const requestedSizes = new Set(['728x90', '960x150', '1000x120', '1200x628', '1920x640', '2880x300'])
    const formats = minimalTestFormats.filter((item) => requestedSizes.has(`${item.width}x${item.height}`) && !isTiny(item))

    for (const format of formats) {
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
      })
      expect(scene.image).toBeDefined()
      const slotW = expectedSplitImageSlotWidth(format)
      const slotH = 100 - format.safeZone.top - format.safeZone.bottom
      expect(scene.image!.w).toBeGreaterThanOrEqual(slotW * 0.70)
      expect(scene.image!.h ?? 0).toBeGreaterThanOrEqual(slotH * 0.70)
      if (format.aspectRatio < 4) {
        expect((scene.image!.w * (scene.image!.h ?? 0)) / 10000).toBeGreaterThanOrEqual(0.30)
      }
      const warningCodes = runCompliance(scene, format, testBrandLight).layoutWarnings.map((warning) => warning.code)
      expect(warningCodes).not.toContain('splitImageTooSmall')
      expect(warningCodes).not.toContain('splitImageNotFillingSlot')
    }
  })

  it('keeps representative horizontal modes compact and non-overlapping', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const requestedSizes = new Set(['728x90', '960x150', '1000x120', '1920x640', '2184x270', '2880x300', '2880x400', '2934x456', '3000x360'])
    const formats: FormatRuleSet[] = [
      ...minimalTestFormats.filter((item) => requestedSizes.has(`${item.width}x${item.height}`) && !isTiny(item)),
      getFormat('ok-horizontal-1200x628'),
    ]
    const modes: Array<{ mode: CompositionModel; master: Scene; expectsImage: boolean }> = [
      { mode: 'text-dominant', master: testContentLong, expectsImage: false },
      { mode: 'split-right-image', master: testContentWithImageHorizontal, expectsImage: true },
      { mode: 'product-card-safe', master: testContentWithImageHorizontal, expectsImage: true },
      { mode: 'centered-card', master: testContentWithImageHorizontal, expectsImage: false },
    ]

    for (const format of formats) {
      for (const { mode, master, expectsImage } of modes) {
        const scene = buildScene(master, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
          assetHint: imageHint,
          customFormats: minimalTestFormats,
          override: mode,
        })
        const messages = checkOverflow(scene, format).map((issue) => issue.message)
        expect(messages.some((message) => /overlaps|Text area may exceed/.test(message))).toBe(false)
        if (expectsImage) {
          expect(scene.image).toBeDefined()
          expect(scene.title).toBeDefined()
          expect(scene.image!.w).toBeGreaterThanOrEqual(expectedSplitImageSlotWidth(format) * 0.70)
          expect(rectsOverlap(blockRect(scene.image!, format), blockRect(scene.title!, format))).toBe(false)
        }
        if (scene.cta) {
          expect(scene.cta.y + (scene.cta.h ?? 0)).toBeLessThanOrEqual(100 - format.safeZone.bottom + 0.5)
        }
      }
    }
  })

  it('centers CTA with the title block in low and ultra-wide horizontal formats', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const acceptanceFormats: FormatRuleSet[] = [
      getFormat('wb-orders-mobile-720x300'),
      minimalTestFormats.find((item) => item.width === 960 && item.height === 300)!,
      getFormat('yandex-rsy-970x250'),
      getFormat('ozon-showcase-1440x400'),
      getFormat('wb-orders-site-2880x300'),
      getFormat('yandex-rsy-3000x360-3x'),
    ]

    for (const format of acceptanceFormats) {
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
        override: 'split-right-image',
      })
      expect(scene.title).toBeDefined()
      expect(scene.cta).toBeDefined()
      expect(scene.subtitle).toBeUndefined()

      const safeCenterY = format.safeZone.top + (100 - format.safeZone.top - format.safeZone.bottom) / 2
      const ctaCenterY = scene.cta!.y + (scene.cta!.h ?? 0) / 2
      const titleCenterY = scene.title!.y + blockRect(scene.title!, format).h / 2
      const ctaHeightPx = ((scene.cta!.h ?? 0) / 100) * format.height
      const ctaBottomSlack = 100 - format.safeZone.bottom - (scene.cta!.y + (scene.cta!.h ?? 0))

      expect(Math.abs(ctaCenterY - safeCenterY)).toBeLessThanOrEqual(2)
      expect(Math.abs(titleCenterY - safeCenterY)).toBeLessThanOrEqual(5)
      expect(Math.abs(ctaCenterY - titleCenterY)).toBeLessThanOrEqual(6)
      expect(ctaHeightPx).toBeGreaterThanOrEqual(30)
      expect(ctaBottomSlack).toBeGreaterThan(8)
      expect(scene.cta!.x).toBeGreaterThanOrEqual(scene.title!.x + scene.title!.w)
    }
  })

  it('keeps normal horizontal split text stack centered without bottom-pinning CTA', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const format = getFormat('ok-horizontal-1200x628')
    const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
      assetHint: imageHint,
      customFormats: minimalTestFormats,
      override: 'split-right-image',
    })

    expect(scene.title).toBeDefined()
    expect(scene.subtitle).toBeDefined()
    expect(scene.cta).toBeDefined()
    expect(scene.cta!.y).toBeGreaterThan(scene.title!.y)

    const safeCenterY = format.safeZone.top + (100 - format.safeZone.top - format.safeZone.bottom) / 2
    const textBlocks = [scene.title!, scene.subtitle!, scene.cta!]
    const stackTop = Math.min(...textBlocks.map((block) => block.y))
    const stackBottom = Math.max(...textBlocks.map((block) => block.y + blockRect(block, format).h))
    const stackCenterY = stackTop + (stackBottom - stackTop) / 2
    const ctaBottomSlack = 100 - format.safeZone.bottom - (scene.cta!.y + (scene.cta!.h ?? 0))

    expect(Math.abs(stackCenterY - safeCenterY)).toBeLessThanOrEqual(4)
    expect(ctaBottomSlack).toBeGreaterThan(10)
  })

  it('keeps subtitle visible in roomy vertical, card, and horizontal formats', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const formatKeys = [
      'yandex-rsy-600x1000-2x',
      'yandex-rsy-480x1200-2x',
      'yandex-rsy-480x1800-3x',
      'yandex-rsy-480x800-2x',
      'vk-wb-social-1000x700',
      'yandex-rsy-900x750-3x',
      'avito-premium-750x564',
      'wb-checkout-app-960x412',
    ] as const

    for (const formatKey of formatKeys) {
      const format = getFormat(formatKey)
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
      })

      expect(scene.subtitle).toBeDefined()
      expect(checkOverflow(scene, format).some((issue) => /Subtitle overlaps|overlaps Subtitle/.test(issue.message))).toBe(false)
    }
  })

  it('never overlaps title and CTA in tiny and compact formats', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const formatKeys = [
      'yandex-rsy-300x250',
      'avito-html5-320x240',
      'yandex-rsy-320x100',
      '2gis-directory-banner-319x57',
      'yandex-rsy-320x50',
    ] as const

    for (const formatKey of formatKeys) {
      const format = getFormat(formatKey)
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
      })
      const messages = checkOverflow(scene, format).map((issue) => issue.message)

      expect(scene.subtitle).toBeUndefined()
      expect(messages.some((message) => /Title overlaps Cta|Cta overlaps Title/.test(message))).toBe(false)
      if (scene.title) expect(scene.title.maxLines).toBeLessThanOrEqual(format.height <= 70 ? 1 : 2)
    }
  })

  it('uses readable type sizes in narrow vertical formats', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const formatKeys = [
      'yandex-rsy-480x1800-3x',
      'yandex-rsy-480x1200-2x',
      'yandex-rsy-320x1200-2x',
      'yandex-rsy-300x600',
      'yandex-rsy-240x600',
      'yandex-rsy-160x600',
    ] as const

    for (const formatKey of formatKeys) {
      const format = getFormat(formatKey)
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
      })
      const titlePx = ((scene.title?.fontSize ?? 0) / 100) * format.width
      const ctaPx = ((scene.cta?.fontSize ?? 0) / 100) * format.width
      const imageH = scene.image?.h ?? 0

      expect(titlePx).toBeGreaterThanOrEqual(Math.min(18, Math.max(16, format.width * 0.045)))
      expect(ctaPx).toBeGreaterThanOrEqual(12)
      expect(imageH).toBeGreaterThanOrEqual(45)
      expect(imageH).toBeLessThanOrEqual(55)
      expect(scene.subtitle).toBeDefined()
    }
  })

  it('keeps low-horizontal and ultra-wide CTA readable and centered with title group', () => {
    const imageHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const formatKeys = [
      'yandex-rsy-728x90',
      'yandex-rsy-970x250',
      'wb-orders-app-1074x276',
      'yandex-rsy-1456x180-2x',
      'yandex-rsy-2910x750-3x',
      'avito-home-2934x456',
      'wb-checkout-site-2880x400',
      'yandex-rsy-3000x360-3x',
    ] as const

    for (const formatKey of formatKeys) {
      const format = getFormat(formatKey)
      const scene = buildScene(testContentWithImageHorizontal, format.key, testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
        assetHint: imageHint,
        customFormats: minimalTestFormats,
      })
      expect(scene.subtitle).toBeUndefined()
      expect(scene.cta).toBeDefined()

      const ctaFontPx = ((scene.cta!.fontSize ?? 0) / 100) * format.width
      const ctaHeightPx = ((scene.cta!.h ?? 0) / 100) * format.height
      const safeCenterY = format.safeZone.top + (100 - format.safeZone.top - format.safeZone.bottom) / 2
      const titleTop = scene.title?.y ?? scene.cta!.y
      const titleBottom = scene.title ? scene.title.y + blockRect(scene.title, format).h : scene.cta!.y
      const ctaBottom = scene.cta!.y + (scene.cta!.h ?? 0)
      const groupCenterY = Math.min(titleTop, scene.cta!.y) + (Math.max(titleBottom, ctaBottom) - Math.min(titleTop, scene.cta!.y)) / 2

      expect(ctaFontPx).toBeGreaterThanOrEqual(11)
      expect(ctaHeightPx).toBeGreaterThanOrEqual(format.height <= 120 ? 24 : 44)
      expect(Math.abs(groupCenterY - safeCenterY)).toBeLessThanOrEqual(9)
      expect(checkOverflow(scene, format).some((issue) => /Title overlaps Cta|Cta overlaps Title/.test(issue.message))).toBe(false)
    }
  })

  it('does not add hero overlay scrims unless explicit or needed for contrast', () => {
    const sceneWithoutHint = buildScene(testContentWithImageHorizontal, 'custom:test-1080x1920', testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
      customFormats: minimalTestFormats,
      override: 'hero-overlay',
    })
    expect(sceneWithoutHint.scrim).toBeUndefined()

    const brightHint = assetHintFromAnalysis(testImageAnalysisHorizontal)
    const sceneNeedingContrast = buildScene(testContentWithImageHorizontal, 'custom:test-1080x1920', testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
      assetHint: brightHint,
      customFormats: minimalTestFormats,
      override: 'hero-overlay',
    })
    expect(sceneNeedingContrast.scrim).toBeDefined()
  })

  it('removes decorative backgrounds by default', () => {
    const masterWithDecor: Scene = {
      ...testContentWithImageHorizontal,
      decor: { kind: 'diagonal-stripe', color: '#FF0000', opacity: 0.4 },
    }
    const defaultScene = buildScene(masterWithDecor, 'custom:test-1920x640', testBrandLight, { ...DEFAULT_ENABLED, image: true }, {
      customFormats: minimalTestFormats,
    })
    expect(defaultScene.decor).toBeUndefined()
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

function expectedSplitImageSlotWidth(format: { aspectRatio: number; safeZone: { left: number; right: number } }): number {
  const innerW = 100 - format.safeZone.left - format.safeZone.right
  const ratio = format.aspectRatio >= 6 ? 0.28 : format.aspectRatio >= 4 ? 0.32 : format.aspectRatio >= 2.2 ? 0.34 : 0.5
  const minW = format.aspectRatio >= 6 ? 24 : format.aspectRatio >= 4 ? 28 : format.aspectRatio >= 2.2 ? 33 : 45
  const maxW = format.aspectRatio >= 6 ? 35 : format.aspectRatio >= 4 ? 38 : format.aspectRatio >= 2.2 ? 42 : 55
  return Math.min(maxW, Math.max(minW, innerW * ratio))
}

function isTiny(format: { width: number; height: number }): boolean {
  return format.width <= 340 || format.height <= 120 || format.width * format.height <= 50000
}
