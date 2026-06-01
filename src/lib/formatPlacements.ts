import { getFormat } from './formats'
import type { FormatKey, FormatRuleSet } from './types'

export type ResolutionFormatGroup = {
  key: string
  previewKey: FormatKey
  formatKeys: FormatKey[]
  label: string
  width: number
  height: number
}

export function groupFormatsByResolution(
  keys: FormatKey[],
  customFormats?: FormatRuleSet[],
  options?: { separateKeys?: Iterable<string> },
): ResolutionFormatGroup[] {
  const groups = new Map<string, ResolutionFormatGroup>()
  const preferredPreviewKeys = new Set(options?.separateKeys ?? [])

  for (const key of keys) {
    const format = getFormat(key, customFormats)
    const groupKey = `${format.width}x${format.height}`
    const group = groups.get(groupKey)

    if (!group) {
      groups.set(groupKey, {
        key: groupKey,
        previewKey: key,
        formatKeys: [key],
        label: format.label,
        width: format.width,
        height: format.height,
      })
      continue
    }

    group.formatKeys.push(key)
    if (
      preferredPreviewKeys.has(key) ||
      (!preferredPreviewKeys.has(group.previewKey) && isStricterFormat(format, getFormat(group.previewKey, customFormats)))
    ) {
      group.previewKey = key
    }
    group.label = formatPlacementLabel(group.formatKeys, customFormats)
  }

  return Array.from(groups.values()).sort(compareResolutionGroups)
}

export function formatPlacementLabel(
  keys: FormatKey[],
  customFormats?: FormatRuleSet[],
): string {
  const labels = keys.map((key) => getFormat(key, customFormats).label)
  return Array.from(new Set(labels)).join(', ')
}

export function formatGroupTitle(group: ResolutionFormatGroup): string {
  const known: Record<string, string> = {
    '1080x1920': 'Истории 9:16',
    '1080x1350': 'Портретный пост 4:5',
    '1080x1080': 'Квадратный формат',
    '1080x607': 'Горизонтальный баннер',
    '900x1200': 'Карточка 3:4',
    '1280x960': 'Карточка 4:3',
    '940x1524': 'Вертикальная карточка',
    '300x900': 'Скайскрейпер',
    '240x400': 'Мобильный баннер',
    '1080x450': 'Широкий баннер',
    '300x250': 'Средний баннер',
    '728x90': 'Лидерборд',
    '1706x184': 'Узкий баннер',
  }
  return known[group.key] ?? `${group.width}×${group.height}`
}

export function formatGroupUsageLabel(group: ResolutionFormatGroup, customFormats?: FormatRuleSet[]): string {
  return formatPlacementLabel(group.formatKeys, customFormats)
}

function compareResolutionGroups(a: ResolutionFormatGroup, b: ResolutionFormatGroup): number {
  const rankDiff = placementSortRank(a) - placementSortRank(b)
  if (rankDiff !== 0) return rankDiff
  const areaDiff = b.width * b.height - a.width * a.height
  if (areaDiff !== 0) return areaDiff
  return a.key.localeCompare(b.key)
}

function placementSortRank(group: ResolutionFormatGroup): number {
  const knownOrder: Record<string, number> = {
    '900x1200': 10,
    '1080x1920': 20,
    '1080x1080': 30,
    '1080x1350': 40,
    '1080x607': 50,
    '1280x960': 60,
    '940x1524': 70,
    '300x900': 80,
    '240x400': 90,
    '1080x450': 100,
    '300x250': 110,
    '728x90': 120,
    '1706x184': 130,
  }
  const known = knownOrder[group.key]
  if (known !== undefined) return known

  const ratio = group.width / group.height
  if (ratio > 0.68 && ratio < 0.82) return 200
  if (ratio < 0.65) return 210
  if (ratio > 0.9 && ratio < 1.12) return 220
  if (ratio >= 1.12 && ratio < 2.4) return 230
  return 240
}

function isStricterFormat(a: FormatRuleSet, b: FormatRuleSet): boolean {
  const safeA = a.safeZone.left + a.safeZone.right + a.safeZone.top + a.safeZone.bottom
  const safeB = b.safeZone.left + b.safeZone.right + b.safeZone.top + b.safeZone.bottom
  if (safeA !== safeB) return safeA > safeB
  return a.minTitleSize > b.minTitleSize
}
