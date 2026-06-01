import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../color'
import { generatePaletteVariants, paletteVariantToBrandKit } from '../styleSettings'
import type { BrandKit } from '../types'

const brand = (accent: string): BrandKit => ({
  brandName: 'Test',
  displayFont: 'Inter',
  textFont: 'Inter',
  palette: {
    ink: '#101318',
    inkMuted: '#4B5563',
    surface: '#FFFFFF',
    accent,
    accentSoft: '#E5E7EB',
  },
  gradient: ['#FFFFFF', '#F3F4F6', '#E5E7EB'],
  toneOfVoice: 'bold',
  ctaStyle: 'pill',
})

describe('style settings palette generation', () => {
  it('generates the required dynamic palette set with readable text', () => {
    const variants = generatePaletteVariants(brand('#2563EB'), 'social', { seed: 7 })

    expect(variants.map((variant) => variant.id)).toEqual([
      'brand-core',
      'high-contrast',
      'soft-calm',
      'premium-dark',
      'fresh-bright',
      'mono-accent',
    ])
    for (const variant of variants) {
      expect(contrastRatio(variant.primaryText, variant.background)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(variant.secondaryText, variant.background)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(variant.ctaText, variant.ctaBackground)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('derives different colors for different brands and preserves them in the brand kit adapter', () => {
    const blue = generatePaletteVariants(brand('#2563EB'), 'product', { seed: 2 })
    const red = generatePaletteVariants(brand('#E11D48'), 'product', { seed: 2 })

    expect(blue.map((variant) => variant.accent)).not.toEqual(red.map((variant) => variant.accent))
    const nextBrand = paletteVariantToBrandKit(brand('#2563EB'), blue[0]!)
    expect(nextBrand.palette.accent).toBe(blue[0]!.accent)
    expect(nextBrand.gradient[0]).toBe(blue[0]!.background)
  })

  it('keeps palette variants stable until the seed changes', () => {
    const first = generatePaletteVariants(brand('#2563EB'), 'product', { seed: 11 })
    const same = generatePaletteVariants(brand('#2563EB'), 'product', { seed: 11 })
    const regenerated = generatePaletteVariants(brand('#2563EB'), 'product', { seed: 12 })

    expect(first).toEqual(same)
    expect(first.map((variant) => variant.accent)).not.toEqual(regenerated.map((variant) => variant.accent))
  })

  it('preserves selected palette id externally and exposes semantic color tokens', () => {
    const variants = generatePaletteVariants(brand('#0F766E'), 'editorial', { seed: 3 })
    const selectedPaletteId = variants[2]!.id

    expect(selectedPaletteId).toBe('soft-calm')
    for (const variant of variants) {
      expect(variant.primaryText).toMatch(/^#[0-9A-F]{6}$/i)
      expect(variant.secondaryText).toMatch(/^#[0-9A-F]{6}$/i)
      expect(variant.ctaBackground).toMatch(/^#[0-9A-F]{6}$/i)
      expect(variant.ctaText).toMatch(/^#[0-9A-F]{6}$/i)
    }
  })

  it('keeps dark palettes readable on dark backgrounds', () => {
    const premiumDark = generatePaletteVariants(brand('#7C3AED'), 'premium', { seed: 5 })
      .find((variant) => variant.id === 'premium-dark')!

    expect(contrastRatio(premiumDark.primaryText, premiumDark.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(premiumDark.secondaryText, premiumDark.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(premiumDark.ctaText, premiumDark.ctaBackground)).toBeGreaterThanOrEqual(4.5)
  })
})
