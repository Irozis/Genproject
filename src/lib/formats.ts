// Single source of truth for format dimensions and constraints.
// Add a new format ONLY by adding an entry here.

import type { BuiltinFormatKey, CompositionModel, FormatKey, FormatRuleSet } from './types'

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
  'wb-card': {
    key: 'wb-card',
    label: 'WB Карточка товара',
    width: 900,
    height: 1200,
    aspectRatio: 900 / 1200,
    safeZone: { top: 5, right: 5, bottom: 5, left: 5 },
    gutter: 3.5,
    minTitleSize: 5,
    maxTitleLines: 3,
    typescaleBoost: 1.08,
    requiredElements: ['title', 'image'],
  },
  'wb-infographic': {
    key: 'wb-infographic',
    label: 'WB Инфографика',
    width: 900,
    height: 1200,
    aspectRatio: 900 / 1200,
    safeZone: { top: 5, right: 5, bottom: 5, left: 5 },
    gutter: 3.5,
    minTitleSize: 5,
    maxTitleLines: 3,
    typescaleBoost: 1.08,
    requiredElements: ['title', 'image'],
  },
  'ozon-card': {
    key: 'ozon-card',
    label: 'Ozon Карточка товара',
    width: 900,
    height: 1200,
    aspectRatio: 900 / 1200,
    safeZone: { top: 5, right: 5, bottom: 5, left: 5 },
    gutter: 3.5,
    minTitleSize: 5,
    maxTitleLines: 3,
    typescaleBoost: 1.08,
    requiredElements: ['title', 'image'],
  },
  'avito-listing': {
    key: 'avito-listing',
    label: 'Avito Объявление',
    width: 1200,
    height: 900,
    aspectRatio: 1200 / 900,
    safeZone: { top: 5, right: 5, bottom: 5, left: 5 },
    gutter: 4,
    minTitleSize: 5,
    maxTitleLines: 3,
    requiredElements: ['title', 'image'],
  },
  'avito-square': {
    key: 'avito-square',
    label: 'Avito Квадрат',
    width: 1080,
    height: 1080,
    aspectRatio: 1,
    safeZone: { top: 5, right: 5, bottom: 5, left: 5 },
    gutter: 4,
    minTitleSize: 5,
    maxTitleLines: 3,
    requiredElements: ['title', 'image'],
  },
}

export const BASE_FORMAT_KEYS: BuiltinFormatKey[] = [
  'marketplace-card',
  'marketplace-highlight',
  'social-square',
  'story-vertical',
]

export const RU_MARKETPLACE_FORMAT_KEYS: BuiltinFormatKey[] = [
  'wb-card',
  'wb-infographic',
  'ozon-card',
  'avito-listing',
  'avito-square',
]

export const FORMAT_KEYS: BuiltinFormatKey[] = [...BASE_FORMAT_KEYS, ...RU_MARKETPLACE_FORMAT_KEYS]

export const DEFAULT_COMPOSITION_BY_FORMAT: Partial<Record<BuiltinFormatKey, CompositionModel>> = {
  'wb-card': 'image-top-text-bottom',
  'wb-infographic': 'image-top-text-bottom',
  'ozon-card': 'image-top-text-bottom',
  'avito-listing': 'split-right-image',
  'avito-square': 'text-dominant',
}

export function getFormat(key: FormatKey, custom?: FormatRuleSet[]): FormatRuleSet {
  if (key.startsWith('custom:')) {
    const hit = custom?.find((f) => f.key === key)
    if (!hit) throw new Error(`Unknown custom format: ${key}`)
    return hit
  }
  return FORMATS[key as BuiltinFormatKey]
}
