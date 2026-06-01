// Single source of truth adapter for format dimensions and constraints.
// The expanded catalog lives in src/data/adFormats.ts; this module keeps the
// legacy API that the generator, preview, export and saved projects already use.

import { AD_FORMAT_CATALOG } from '../data/adFormats'
import type { BuiltinFormatKey, CompositionModel, FormatKey, FormatRuleSet } from './types'

export const FORMATS: Record<BuiltinFormatKey, FormatRuleSet> = Object.fromEntries(
  AD_FORMAT_CATALOG.map((format) => [format.key, format]),
) as Record<BuiltinFormatKey, FormatRuleSet>

export const FORMAT_KEYS: BuiltinFormatKey[] = AD_FORMAT_CATALOG.map((format) => format.key)

export const BASE_FORMAT_KEYS: BuiltinFormatKey[] = [
  'vk-square',
  'vk-vertical',
  'vk-landscape',
  'vk-stories',
  'telegram-story',
  'instagram-story',
].filter((key) => key in FORMATS)

export const RU_MARKETPLACE_FORMAT_KEYS: BuiltinFormatKey[] = FORMAT_KEYS.filter(
  (key) => !BASE_FORMAT_KEYS.includes(key),
)

export const DEFAULT_COMPOSITION_BY_FORMAT: Partial<Record<BuiltinFormatKey, CompositionModel>> = Object.fromEntries(
  AD_FORMAT_CATALOG.flatMap((format) => {
    const composition = format.defaultComposition ?? inferDefaultComposition(format)
    return composition ? [[format.key, composition]] : []
  }),
) as Partial<Record<BuiltinFormatKey, CompositionModel>>

export function getFormat(key: FormatKey, custom?: FormatRuleSet[]): FormatRuleSet {
  if (key.startsWith('custom:')) {
    const hit = custom?.find((f) => f.key === key)
    if (!hit) throw new Error(`Unknown custom format: ${key}`)
    return hit
  }
  const format = FORMATS[key as BuiltinFormatKey]
  if (!format) throw new Error(`Unknown built-in format: ${key}`)
  return format
}

function inferDefaultComposition(format: FormatRuleSet): CompositionModel {
  if (format.aspectRatio > 2.2) return 'split-right-image'
  if (format.aspectRatio < 0.7) return 'hero-overlay'
  if (format.device === 'marketplace') return 'image-top-text-bottom'
  if (format.goal === 'display') return 'split-right-image'
  return 'hero-overlay'
}
