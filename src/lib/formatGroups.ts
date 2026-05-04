// Group format keys into platform-aware sub-groups for UI lists. Used by the
// "Apply to other formats" dialog so the user can flip checkboxes per-source
// (all VK, all Wildberries, all RSY ads, etc.) rather than one-by-one.
//
// Pure: input is a list of format keys, output is an ordered list of named
// groups. Stable order matches how Russian users typically scan the list:
// social → marketplaces → display ads → custom.

import type { FormatKey } from './types'

export type FormatGroupId =
  | 'vk'
  | 'telegram'
  | 'instagram'
  | 'wildberries'
  | 'ozon'
  | 'yandex-market'
  | 'avito'
  | 'yandex-rsy'
  | 'custom'
  | 'other'

export type FormatGroup = {
  id: FormatGroupId
  label: string
  /** Однострочное пояснение, что это за группа (для tooltip / подзаголовков). */
  hint?: string
  keys: FormatKey[]
}

const GROUP_ORDER: FormatGroupId[] = [
  'vk',
  'telegram',
  'instagram',
  'wildberries',
  'ozon',
  'yandex-market',
  'avito',
  'yandex-rsy',
  'custom',
  'other',
]

const GROUP_META: Record<FormatGroupId, { label: string; hint?: string }> = {
  vk: { label: 'VK', hint: 'Посты и истории ВКонтакте' },
  telegram: { label: 'Telegram', hint: 'Истории Telegram' },
  instagram: { label: 'Instagram', hint: 'Stories и Reels Instagram' },
  wildberries: { label: 'Wildberries', hint: 'Карточки товара WB' },
  ozon: { label: 'Ozon', hint: 'Карточки и баннеры Ozon' },
  'yandex-market': { label: 'Яндекс Маркет', hint: 'Карточки и баннеры Маркета' },
  avito: { label: 'Авито', hint: 'Карточки и реклама в ленте Avito' },
  'yandex-rsy': { label: 'Реклама (РСЯ)', hint: 'Баннеры рекламной сети Яндекса' },
  custom: { label: 'Свои форматы', hint: 'Размеры, добавленные вручную' },
  other: { label: 'Другое' },
}

/**
 * Determine which group a single format key belongs to. Custom formats
 * (`custom:*`) form their own group; built-in keys map by platform prefix.
 */
export function groupOf(key: FormatKey): FormatGroupId {
  if (key.startsWith('custom:')) return 'custom'
  if (key.startsWith('vk-')) return 'vk'
  if (key.startsWith('telegram-')) return 'telegram'
  if (key.startsWith('instagram-')) return 'instagram'
  if (key.startsWith('wb-')) return 'wildberries'
  if (key.startsWith('ozon-')) return 'ozon'
  if (key.startsWith('yandex-market-')) return 'yandex-market'
  if (key.startsWith('avito-')) return 'avito'
  if (key.startsWith('yandex-rsy-')) return 'yandex-rsy'
  return 'other'
}

/**
 * Group an arbitrary list of format keys into the canonical platform groups.
 * Empty groups are dropped from the result. Order follows GROUP_ORDER.
 */
export function groupFormats(keys: FormatKey[]): FormatGroup[] {
  const buckets = new Map<FormatGroupId, FormatKey[]>()
  for (const k of keys) {
    const g = groupOf(k)
    const list = buckets.get(g)
    if (list) list.push(k)
    else buckets.set(g, [k])
  }
  return GROUP_ORDER.flatMap((id) => {
    const list = buckets.get(id)
    if (!list || list.length === 0) return []
    return [{ id, label: GROUP_META[id].label, hint: GROUP_META[id].hint, keys: list }]
  })
}
