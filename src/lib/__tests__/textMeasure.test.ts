import { describe, expect, it } from 'vitest'
import { computeCtaButtonSize } from '../ctaSizing'
import { __measureCacheSizeForTests, __resetMeasureCacheForTests, measureTextWidth, wrapText } from '../textMeasure'

describe('textMeasure cache', () => {
  it('repeated wrap uses cached width entries', () => {
    __resetMeasureCacheForTests()
    for (let i = 0; i < 1000; i++) {
      wrapText({
        text: 'Sale',
        fontSizePx: 48,
        fontWeight: 700,
        fontFamily: 'sans-serif',
        maxWidthPx: 1000,
        maxLines: 2,
      })
    }
    expect(__measureCacheSizeForTests()).toBe(1)
  })

  it('wraps or ellipsizes long headlines into the requested line count', () => {
    const lines = wrapText({
      text: 'This headline is intentionally long and must stay inside the available region',
      fontSizePx: 34,
      fontWeight: 800,
      fontFamily: 'Inter, sans-serif',
      maxWidthPx: 220,
      maxLines: 2,
    })

    expect(lines.length).toBeLessThanOrEqual(2)
    expect(lines.join(' ').length).toBeLessThan('This headline is intentionally long and must stay inside the available region'.length)
  })

  it('clips long body copy for tiny regions without adding extra lines', () => {
    const lines = wrapText({
      text: 'A dense description that cannot reasonably fit into a micro banner',
      fontSizePx: 18,
      fontWeight: 400,
      fontFamily: 'Inter, sans-serif',
      maxWidthPx: 120,
      maxLines: 1,
      overflow: 'clip',
    })

    expect(lines).toHaveLength(1)
    expect(lines[0]!.endsWith('…')).toBe(false)
  })

  it('accounts for letter spacing when fitting CTA text into a button', () => {
    const compact = computeCtaButtonSize({
      text: 'Download today',
      fontSize: 18,
      minWidth: 80,
      maxWidth: 160,
      minHeight: 28,
      maxHeight: 42,
      paddingX: 16,
      paddingY: 7,
      lineHeight: 1,
      formatWidth: 320,
      formatHeight: 50,
      density: 'compact',
      letterSpacing: 0.04,
    })

    expect(compact.width).toBeLessThanOrEqual(160)
    expect(compact.height).toBeLessThanOrEqual(42)
    expect(compact.fontSize).toBeLessThanOrEqual(18)
  })

  it('measures transformed text deterministically through caller-provided text', () => {
    const lower = measureTextWidth('sale', 24, 700, 'Inter, sans-serif')
    const upper = measureTextWidth('SALE', 24, 700, 'Inter, sans-serif')

    expect(lower).toBeGreaterThan(0)
    expect(upper).toBeGreaterThan(0)
    expect(measureTextWidth('SALE', 24, 700, 'Inter, sans-serif')).toBe(upper)
  })
})
