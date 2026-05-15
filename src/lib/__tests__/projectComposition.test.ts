import { describe, expect, it } from 'vitest'
import { clearFormatLayoutOverrides, setFormatCompositionOverride, normalizeFormatOverrides } from '../projectComposition'

describe('project composition overrides', () => {
  it('selecting auto clears an existing override', () => {
    const result = setFormatCompositionOverride(
      { 'vk-square': 'split-right-image', 'vk-landscape': 'hero-overlay' },
      'vk-square',
      'auto',
    )

    expect(result).toEqual({ 'vk-landscape': 'hero-overlay' })
  })

  it('removes stale auto values from persisted overrides', () => {
    const result = normalizeFormatOverrides({
      'vk-square': 'auto',
      'vk-landscape': 'hero-overlay',
    })

    expect(result).toEqual({ 'vk-landscape': 'hero-overlay' })
  })

  it('clears stale layout fields while preserving semantic edits', () => {
    const result = clearFormatLayoutOverrides(
      {
        'vk-square': {
          title: { x: 10, y: 20, w: 50, fontSize: 7, text: 'Manual title', fill: '#111111' },
          cta: { x: 10, y: 80, w: 40, h: 8, bg: '#FF5500', text: 'Go' },
          image: { x: 50, y: 5, w: 40, h: 90 },
        },
      },
      'vk-square',
    )

    expect(result).toEqual({
      'vk-square': {
        title: { text: 'Manual title', fill: '#111111' },
        cta: { bg: '#FF5500', text: 'Go' },
      },
    })
  })
})
