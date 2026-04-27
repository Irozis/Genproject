// Single source of truth for format dimensions and constraints.
// Add a new format ONLY by adding an entry here.

import type { BuiltinFormatKey, FormatKey, FormatRuleSet } from './types'

export const FORMATS: Record<BuiltinFormatKey, FormatRuleSet> = {
  'marketplace-card': {
    key: 'marketplace-card',
    label: 'Marketplace Card',
    width: 1200,
    height: 1200,
    aspectRatio: 1,
    safeZone: { top: 6, right: 6, bottom: 6, left: 6 },
    gutter: 4,
    minTitleSize: 5,
    maxTitleLines: 3,
    requiredElements: ['title', 'cta'],
  },
  'marketplace-highlight': {
    key: 'marketplace-highlight',
    label: 'Product Highlight',
    width: 1080,
    height: 1350,
    aspectRatio: 1080 / 1350,
    safeZone: { top: 6, right: 6, bottom: 6, left: 6 },
    gutter: 3.5,
    minTitleSize: 5,
    maxTitleLines: 3,
    typescaleBoost: 1.08,
    requiredElements: ['title', 'cta'],
  },
  'social-square': {
    key: 'social-square',
    label: 'Social Square',
    width: 1080,
    height: 1080,
    aspectRatio: 1,
    safeZone: { top: 6, right: 6, bottom: 6, left: 6 },
    gutter: 4,
    minTitleSize: 5,
    maxTitleLines: 3,
    requiredElements: ['title'],
  },
  'story-vertical': {
    key: 'story-vertical',
    label: 'Story',
    width: 1080,
    height: 1920,
    aspectRatio: 1080 / 1920,
    safeZone: { top: 12, right: 6, bottom: 14, left: 6 },
    gutter: 3,
    minTitleSize: 5,
    maxTitleLines: 4,
    typescaleBoost: 1.18,
    requiredElements: ['title'],
  },
}

export const FORMAT_KEYS: BuiltinFormatKey[] = [
  'marketplace-card',
  'marketplace-highlight',
  'social-square',
  'story-vertical',
]

export function getFormat(key: FormatKey, custom?: FormatRuleSet[]): FormatRuleSet {
  if (key.startsWith('custom:')) {
    const hit = custom?.find((f) => f.key === key)
    if (!hit) throw new Error(`Unknown custom format: ${key}`)
    return hit
  }
  return FORMATS[key as BuiltinFormatKey]
}
