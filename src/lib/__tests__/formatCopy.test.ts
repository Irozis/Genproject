import { describe, expect, it } from 'vitest'
import {
  compactCopyOverrides,
  isBannerCopyFormat,
  isCardCopyFormat,
  isSmallAdCopyFormat,
  marketplaceCopyOverrides,
} from '../formatCopy'

describe('formatCopy families', () => {
  it('classifies formats into the right families', () => {
    expect(isSmallAdCopyFormat('yandex-rsy-300x250')).toBe(true)
    expect(isSmallAdCopyFormat('avito-skyscraper')).toBe(true)
    expect(isBannerCopyFormat('vk-landscape')).toBe(true)
    expect(isBannerCopyFormat('yandex-market-banner')).toBe(true)
    expect(isCardCopyFormat('wb-card')).toBe(true)
    expect(isCardCopyFormat('ozon-fresh-square')).toBe(true)
    expect(isSmallAdCopyFormat('vk-landscape')).toBe(false)
    expect(isCardCopyFormat('vk-stories')).toBe(false)
  })
})

describe('compactCopyOverrides', () => {
  const copy = { title: 'Headline', subtitle: 'Supporting line', cta: 'Buy' }

  it('emits overrides for the small-ad family with tight char budgets', () => {
    const out = compactCopyOverrides(copy)
    const stretch = out['yandex-market-stretch']!
    expect(stretch.title?.charsPerLine).toBe(28)
    expect(stretch.title?.maxLines).toBe(1)
    expect(stretch.cta?.charsPerLine).toBe(12)
  })

  it('emits overrides for the banner family with relaxed budgets', () => {
    const out = compactCopyOverrides(copy)
    const banner = out['yandex-market-banner']!
    expect(banner.title?.charsPerLine).toBe(32)
    expect(banner.subtitle?.charsPerLine).toBe(46)
  })

  it('emits overrides for the card family', () => {
    const out = compactCopyOverrides(copy)
    const card = out['wb-card']!
    expect(card.title?.charsPerLine).toBe(24)
    expect(card.subtitle?.maxLines).toBe(1)
    expect(card.cta?.charsPerLine).toBe(14)
  })

  it('falls back to a default CTA when copy.cta is missing', () => {
    const out = compactCopyOverrides({ title: 't', subtitle: 's' })
    expect(out['wb-card']!.cta?.text).toBe('Подробнее')
  })
})

describe('marketplaceCopyOverrides', () => {
  it('writes a single trait line as subtitle for card formats', () => {
    const out = marketplaceCopyOverrides({ trait: '1 кг · Россия' })
    expect(out['wb-card']!.subtitle?.text).toBe('1 кг · Россия')
    expect(out['ozon-card']!.subtitle?.text).toBe('1 кг · Россия')
    // Banner / small-ad formats are NOT touched.
    expect(out['yandex-market-banner']).toBeUndefined()
  })

  it('uses infographicSubtitle on wb-infographic when provided', () => {
    const out = marketplaceCopyOverrides({
      trait: '1 кг · Россия',
      infographicSubtitle: 'Доставка · Возврат · Гарантия',
    })
    expect(out['wb-infographic']!.subtitle?.text).toBe('Доставка · Возврат · Гарантия')
    // Other card formats keep the trait line.
    expect(out['wb-card']!.subtitle?.text).toBe('1 кг · Россия')
  })

  it('overrides badge and cta only when provided', () => {
    const withBenefit = marketplaceCopyOverrides({ trait: 't', benefit: 'Хит', cta: 'В корзину' })
    expect(withBenefit['wb-card']!.badge?.text).toBe('Хит')
    expect(withBenefit['wb-card']!.cta?.text).toBe('В корзину')

    const traitOnly = marketplaceCopyOverrides({ trait: 't' })
    expect(traitOnly['wb-card']!.badge).toBeUndefined()
    expect(traitOnly['wb-card']!.cta).toBeUndefined()
  })
})
