import { describe, it, expect } from 'vitest'
import { hexToHsl, hslToHex, tonalStops, luminance } from '../color'

describe('hexToHsl', () => {
  it('parses #FFFFFF as white', () => {
    const { l } = hexToHsl('#FFFFFF')
    expect(l).toBeCloseTo(100, 0)
  })

  it('parses #000000 as black', () => {
    const { l } = hexToHsl('#000000')
    expect(l).toBeCloseTo(0, 0)
  })

  it('round-trips via hslToHex', () => {
    const hex = '#FF5A1F'
    const hsl = hexToHsl(hex)
    const back = hslToHex(hsl.h, hsl.s, hsl.l)
    expect(back).toBe('#FF5A1F')
  })
})

describe('tonalStops', () => {
  it('returns three stops with the base in the middle', () => {
    const stops = tonalStops('#FF006E')
    expect(stops).toHaveLength(3)
    const light = luminance(stops[0])
    const mid = luminance(stops[1])
    const dark = luminance(stops[2])
    expect(light).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(dark)
  })

  it('is deterministic', () => {
    expect(tonalStops('#123456')).toEqual(tonalStops('#123456'))
  })
})
