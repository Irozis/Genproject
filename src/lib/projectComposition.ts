import type { CompositionModel, FormatKey } from './types'

export type CompositionOverrideInput = CompositionModel | 'auto' | null | undefined

export function normalizeFormatOverrides(
  overrides: Partial<Record<FormatKey, CompositionOverrideInput>> | undefined,
): Partial<Record<FormatKey, CompositionModel>> | undefined {
  if (!overrides) return undefined
  const next: Partial<Record<FormatKey, CompositionModel>> = {}
  for (const [key, value] of Object.entries(overrides) as [FormatKey, CompositionOverrideInput][]) {
    if (value && value !== 'auto') next[key] = value
  }
  return Object.keys(next).length > 0 ? next : undefined
}

export function setFormatCompositionOverride(
  overrides: Partial<Record<FormatKey, CompositionOverrideInput>> | undefined,
  formatKey: FormatKey,
  model: CompositionOverrideInput,
): Partial<Record<FormatKey, CompositionModel>> | undefined {
  const next = { ...(normalizeFormatOverrides(overrides) ?? {}) }
  if (!model || model === 'auto') {
    delete next[formatKey]
  } else {
    next[formatKey] = model
  }
  return Object.keys(next).length > 0 ? next : undefined
}
