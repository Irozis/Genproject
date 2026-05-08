import { describe, expect, it } from 'vitest'
import { setFormatCompositionOverride, normalizeFormatOverrides } from '../projectComposition'

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
})
