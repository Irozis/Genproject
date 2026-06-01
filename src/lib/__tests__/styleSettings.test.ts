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
})
