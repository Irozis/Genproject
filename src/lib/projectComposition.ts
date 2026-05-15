import type { BlockKind, BlockOverride, CompositionModel, FormatKey } from './types'

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

const LAYOUT_OVERRIDE_FIELDS = new Set([
  'x',
  'y',
  'w',
  'h',
  'fontSize',
  'charsPerLine',
  'maxLines',
  'fitMode',
  'weight',
  'letterSpacing',
  'lineHeight',
  'align',
  'rx',
  'fit',
  'cropZoom',
  'cropX',
  'cropY',
  'bgOpacity',
])

export function clearFormatLayoutOverrides(
  overrides: Partial<Record<FormatKey, Partial<Record<BlockKind, BlockOverride>>>> | undefined,
  formatKey: FormatKey,
): Partial<Record<FormatKey, Partial<Record<BlockKind, BlockOverride>>>> | undefined {
  if (!overrides?.[formatKey]) return overrides
  const nextForFormat: Partial<Record<BlockKind, BlockOverride>> = {}
  for (const [kind, override] of Object.entries(overrides[formatKey] ?? {}) as [BlockKind, BlockOverride][]) {
    const semantic = Object.fromEntries(
      Object.entries(override).filter(([key]) => !LAYOUT_OVERRIDE_FIELDS.has(key)),
    ) as BlockOverride
    if (Object.keys(semantic).length > 0) nextForFormat[kind] = semantic
  }
  const next = { ...overrides }
  if (Object.keys(nextForFormat).length > 0) next[formatKey] = nextForFormat
  else delete next[formatKey]
  return Object.keys(next).length > 0 ? next : undefined
}
