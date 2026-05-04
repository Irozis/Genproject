import { describe, expect, it } from 'vitest'
import { groupFormats, groupOf } from '../formatGroups'

describe('groupOf — single key classification', () => {
  it('maps each platform prefix to its group', () => {
    expect(groupOf('vk-square')).toBe('vk')
    expect(groupOf('vk-stories')).toBe('vk')
    expect(groupOf('telegram-story')).toBe('telegram')
    expect(groupOf('instagram-story')).toBe('instagram')
    expect(groupOf('wb-card')).toBe('wildberries')
    expect(groupOf('ozon-card')).toBe('ozon')
    expect(groupOf('yandex-market-card')).toBe('yandex-market')
    expect(groupOf('avito-listing')).toBe('avito')
    expect(groupOf('yandex-rsy-300x250')).toBe('yandex-rsy')
    expect(groupOf('custom:my-banner')).toBe('custom')
  })
})

describe('groupFormats — bucketing and order', () => {
  it('groups keys, keeps stable platform order, drops empty groups', () => {
    const groups = groupFormats([
      'avito-listing',
      'vk-square',
      'wb-card',
      'vk-stories',
      'custom:my-format',
    ])
    expect(groups.map((g) => g.id)).toEqual(['vk', 'wildberries', 'avito', 'custom'])
    expect(groups[0]!.keys).toEqual(['vk-square', 'vk-stories'])
  })

  it('preserves order of keys within each group', () => {
    const groups = groupFormats(['vk-stories', 'vk-square', 'vk-vertical'])
    expect(groups[0]!.keys).toEqual(['vk-stories', 'vk-square', 'vk-vertical'])
  })

  it('returns an empty array for an empty input', () => {
    expect(groupFormats([])).toEqual([])
  })
})
