import { describe, expect, it } from 'vitest'
import { groupFormatsByResolution } from '../formatPlacements'
import type { FormatRuleSet } from '../types'

describe('groupFormatsByResolution', () => {
  it('merges built-in formats with the same pixel size', () => {
    const groups = groupFormatsByResolution(['wb-card', 'wb-infographic', 'ozon-card'])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.previewKey).toBe('wb-card')
    expect(groups[0]!.formatKeys).toEqual(['wb-card', 'wb-infographic', 'ozon-card'])
    expect(groups[0]!.width).toBe(900)
    expect(groups[0]!.height).toBe(1200)
    expect(groups[0]!.label).toContain('WB')
    expect(groups[0]!.label).toContain('Ozon')
  })

  it('keeps separate groups when dimensions differ', () => {
    const groups = groupFormatsByResolution(['vk-square', 'vk-vertical', 'vk-stories'])

    expect(groups.map((group) => group.formatKeys)).toEqual([
      ['vk-stories'],
      ['vk-square'],
      ['vk-vertical'],
    ])
  })

  it('sorts grouped formats in a practical editing order', () => {
    const groups = groupFormatsByResolution([
      'yandex-rsy-728x90',
      'vk-square',
      'wb-card',
      'telegram-story',
      'yandex-market-stretch',
      'vk-vertical',
      'yandex-market-banner',
    ])

    expect(groups.map((group) => group.key)).toEqual([
      '900x1200',
      '1080x1920',
      '1080x1080',
      '1080x1350',
      '1080x450',
      '728x90',
      '1706x184',
    ])
  })

  it('merges custom and built-in formats by resolution', () => {
    const customFormats: FormatRuleSet[] = [
      {
        key: 'custom:story-placement',
        label: 'Custom Story Placement',
        width: 1080,
        height: 1920,
        aspectRatio: 1080 / 1920,
        safeZone: { top: 8, right: 8, bottom: 8, left: 8 },
        gutter: 4,
        minTitleSize: 4,
        maxTitleLines: 3,
        requiredElements: ['title', 'image'],
      },
    ]

    const groups = groupFormatsByResolution(['vk-stories', 'custom:story-placement'], customFormats)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.formatKeys).toEqual(['vk-stories', 'custom:story-placement'])
    expect(groups[0]!.label).toContain('Custom Story Placement')
  })

  it('keeps a separately edited placement out of its resolution group', () => {
    const groups = groupFormatsByResolution(['wb-card', 'wb-infographic', 'ozon-card'], undefined, {
      separateKeys: ['wb-infographic'],
    })

    expect(groups.map((group) => group.formatKeys)).toEqual([
      ['wb-card', 'ozon-card'],
      ['wb-infographic'],
    ])
  })
})
