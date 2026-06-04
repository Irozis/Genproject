import { AD_FORMAT_CATALOG } from '../data/adFormats'
import { formatRuleSetToFormatSpecV2 } from './adapters'
import { runResearch, type ResearchMethod, type ResearchResult } from './runResearch'
import type { FormatSpecV2, SourceMaterialV2 } from './types'

type CatalogFormatLike = {
  id?: string
  key?: string
  name?: string
  label?: string
  width?: number
  height?: number
  w?: number
  h?: number
  aspectRatio?: number
  group?: string
  safeArea?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
  safe?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
  safeZone?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
  safeZones?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasDimensions(value: unknown): value is CatalogFormatLike {
  if (!isObject(value)) {
    return false
  }

  const width = value.width ?? value.w
  const height = value.height ?? value.h

  return typeof width === 'number' && typeof height === 'number'
}

function flattenCatalog(value: unknown): CatalogFormatLike[] {
  if (Array.isArray(value)) {
    return value.flatMap(flattenCatalog)
  }

  if (!isObject(value)) {
    return []
  }

  if (hasDimensions(value)) {
    return [value]
  }

  return Object.values(value).flatMap(flattenCatalog)
}

export function getCatalogFormatsV2(): FormatSpecV2[] {
  const rawFormats = flattenCatalog(AD_FORMAT_CATALOG)
  const seen = new Set<string>()
  const formats: FormatSpecV2[] = []

  for (const rawFormat of rawFormats) {
    const adapted = formatRuleSetToFormatSpecV2(rawFormat)

    if (seen.has(adapted.id)) {
      continue
    }

    seen.add(adapted.id)
    formats.push(adapted)
  }

  return formats
}

export function runCatalogResearch(params: {
  source: SourceMaterialV2
  methods?: ResearchMethod[]
  limit?: number
}): ResearchResult {
  const formats = getCatalogFormatsV2()
  const selectedFormats = params.limit ? formats.slice(0, params.limit) : formats

  if (selectedFormats.length === 0) {
    throw new Error('Cannot run catalog research: no formats were adapted from AD_FORMAT_CATALOG.')
  }

  return runResearch({
    source: params.source,
    formats: selectedFormats,
    methods: params.methods,
  })
}