import { describe, it, expect } from 'vitest'
import { paletteAlternatives, paletteFromHint } from '../paletteFromImage'
import { luminance, hexToHsl } from '../color'
import type { AssetHint, Palette } from '../types'

const fallback: { palette: Palette; gradient: [string, string, string] } = {
  palette: {
    ink: '#0E1014',
    inkMuted: '#4E5155',
    surface: '#FFFFFF',
    accent: '#FF5A1F',
    accentSoft: '#FED7AA',
  },
  gradient: ['#FFEDD5', '#FED7AA', '#FDBA74'],
}

function hint(dominantColors: string[], isDark = false): AssetHint {
  return {
    width: 100,
    height: 100,
    aspectRatio: 1,
    dominantColors,
    isDarkBackground: isDark,
  }
}

describe('paletteFromHint', () => {
  it('returns fallback when no dominant colors', () => {
    const out = paletteFromHint(hint([]), fallback)
    expect(out.palette).toBe(fallback.palette)
    expect(out.gradient).toBe(fallback.gradient)
  })

  it('is deterministic — same input → same output', () => {
    const colors = ['#22AA44', '#EEEEEE', '#111111', '#77CC99']
    const a = paletteFromHint(hint(colors), fallback)
    const b = paletteFromHint(hint(colors), fallback)
    expect(a).toEqual(b)
  })

  it('picks the vivid color as accent, not the grey noise', () => {
    // jungle-ish: lots of grey/beige noise + one saturated green
    const out = paletteFromHint(
      hint(['#D8D8D8', '#BBBBBB', '#A8A89E', '#1E8A3C', '#CFCFCF']),
      fallback,
    )
    const { h, s } = hexToHsl(out.palette.accent)
    // accent should be in the green hue range (80–160°) and saturated
    expect(h).toBeGreaterThan(70)
    expect(h).toBeLessThan(170)
    expect(s).toBeGreaterThan(40)
  })

  it('accent has sufficient luminance separation from surface', () => {
    const out = paletteFromHint(hint(['#FFFFFF', '#FAFAFA', '#FFD60A', '#EEEEEE']), fallback)
    const sep = Math.abs(luminance(out.palette.accent) - luminance(out.palette.surface))
    expect(sep).toBeGreaterThanOrEqual(0.15)
  })

  it('ink is dark, surface is light (light-mode image)', () => {
    const out = paletteFromHint(
      hint(['#F5F5F7', '#222222', '#FF006E', '#999999'], false),
      fallback,
    )
    expect(luminance(out.palette.ink)).toBeLessThan(0.15)
    expect(luminance(out.palette.surface)).toBeGreaterThan(0.85)
  })

  it('ink is light, surface is dark (dark-mode image)', () => {
    // Jungle / helicopter-style: dark edges, one vivid accent.
    const out = paletteFromHint(
      hint(['#0E2013', '#18321B', '#2B481F', '#1E8A3C'], true),
      fallback,
    )
    expect(luminance(out.palette.ink)).toBeGreaterThan(0.85)
    expect(luminance(out.palette.surface)).toBeLessThan(0.15)
  })

  it('ink vs surface has strong luminance separation in both modes', () => {
    const lightOut = paletteFromHint(hint(['#FFFFFF', '#333333', '#FF3B30'], false), fallback)
    const darkOut = paletteFromHint(hint(['#101214', '#222428', '#FFD60A'], true), fallback)
    expect(
      Math.abs(luminance(lightOut.palette.ink) - luminance(lightOut.palette.surface)),
    ).toBeGreaterThan(0.7)
    expect(
      Math.abs(luminance(darkOut.palette.ink) - luminance(darkOut.palette.surface)),
    ).toBeGreaterThan(0.7)
  })

  it('builds gradient in accent hue family (light mode)', () => {
    const out = paletteFromHint(hint(['#FF006E', '#FFFFFF', '#000000']), fallback)
    const accentHue = hexToHsl(out.palette.accent).h
    // Bottom two stops carry visible hue; the top stop is effectively a near-white
    // tint where the hue is dominated by quantization and can read as 0.
    for (const stop of [out.gradient[1]!, out.gradient[2]!]) {
      const stopHue = hexToHsl(stop).h
      const delta = Math.min(
        Math.abs(accentHue - stopHue),
        360 - Math.abs(accentHue - stopHue),
      )
      expect(delta).toBeLessThan(25)
    }
  })

  it('dark mode gradient returns dark stops', () => {
    const out = paletteFromHint(hint(['#0A0E27', '#1E2749', '#00D4FF'], true), fallback)
    for (const stop of out.gradient) {
      // all stops should read as dark (far below the luminance of pure white)
      expect(luminance(stop)).toBeLessThan(0.3)
    }
  })

  it('accentSoft is lighter and less saturated than accent', () => {
    const out = paletteFromHint(hint(['#FF006E', '#FFFFFF', '#222222']), fallback)
    const a = hexToHsl(out.palette.accent)
    const soft = hexToHsl(out.palette.accentSoft)
    expect(soft.l).toBeGreaterThan(a.l)
    expect(soft.s).toBeLessThanOrEqual(a.s)
  })

  it('shifts low-contrast accent darker until it separates from surface', () => {
    // Light surface + near-white accent → loop should darken accent.
    const out = paletteFromHint(hint(['#FFFFFF', '#FAFAFA', '#FFECEC'], false), fallback)
    const sep = Math.abs(luminance(out.palette.accent) - luminance(out.palette.surface))
    expect(sep).toBeGreaterThanOrEqual(0.15)
  })

  it('falls back to full color pool when no chromatic candidates exist', () => {
    // All grays — chromatic filter yields empty set; the function should still
    // return a sensible palette by using the full pool for accent.
    const out = paletteFromHint(hint(['#222222', '#888888', '#DDDDDD']), fallback)
    expect(out.palette.accent).toMatch(/^#[0-9A-F]{6}$/i)
    expect(out.palette.ink).not.toBe(out.palette.surface)
  })
})

describe('paletteAlternatives', () => {
  it('returns fallback singleton when no dominant colors', () => {
    const out = paletteAlternatives(hint([]), fallback)
    expect(out).toHaveLength(1)
    expect(out[0]!.palette).toBe(fallback.palette)
  })

  it('returns single derivation when no chromatic candidates exist', () => {
    const out = paletteAlternatives(hint(['#222', '#555', '#AAA']), fallback)
    expect(out).toHaveLength(1)
  })

  it('collapses near-hue candidates so list length ≤ distinct hue buckets', () => {
    // Two teals within 30° + one orange + one magenta → at most 3 entries,
    // because the two teals collapse into one bucket.
    const out = paletteAlternatives(
      hint(['#1E8A8F', '#1E8AA5', '#E67A1F', '#C51E8F']),
      fallback,
      4,
    )
    expect(out.length).toBeGreaterThanOrEqual(1)
    expect(out.length).toBeLessThanOrEqual(3)
  })

  it('respects the n cap', () => {
    const out = paletteAlternatives(
      hint(['#FF006E', '#00D4FF', '#FFD60A', '#1E8A3C', '#7E22CE', '#EA580C']),
      fallback,
      2,
    )
    expect(out.length).toBeLessThanOrEqual(2)
  })

  it('is deterministic — same hint → same alternative order', () => {
    const colors = ['#FF006E', '#00D4FF', '#FFD60A', '#1E8A3C']
    const a = paletteAlternatives(hint(colors), fallback)
    const b = paletteAlternatives(hint(colors), fallback)
    expect(a.map((x) => x.palette.accent)).toEqual(b.map((x) => x.palette.accent))
  })
})
