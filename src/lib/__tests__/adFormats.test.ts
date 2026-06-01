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
