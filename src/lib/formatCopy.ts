import type { BlockOverrides, FormatKey } from './types'

export type CompactCopy = {
  title: string
  subtitle: string
  cta?: string
}

// ---- Format families with their copy contracts -----------------------------
//
// Each family represents a class of formats that share the same expectations
// for headline / supporting line / CTA length. We do NOT touch the master
// scene — only emit per-format overrides that the layout layer respects.
//
//  - smallAd: aggressive — 16–28 char headline, single-line subtitle, big CTA.
//  - banner:  wide promo  — short headline, single-line offer, glue-on CTA.
//  - card:    marketplace — short headline, 1 product trait, action verb CTA.

type CopyLimits = {
  titleChars: number
  titleLines: number
  subtitleChars: number
  subtitleLines: number
  ctaChars: number
}

const SMALL_AD_FORMATS: readonly FormatKey[] = [
  'yandex-market-stretch',
  'yandex-rsy-728x90',
  'yandex-rsy-300x250',
  'yandex-rsy-240x400',
  'avito-skyscraper',
]

const BANNER_FORMATS: readonly FormatKey[] = [
  'vk-landscape',
  'yandex-market-banner',
]

const CARD_FORMATS: readonly FormatKey[] = [
  'wb-card',
  'wb-infographic',
  'ozon-card',
  'ozon-fresh-square',
  'yandex-market-card',
  'yandex-market-vertical',
]

function smallAdLimits(key: FormatKey): CopyLimits {
  if (key === 'yandex-rsy-728x90' || key === 'yandex-market-stretch') {
    return { titleChars: 28, titleLines: 1, subtitleChars: 30, subtitleLines: 1, ctaChars: 12 }
  }
  if (key === 'avito-skyscraper') {
    // Narrow (300px wide) and tall — must match the platform contract.
    return { titleChars: 16, titleLines: 2, subtitleChars: 28, subtitleLines: 2, ctaChars: 12 }
  }
  return { titleChars: 16, titleLines: 2, subtitleChars: 28, subtitleLines: 1, ctaChars: 12 }
}

function bannerLimits(_key: FormatKey): CopyLimits {
  // Wide landscape banners give us room for ~32 char headline and a single
  // line of supporting copy. CTA stays short and verb-first.
  return { titleChars: 32, titleLines: 2, subtitleChars: 46, subtitleLines: 1, ctaChars: 14 }
}

function cardLimits(_key: FormatKey): CopyLimits {
  // Marketplace cards behave like product tiles: short benefit, single trait
  // line (weight, size, doorstep), short verb CTA.
  return { titleChars: 24, titleLines: 2, subtitleChars: 30, subtitleLines: 1, ctaChars: 14 }
}

type Family = {
  formats: readonly FormatKey[]
  limits: (key: FormatKey) => CopyLimits
}

const FAMILIES: readonly Family[] = [
  { formats: SMALL_AD_FORMATS, limits: smallAdLimits },
  { formats: BANNER_FORMATS, limits: bannerLimits },
  { formats: CARD_FORMATS, limits: cardLimits },
]

export function compactCopyOverrides(copy: CompactCopy): BlockOverrides {
  const cta = copy.cta ?? 'Подробнее'
  const out: BlockOverrides = {}
  for (const family of FAMILIES) {
    for (const key of family.formats) {
      const limits = family.limits(key)
      out[key] = {
        title: {
          text: copy.title,
          charsPerLine: limits.titleChars,
          maxLines: limits.titleLines,
        },
        subtitle: {
          text: copy.subtitle,
          charsPerLine: limits.subtitleChars,
          maxLines: limits.subtitleLines,
        },
        cta: {
          text: cta,
          charsPerLine: limits.ctaChars,
          maxLines: 1,
        },
      }
    }
  }
  return out
}

// Exposed for diagnostics and tests so callers can ask "is this format
// considered an ad/banner/card?" without re-implementing the lists.
export function isSmallAdCopyFormat(key: FormatKey): boolean {
  return SMALL_AD_FORMATS.includes(key)
}

export function isBannerCopyFormat(key: FormatKey): boolean {
  return BANNER_FORMATS.includes(key)
}

export function isCardCopyFormat(key: FormatKey): boolean {
  return CARD_FORMATS.includes(key)
}

// ---- Marketplace product microstructure ------------------------------------
//
// Card formats feel less like posters and more like product tiles. Templates
// can opt into a "marketplace voice" that swaps the long marketing subtitle
// for a single product trait, gives the badge a real benefit, and pins the
// CTA to a clear verb. wb-infographic uses an extra chip-list slot.

export type MarketplaceCopy = {
  /** Single product trait/spec line (becomes subtitle on card formats). */
  trait: string
  /** Optional benefit pill (becomes badge on card formats). */
  benefit?: string
  /** Optional verb-first CTA (overrides cta on card formats). */
  cta?: string
  /** Optional chip-style subtitle for wb-infographic ("Доставка • Возврат"). */
  infographicSubtitle?: string
}

export function marketplaceCopyOverrides(copy: MarketplaceCopy): BlockOverrides {
  const out: BlockOverrides = {}
  for (const key of CARD_FORMATS) {
    const limits = cardLimits(key)
    const sub = key === 'wb-infographic' && copy.infographicSubtitle
      ? copy.infographicSubtitle
      : copy.trait
    const subLimits = key === 'wb-infographic'
      ? { charsPerLine: 30, maxLines: 1 }
      : { charsPerLine: limits.subtitleChars, maxLines: limits.subtitleLines }
    out[key] = {
      subtitle: { text: sub, ...subLimits },
      ...(copy.benefit ? { badge: { text: copy.benefit, charsPerLine: 14, maxLines: 1 } } : {}),
      ...(copy.cta ? { cta: { text: copy.cta, charsPerLine: limits.ctaChars, maxLines: 1 } } : {}),
    }
  }
  return out
}
