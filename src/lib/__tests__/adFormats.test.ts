import { describe, expect, it } from 'vitest'
import { AD_FORMAT_CATALOG } from '../../data/adFormats'
import { buildScene } from '../buildScene'
import { checkOverflow } from '../fixLayout'
import { DEFAULT_BRAND_KIT, DEFAULT_ENABLED, DEFAULT_MASTER } from '../defaults'
import { overlayZoneToPercentRect } from '../formatGeometry'
import type { Scene } from '../types'

describe('ad format catalog', () => {
  it('has unique ids', () => {
    const ids = AD_FORMAT_CATALOG.map((format) => format.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has positive dimensions and matching aspect ratios', () => {
    for (const format of AD_FORMAT_CATALOG) {
      expect(format.width).toBeGreaterThan(0)
      expect(format.height).toBeGreaterThan(0)
      expect(format.aspectRatio).toBeCloseTo(format.width / format.height, 8)
    }
  })

  it('keeps safe areas inside the canvas', () => {
    for (const format of AD_FORMAT_CATALOG) {
      const safe = format.safeZone
      expect(safe.top).toBeGreaterThanOrEqual(0)
      expect(safe.right).toBeGreaterThanOrEqual(0)
      expect(safe.bottom).toBeGreaterThanOrEqual(0)
      expect(safe.left).toBeGreaterThanOrEqual(0)
      expect(safe.left + safe.right).toBeLessThan(100)
      expect(safe.top + safe.bottom).toBeLessThan(100)
    }
  })

  it('keeps overlay zones inside the canvas', () => {
    for (const format of AD_FORMAT_CATALOG) {
      for (const zone of format.overlayZones) {
        const rect = overlayZoneToPercentRect(zone, format)
        expect(rect).toBeTruthy()
        expect(rect!.x).toBeGreaterThanOrEqual(0)
        expect(rect!.y).toBeGreaterThanOrEqual(0)
        expect(rect!.x + rect!.w).toBeLessThanOrEqual(100)
        expect(rect!.y + rect!.h).toBeLessThanOrEqual(100)
      }
    }
  })

  it('has required platform metadata and file constraints', () => {
    for (const format of AD_FORMAT_CATALOG) {
      expect(format.platformName?.trim()).toBeTruthy()
      expect(format.placementName?.trim()).toBeTruthy()
      if (format.supportsPng || format.supportsJpeg || format.supportsSvg || format.supportsHtml5) {
        expect(format.allowedFileTypes.length).toBeGreaterThan(0)
      }
      if (format.maxFileSizeKb !== undefined) expect(format.maxFileSizeKb).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps visible areas inside the canvas', () => {
    for (const format of AD_FORMAT_CATALOG) {
      if (!format.visibleArea) continue
      expect(format.visibleArea.x).toBeGreaterThanOrEqual(0)
      expect(format.visibleArea.y).toBeGreaterThanOrEqual(0)
      expect(format.visibleArea.x + format.visibleArea.width).toBeLessThanOrEqual(format.width)
      expect(format.visibleArea.y + format.visibleArea.height).toBeLessThanOrEqual(format.height)
    }
  })

  it('covers each platform and preserves legacy format ids', () => {
    const platforms = new Set(AD_FORMAT_CATALOG.map((format) => format.platformId))
    for (const expected of ['vk', 'yandex-direct', 'avito', 'ozon', 'wildberries', 'telegram-post']) {
      expect(platforms.has(expected)).toBe(true)
    }

    const ids = new Set(AD_FORMAT_CATALOG.map((format) => format.id))
    for (const legacy of ['vk-square', 'vk-vertical', 'vk-landscape', 'instagram-story', 'yandex-market-card', 'wb-card', 'ozon-card', 'avito-listing']) {
      expect(ids.has(legacy)).toBe(true)
    }
  })

  it('contains critical generated and marketplace dimensions', () => {
    const sizes = new Set(AD_FORMAT_CATALOG.map((format) => `${format.width}x${format.height}`))
    for (const size of ['320x50', '320x100', '319x57', '728x90', '1456x180', '2880x300', '2880x400', '3000x360', '300x250', '300x600', '1080x1080', '1080x1350', '1080x1920', '1472x600', '600x750', '145x165']) {
      expect(sizes.has(size)).toBe(true)
    }
  })

  it('generates a scene for every built-in format', () => {
    for (const format of AD_FORMAT_CATALOG) {
      const scene = buildScene(DEFAULT_MASTER, format.key, DEFAULT_BRAND_KIT, DEFAULT_ENABLED)
      expect(scene.background).toBeDefined()
    }
  })
})

describe('format-aware validator', () => {
  it('detects safe area violations', () => {
    const format = AD_FORMAT_CATALOG.find((item) => item.key === 'vk-square')!
    const scene: Scene = {
      ...DEFAULT_MASTER,
      title: DEFAULT_MASTER.title ? { ...DEFAULT_MASTER.title, x: 0, y: 0, w: 40, h: 10 } : undefined,
    }

    expect(checkOverflow(scene, format).some((issue) => issue.message.includes('safe area'))).toBe(true)
  })

  it('detects text in overlay zones', () => {
    const format = AD_FORMAT_CATALOG.find((item) => item.key === 'ozon-card')!
    const scene: Scene = {
      ...DEFAULT_MASTER,
      title: DEFAULT_MASTER.title ? { ...DEFAULT_MASTER.title, x: 78, y: 1, w: 20, h: 8 } : undefined,
    }

    expect(checkOverflow(scene, format).some((issue) => issue.message.includes('overlay zone'))).toBe(true)
  })
})
