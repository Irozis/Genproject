import { describe, expect, it } from 'vitest'
import { computeCtaButtonSize } from '../ctaSizing'

const base = {
  fontSize: 28,
  minWidth: 120,
  maxWidth: 420,
  minHeight: 48,
  paddingX: 28,
  paddingY: 12,
  lineHeight: 1,
  formatWidth: 1080,
  formatHeight: 1080,
  fontWeight: 700,
}

describe('CTA sizing', () => {
  it('keeps short CTA at minimum width', () => {
    const out = computeCtaButtonSize({ ...base, text: 'OK' })
    expect(out.width).toBe(base.minWidth)
    expect(out.fits).toBe(true)
  })

  it('expands long CTA up to available width', () => {
    const out = computeCtaButtonSize({ ...base, text: 'Получить консультацию' })
    expect(out.width).toBeGreaterThan(base.minWidth)
    expect(out.width).toBeLessThanOrEqual(base.maxWidth)
    expect(out.fits).toBe(true)
  })

  it('reduces font size within safe limits before warning', () => {
    const out = computeCtaButtonSize({
      ...base,
      text: 'Получить бесплатную консультацию сегодня',
      maxWidth: 260,
    })
    expect(out.fontSize).toBeLessThan(base.fontSize)
    expect(out.fontSize).toBeGreaterThanOrEqual(12)
  })

  it('warns when compact format cannot fit the CTA text', () => {
    const out = computeCtaButtonSize({
      ...base,
      text: 'Получить бесплатную консультацию по проекту',
      maxWidth: 160,
      formatWidth: 300,
      formatHeight: 250,
      density: 'compact',
    })
    expect(out.fits).toBe(false)
    expect(out.warning).toBeDefined()
  })
})
