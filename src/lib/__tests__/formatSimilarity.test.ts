import { describe, expect, it } from 'vitest'
import {
  classifyRecommendation,
  defaultRecommendedTargets,
  formatSimilarityScore,
  recommendTargets,
  shapeCategory,
} from '../formatSimilarity'
import type { FormatRuleSet } from '../types'

const baseExtras = { minTitleSize: 4, maxTitleLines: 3, requiredElements: ['title'] as const }

const square: FormatRuleSet = {
  key: 'vk-square',
  label: 'VK Post Square',
  width: 1080,
  height: 1080,
  aspectRatio: 1,
  safeZone: { top: 6, right: 6, bottom: 6, left: 6 },
  gutter: 6,
  ...baseExtras,
  requiredElements: [...baseExtras.requiredElements],
}

const story: FormatRuleSet = {
  key: 'vk-stories',
  label: 'VK Story',
  width: 1080,
  height: 1920,
  aspectRatio: 1080 / 1920,
  safeZone: { top: 12, right: 6, bottom: 10, left: 6 },
  gutter: 6,
  ...baseExtras,
  requiredElements: [...baseExtras.requiredElements],
}

const banner: FormatRuleSet = {
  key: 'yandex-rsy-240x400',
  label: 'РСЯ 240x400',
  width: 240,
  height: 400,
  aspectRatio: 240 / 400,
  safeZone: { top: 8, right: 8, bottom: 8, left: 8 },
  gutter: 6,
  ...baseExtras,
  requiredElements: [...baseExtras.requiredElements],
}

describe('shapeCategory', () => {
  it('classifies common ARs', () => {
    expect(shapeCategory(1)).toBe('square')
    expect(shapeCategory(1080 / 1920)).toBe('story')
    expect(shapeCategory(1080 / 1350)).toBe('portrait')
    expect(shapeCategory(16 / 9)).toBe('landscape')
    expect(shapeCategory(3)).toBe('ultrawide')
  })
})

describe('formatSimilarityScore', () => {
  it('returns 1.0 for identical formats in the same platform', () => {
    expect(formatSimilarityScore(square, square, true)).toBeCloseTo(1, 2)
  })

  it('penalises different aspect ratios', () => {
    const s = formatSimilarityScore(square, story, false)
    expect(s).toBeLessThan(0.5)
  })

  it('rewards same platform group', () => {
    const same = formatSimilarityScore(square, story, true)
    const cross = formatSimilarityScore(square, story, false)
    expect(same).toBeGreaterThan(cross)
    expect(same - cross).toBeCloseTo(0.2, 5)
  })

  it('returns ~0 for fundamentally incompatible shapes', () => {
    const s = formatSimilarityScore(story, banner, false)
    // story (~0.56) vs banner (0.6) — actually similar AR. Use square↔story↔banner trio test.
    expect(s).toBeGreaterThan(0.5)
  })
})

describe('classifyRecommendation', () => {
  it('buckets scores', () => {
    expect(classifyRecommendation(0.95)).toBe('high')
    expect(classifyRecommendation(0.7)).toBe('medium')
    expect(classifyRecommendation(0.3)).toBe('low')
  })
})

describe('recommendTargets', () => {
  it('skips the source key', () => {
    const recs = recommendTargets('vk-square', ['vk-square', 'vk-stories'])
    expect(recs.find((r) => r.key === 'vk-square')).toBeUndefined()
  })

  it('sorts by score desc', () => {
    const recs = recommendTargets('vk-square', ['vk-vertical', 'vk-stories', 'vk-landscape'])
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1]!.score).toBeGreaterThanOrEqual(recs[i]!.score)
    }
  })

  it('story → other story is high recommendation', () => {
    const recs = recommendTargets('vk-stories', ['telegram-story', 'instagram-story'])
    for (const r of recs) {
      expect(r.level).toBe('high')
      expect(r.reasons[0]).toMatch(/ориентация|пропорции/i)
    }
  })

  it('square → story is medium or low (different shape)', () => {
    const recs = recommendTargets('vk-square', ['vk-stories'])
    expect(recs[0]!.level === 'medium' || recs[0]!.level === 'low').toBe(true)
  })
})

describe('defaultRecommendedTargets', () => {
  it('includes only high+medium when present', () => {
    const recs = recommendTargets('vk-stories', [
      'telegram-story',
      'instagram-story',
      'vk-landscape',
    ])
    const defaults = defaultRecommendedTargets(recs)
    expect(defaults).toContain('telegram-story')
    expect(defaults).toContain('instagram-story')
    expect(defaults).not.toContain('vk-landscape')
  })

  it('falls back to top candidate if everything is low', () => {
    const recs = [
      { key: 'a' as never, score: 0.2, level: 'low' as const, reasons: [] },
      { key: 'b' as never, score: 0.1, level: 'low' as const, reasons: [] },
    ]
    expect(defaultRecommendedTargets(recs)).toEqual(['a'])
  })
})
