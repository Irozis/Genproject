import { describe, expect, it } from 'vitest'
import { sampleFormats } from './fixtures'
import type { FormatSpecV2, LayoutRect } from './types'
import {
  canUseCompact,
  canUseImageTop,
  canUseLogoOnly,
  canUseSplit,
  getCompactZones,
  getGap,
  getImageTopZones,
  getLogoOnlyZones,
  getSafeRect,
  getSplitZones,
} from './rules'

function formatById(id: string): FormatSpecV2 {
  const format = sampleFormats.find((item) => item.id === id)

  if (!format) {
    throw new Error(`Missing test format: ${id}`)
  }

  return format
}

function expectRectInsideSafeRect(rect: LayoutRect, safeRect: LayoutRect): void {
  expect(rect.width).toBeGreaterThanOrEqual(0)
  expect(rect.height).toBeGreaterThanOrEqual(0)

  if (rect.width === 0 || rect.height === 0) {
    return
  }

  expect(rect.x).toBeGreaterThanOrEqual(safeRect.x)
  expect(rect.y).toBeGreaterThanOrEqual(safeRect.y)
  expect(rect.x + rect.width).toBeLessThanOrEqual(safeRect.x + safeRect.width)
  expect(rect.y + rect.height).toBeLessThanOrEqual(safeRect.y + safeRect.height)
}

describe('layout-engine-v2 rules', () => {
  it('getSafeRect subtracts safeArea from the format bounds', () => {
    const horizontal = formatById('horizontal-1200x628')

    expect(getSafeRect(horizontal)).toEqual({
      x: 56,
      y: 40,
      width: 1088,
      height: 548,
    })
  })

  it('getGap returns a smaller value for small than for a large square', () => {
    const small = formatById('small-320x50')
    const square = formatById('square-1080')

    expect(getGap(small)).toBeLessThan(getGap(square))
  })

  it('allows split for horizontal-1200x628', () => {
    expect(canUseSplit(formatById('horizontal-1200x628'))).toBe(true)
  })

  it('rejects split for small-320x50', () => {
    expect(canUseSplit(formatById('small-320x50'))).toBe(false)
  })

  it('allows imageTop for vertical-1080x1920', () => {
    expect(canUseImageTop(formatById('vertical-1080x1920'))).toBe(true)
  })

  it('allows compact for small-320x50', () => {
    expect(canUseCompact(formatById('small-320x50'))).toBe(true)
  })

  it('allows logoOnly for logo-200x200', () => {
    expect(canUseLogoOnly(formatById('logo-200x200'))).toBe(true)
  })

  it('places split imageZone to the right of textZone', () => {
    const zones = getSplitZones(formatById('horizontal-1200x628'))

    expect(zones.imageZone.x).toBeGreaterThan(zones.textZone.x)
  })

  it('keeps compact headlineZone positive for small formats', () => {
    const zones = getCompactZones(formatById('small-320x50'))

    expect(zones.headlineZone.width).toBeGreaterThan(0)
  })

  it('keeps all calculated zones inside the safe rect or zero-sized when unavailable', () => {
    const formats = [
      formatById('horizontal-1200x628'),
      formatById('vertical-1080x1920'),
      formatById('small-320x50'),
      formatById('logo-200x200'),
    ]

    for (const format of formats) {
      const safeRect = getSafeRect(format)
      const zones = [
        ...Object.values(getSplitZones(format)),
        ...Object.values(getImageTopZones(format)),
        ...Object.values(getCompactZones(format)),
        ...Object.values(getLogoOnlyZones(format)),
      ]

      for (const zone of zones) {
        expectRectInsideSafeRect(zone, safeRect)
      }
    }
  })
})
