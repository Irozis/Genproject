// Brand templates: curated starter kits that define a complete mini-brand,
// default campaign copy, imagery direction, and resilient format behavior.

import type {
  Background,
  BrandKit,
  CompositionModel,
  Decor,
  FormatKey,
  Palette,
  Scene,
  TextBlock,
  BlockOverrides,
  CtaBlock,
  EnabledMap,
  LayoutDensity,
  LogoBlock,
  ImageBlock,
} from './types'
import {
  compactCopyOverrides,
  marketplaceCopyOverrides,
  type CompactCopy,
  type MarketplaceCopy,
} from './formatCopy'

export type Template = {
  id: string
  name: string
  description: string
  industry?: string
  targetAudience?: string
  valueProposition?: string
  visualMood?: string
  recommendedImageStyle?: string
  brandKit: BrandKit
  master: Scene
  preferredModels?: Partial<Record<FormatKey, CompositionModel>>
  enabled?: Partial<EnabledMap>
  blockOverrides?: BlockOverrides
  formatDensities?: Partial<Record<FormatKey, LayoutDensity>>
  compactCopy?: CompactCopy
  marketplaceCopy?: MarketplaceCopy
}

type BaseArgs = {
  bg: Background
  decor?: Decor
  palette: Palette
  text: { title: string; subtitle: string; cta: string; badge: string }
  ctaFill?: string
  ctaCharsPerLine?: number
  badgeCharsPerLine?: number
  imageSrc?: string
  image?: Partial<ImageBlock>
}

const title = (text: string, fill: string): TextBlock => ({
  text,
  x: 6,
  y: 18,
  w: 60,
  fontSize: 7,
  charsPerLine: 18,
  maxLines: 3,
  weight: 900,
  fill,
  letterSpacing: 0,
  lineHeight: 1.02,
})

const subtitle = (text: string, fill: string): TextBlock => ({
  text,
  x: 6,
  y: 44,
  w: 50,
  fontSize: 3,
  charsPerLine: 32,
  maxLines: 2,
  weight: 400,
  fill,
  opacity: 0.74,
  letterSpacing: 0,
  lineHeight: 1.35,
})

const cta = (text: string, accent: string, fill: string, rx: number): CtaBlock => ({
  text,
  x: 6,
  y: 84,
  w: 30,
  h: 7,
  fontSize: 2.6,
  charsPerLine: 14,
  maxLines: 1,
  weight: 750,
  fill,
  bg: accent,
  rx,
  letterSpacing: 0,
})

const badge = (text: string, accent: string): TextBlock => ({
  text,
  x: 6,
  y: 6,
  w: 22,
  fontSize: 2.1,
  charsPerLine: 12,
  maxLines: 1,
  weight: 750,
  fill: accent,
  letterSpacing: 0.08,
})

const logo: LogoBlock = { x: 80, y: 6, w: 14, h: 6, src: null, bgOpacity: 0.92 }
const image: ImageBlock = { x: 50, y: 8, w: 44, h: 84, src: null, rx: 16, fit: 'cover' }

const photo = (id: string): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=84`

const make = ({ bg, decor, palette, text, ctaFill, ctaCharsPerLine, badgeCharsPerLine, imageSrc, image: imageOverrides }: BaseArgs): Scene => {
  const scene: Scene = {
    background: bg,
    accent: palette.accent,
    title: title(text.title, palette.ink),
    subtitle: subtitle(text.subtitle, palette.ink),
    cta: { ...cta(text.cta, palette.accent, ctaFill ?? palette.surface, 999), ...(ctaCharsPerLine ? { charsPerLine: ctaCharsPerLine } : {}) },
    badge: { ...badge(text.badge, palette.accent), ...(badgeCharsPerLine ? { charsPerLine: badgeCharsPerLine } : {}) },
    logo,
    image: { ...image, src: imageSrc ?? null, ...imageOverrides },
  }
  if (decor) scene.decor = decor
  return scene
}

const FORMAT_BLOCK_OVERRIDES: BlockOverrides = {
  'vk-landscape': {
    title: { fontSize: 4.6, maxLines: 3, w: 46 },
    subtitle: { fontSize: 2.1, maxLines: 2, w: 42 },
    cta: { fontSize: 1.9, w: 28, h: 8 },
    badge: { fontSize: 1.55 },
  },
  'wb-card': {
    image: { x: 5, y: 5, w: 90, h: 54, rx: 18, fit: 'contain' },
    title: { y: 63, fontSize: 5.8, maxLines: 2, w: 88, charsPerLine: 20 },
    subtitle: { y: 74.5, fontSize: 2.05, maxLines: 1, w: 76, charsPerLine: 28 },
    cta: { y: 84, fontSize: 2.45, w: 50, h: 7.2, charsPerLine: 12 },
    badge: { y: 59.5, fontSize: 1.7, w: 30, charsPerLine: 12 },
  },
  'wb-infographic': {
    image: { x: 5, y: 5, w: 90, h: 53, rx: 18, fit: 'contain' },
    title: { y: 63, fontSize: 5.7, maxLines: 2, w: 88, charsPerLine: 20 },
    subtitle: { y: 74.3, fontSize: 2.1, maxLines: 1, w: 78, charsPerLine: 26 },
    cta: { y: 84, fontSize: 2.45, w: 50, h: 7.2, charsPerLine: 12 },
    badge: { y: 59, fontSize: 1.75, w: 34, charsPerLine: 12 },
  },
  'ozon-card': {
    image: { x: 5, y: 5, w: 90, h: 54, rx: 18, fit: 'contain' },
    title: { y: 63, fontSize: 5.8, maxLines: 2, w: 88, charsPerLine: 20 },
    subtitle: { y: 74.5, fontSize: 2.05, maxLines: 1, w: 76, charsPerLine: 28 },
    cta: { y: 84, fontSize: 2.45, w: 50, h: 7.2, charsPerLine: 12 },
    badge: { y: 59.5, fontSize: 1.7, w: 30, charsPerLine: 12 },
  },
  'yandex-market-vertical': {
    image: { x: 6, y: 6, w: 88, h: 54, rx: 18, fit: 'contain' },
    title: { y: 64, fontSize: 5.9, maxLines: 2, w: 86, charsPerLine: 20 },
    subtitle: { y: 75.5, fontSize: 2.05, maxLines: 1, w: 78, charsPerLine: 28 },
    cta: { y: 84.5, fontSize: 2.4, w: 50, h: 7, charsPerLine: 12 },
    badge: { y: 60.2, fontSize: 1.7, w: 30, charsPerLine: 12 },
  },
  'yandex-market-banner': {
    title: { fontSize: 3.1, maxLines: 2, w: 48, charsPerLine: 28 },
    subtitle: { fontSize: 1.55, maxLines: 1, w: 42, charsPerLine: 42 },
    cta: { fontSize: 1.45, w: 22, h: 9, charsPerLine: 18 },
    badge: { fontSize: 1.2, charsPerLine: 12 },
  },
  'yandex-market-stretch': {
    title: { fontSize: 1.8, maxLines: 1, w: 34, charsPerLine: 28 },
    subtitle: { fontSize: 0.98, maxLines: 1, w: 26, charsPerLine: 30 },
    cta: { fontSize: 1.1, w: 18, h: 42, charsPerLine: 12 },
  },
  'yandex-rsy-728x90': {
    title: { fontSize: 2.0, maxLines: 1, w: 34, charsPerLine: 28 },
    subtitle: { fontSize: 1.08, maxLines: 1, w: 26, charsPerLine: 30 },
    cta: { fontSize: 1.18, w: 18, h: 42, charsPerLine: 12 },
  },
  'yandex-rsy-300x250': {
    title: { fontSize: 4.6, maxLines: 2, w: 52, charsPerLine: 16 },
    subtitle: { fontSize: 2.0, maxLines: 1, w: 46, charsPerLine: 20 },
    cta: { fontSize: 2.15, w: 42, h: 11, charsPerLine: 12 },
    badge: { fontSize: 1.35 },
  },
  'yandex-rsy-240x400': {
    title: { fontSize: 5.8, maxLines: 2, charsPerLine: 16 },
    subtitle: { fontSize: 2.2, maxLines: 1, charsPerLine: 20 },
    cta: { fontSize: 2.45, w: 64, h: 8.2, charsPerLine: 12 },
    badge: { fontSize: 1.55 },
  },
  'avito-skyscraper': {
    title: { fontSize: 6.5, maxLines: 2, charsPerLine: 16 },
    subtitle: { fontSize: 2.35, maxLines: 1, charsPerLine: 20 },
    cta: { fontSize: 2.65, w: 76, h: 7.6, charsPerLine: 12 },
    badge: { fontSize: 1.5 },
  },
}

const FORMAT_DENSITIES: Partial<Record<FormatKey, LayoutDensity>> = {
  'vk-landscape': 'compact',
  'yandex-market-banner': 'compact',
  'yandex-market-stretch': 'compact',
  'yandex-rsy-728x90': 'compact',
  'yandex-rsy-300x250': 'compact',
  'yandex-rsy-240x400': 'compact',
  'avito-skyscraper': 'compact',
}

const storyHero: Partial<Record<FormatKey, CompositionModel>> = {
  'vk-stories': 'hero-overlay',
  'telegram-story': 'hero-overlay',
  'instagram-story': 'hero-overlay',
  'avito-fullscreen': 'hero-overlay',
}

const marketStack: Partial<Record<FormatKey, CompositionModel>> = {
  'wb-card': 'product-card-safe',
  'wb-infographic': 'product-card-safe',
  'ozon-card': 'product-card-safe',
  'ozon-fresh-square': 'product-card-safe',
  'yandex-market-card': 'product-card-safe',
  'yandex-market-vertical': 'product-card-safe',
}

const wideSplit: Partial<Record<FormatKey, CompositionModel>> = {
  'vk-landscape': 'split-right-image',
  'yandex-market-banner': 'split-right-image',
  'yandex-market-stretch': 'split-right-image',
  'yandex-rsy-728x90': 'split-right-image',
}

const textOverPhotoStory: BlockOverrides = {
  'instagram-story': {
    title: { y: 56, fontSize: 6.7, maxLines: 2 },
    subtitle: { y: 68, fontSize: 2.55, maxLines: 2 },
    cta: { y: 77, w: 36, h: 6.5 },
  },
  'telegram-story': {
    title: { y: 56, fontSize: 6.7, maxLines: 2 },
    subtitle: { y: 68, fontSize: 2.55, maxLines: 2 },
    cta: { y: 77, w: 36, h: 6.5 },
  },
  'vk-stories': {
    title: { y: 56, fontSize: 6.7, maxLines: 2 },
    subtitle: { y: 68, fontSize: 2.55, maxLines: 2 },
    cta: { y: 77, w: 36, h: 6.5 },
  },
  'avito-fullscreen': {
    title: { y: 56, fontSize: 6.7, maxLines: 2 },
    subtitle: { y: 68, fontSize: 2.55, maxLines: 2 },
    cta: { y: 77, w: 36, h: 6.5 },
  },
}

const priorityCompactCta: BlockOverrides = {
  'avito-skyscraper': { cta: { fontSize: 4.2, h: 9.5, w: 78 } },
  'yandex-rsy-240x400': { cta: { fontSize: 4.7, h: 9.5, w: 70 } },
  'yandex-rsy-300x250': { cta: { fontSize: 3.8, h: 13, w: 46 } },
  'yandex-rsy-728x90': { cta: { fontSize: 1.55, h: 42, w: 20 } },
  'yandex-market-stretch': { cta: { fontSize: 1.55, h: 42, w: 20 } },
}

const hideStoryBadge: BlockOverrides = {
  'instagram-story': { badge: { hidden: true } },
  'telegram-story': { badge: { hidden: true } },
  'vk-stories': { badge: { hidden: true } },
  'avito-fullscreen': { badge: { hidden: true } },
}

function withFormatSettings(template: Template): Template {
  const compact = template.compactCopy ? compactCopyOverrides(template.compactCopy) : undefined
  const market = template.marketplaceCopy ? marketplaceCopyOverrides(template.marketplaceCopy) : undefined
  return {
    ...template,
    blockOverrides: mergeBlockOverrides(
      mergeBlockOverrides(
        mergeBlockOverrides(FORMAT_BLOCK_OVERRIDES, compact),
        market,
      ),
      template.blockOverrides,
    ),
    formatDensities: { ...FORMAT_DENSITIES, ...(template.formatDensities ?? {}) },
  }
}

function mergeBlockOverrides(base: BlockOverrides, local?: BlockOverrides): BlockOverrides {
  const out: BlockOverrides = { ...base }
  if (!local) return out
  for (const [formatKey, blocks] of Object.entries(local) as Array<[FormatKey, NonNullable<BlockOverrides[FormatKey]>]>) {
    const current = out[formatKey] ?? {}
    out[formatKey] = { ...current }
    for (const [blockKind, override] of Object.entries(blocks) as Array<[keyof typeof blocks, NonNullable<typeof blocks[keyof typeof blocks]>]>) {
      out[formatKey]![blockKind] = {
        ...(current[blockKind] ?? {}),
        ...override,
      }
    }
  }
  return out
}

const TEMPLATE_ORDER = [
  'fashion-drop',
  'skincare-lab',
  'coffee-roastery',
  'fintech-card',
  'travel-retreat',
  'kids-school',
  'estate-premium',
  'fitness-club',
  'farm-grocery',
  'saas-dashboard',
] as const

const REDESIGNED_TEMPLATES: Record<(typeof TEMPLATE_ORDER)[number], Template> = {
  'fashion-drop': {
    id: 'fashion-drop',
    name: 'Fashion drop',
    description: 'Noir Atelier capsule kit for style-conscious shoppers: editorial, premium, image-led, and direct.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Капсула Noir 04',
      subtitle: 'Лимитированный дроп с плотным денимом и графичными силуэтами',
      cta: 'Смотреть дроп',
    },
    marketplaceCopy: {
      trait: 'Худи, деним и аксессуары в лимитированной капсуле',
      benefit: 'Limited drop',
      cta: 'Смотреть дроп',
      infographicSubtitle: 'Плотный хлопок · Деним · Лимит',
    },
    brandKit: {
      brandName: 'Noir Atelier',
      displayFont: '"Bebas Neue", Impact, "Arial Black", sans-serif',
      textFont: 'Montserrat, Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#C8C2BD',
        surface: '#090807',
        accent: '#F15A3B',
        accentSoft: '#F7B8A7',
      },
      gradient: ['#090807', '#211B18', '#F15A3B'],
      toneOfVoice: 'bold',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'solid', color: '#090807' },
      decor: { kind: 'rule', y: 10, color: '#F15A3B', opacity: 0.78 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#C8C2BD',
        surface: '#090807',
        accent: '#F15A3B',
        accentSoft: '#F7B8A7',
      },
      imageSrc: photo('photo-1529139574466-a303027c1d8b'),
      image: { focalX: 0.5, focalY: 0.42, cropZoom: 1.08, rx: 0 },
      text: {
        title: 'Новый **силуэт** сезона',
        subtitle: 'Капсула из плотного хлопка, денима и вещей, которые быстро исчезают из наличия.',
        cta: 'Смотреть дроп',
        badge: 'Limited drop',
      },
    }),
    preferredModels: {
      'vk-square': 'hero-overlay',
      'vk-vertical': 'hero-overlay',
      ...storyHero,
      ...wideSplit,
      ...marketStack,
    },
    blockOverrides: {
      ...textOverPhotoStory,
      'vk-square': {
        title: { y: 52, fontSize: 7.8, maxLines: 2, w: 62 },
        subtitle: { y: 67, fontSize: 2.55, maxLines: 2, w: 52 },
        cta: { y: 79, w: 36, h: 7 },
      },
      'vk-landscape': { title: { fontSize: 5.2, w: 42 }, image: { x: 55, y: 0, w: 45, h: 100, rx: 0 } },
    },
  },
  'skincare-lab': {
    id: 'skincare-lab',
    name: 'Dermalab',
    description: 'Clean premium skincare kit for daily barrier repair: clinical, soft, spacious, and trustworthy.',
    industry: 'Косметическая лаборатория и уход за кожей',
    targetAudience: 'Покупатели премиального ежедневного ухода, которым важны состав, доверие и мягкая клиническая эстетика.',
    valueProposition: 'Активные формулы для восстановления кожи без визуального шума и агрессивных обещаний.',
    visualMood: 'airy clinical beauty, warm white space, muted sage accents',
    recommendedImageStyle: 'Clean product still life on ivory or pale mint, soft shadow, generous negative space.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Активные формулы',
      subtitle: 'Ежедневное восстановление кожи без лишнего шума',
      cta: 'Подобрать уход',
    },
    marketplaceCopy: {
      trait: '30 мл · активная формула · pH 5.5',
      benefit: 'Новинка',
      cta: 'Подобрать уход',
      infographicSubtitle: 'Сыворотки · Кремы · Восстановление',
    },
    brandKit: {
      brandName: 'Dermalab',
      logoText: 'DL',
      displayFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      textFont: 'Manrope, Inter, system-ui, sans-serif',
      palette: {
        ink: '#243330',
        inkMuted: '#62736D',
        surface: '#FCFAF5',
        accent: '#78AA9B',
        accentSoft: '#DDEDE7',
      },
      gradient: ['#FCFAF5', '#EEF6F2', '#DDEDE7'],
      toneOfVoice: 'minimal',
      ctaStyle: 'pill',
    },
    master: make({
      bg: { kind: 'solid', color: '#FCFAF5' },
      decor: { kind: 'corner-circle', corner: 'br', size: 34, color: '#78AA9B', opacity: 0.09 },
      palette: {
        ink: '#243330',
        inkMuted: '#62736D',
        surface: '#FCFAF5',
        accent: '#78AA9B',
        accentSoft: '#DDEDE7',
      },
      imageSrc: photo('photo-1556228720-195a672e8a03'),
      image: { focalX: 0.5, focalY: 0.52, cropZoom: 1.0, rx: 22 },
      text: {
        title: 'Уход, основанный на **активных формулах**',
        subtitle: 'Сыворотки и кремы для ежедневного восстановления кожи',
        cta: 'Подобрать уход',
        badge: 'Новинка',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'image-top-stack',
      'instagram-story': 'image-top-stack',
      'telegram-story': 'image-top-stack',
      'vk-stories': 'image-top-stack',
      ...wideSplit,
      ...marketStack,
    },
    blockOverrides: {
      'vk-square': {
        title: { fontSize: 5.9, maxLines: 3, w: 47, charsPerLine: 18 },
        subtitle: { fontSize: 2.3, maxLines: 2, w: 42 },
        image: { x: 58, y: 12, w: 32, h: 76, rx: 22, fit: 'cover' },
      },
      'vk-vertical': { image: { fit: 'cover', focalY: 0.5, rx: 22 } },
      'instagram-story': { title: { y: 63, fontSize: 5.5, maxLines: 3 }, subtitle: { y: 77, fontSize: 2.2, maxLines: 2 }, cta: { y: 88, w: 38 }, badge: { hidden: true } },
      'telegram-story': { title: { y: 63, fontSize: 5.5, maxLines: 3 }, subtitle: { y: 77, fontSize: 2.2, maxLines: 2 }, cta: { y: 88, w: 38 }, badge: { hidden: true } },
      'vk-stories': { title: { y: 63, fontSize: 5.5, maxLines: 3 }, subtitle: { y: 77, fontSize: 2.2, maxLines: 2 }, cta: { y: 88, w: 38 }, badge: { hidden: true } },
      ...priorityCompactCta,
    },
  },
  'coffee-roastery': {
    id: 'coffee-roastery',
    name: 'Ember Roastery',
    description: 'Warm craft coffee kit for specialty beans and cafe promos: tactile, premium, sensory, and modern.',
    industry: 'Specialty coffee roastery and cafe retail',
    targetAudience: 'Покупатели зерна для дома, офисов и кофеен, которым важны свежесть и характер сорта.',
    valueProposition: 'Свежая авторская обжарка с понятным выбором зерна для разных сценариев.',
    visualMood: 'deep espresso, warm cream, copper accents, tactile editorial craft',
    recommendedImageStyle: 'Warm photo of beans, espresso, cupping, or roastery process integrated into a dark coffee palette.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Свежая обжарка',
      subtitle: 'Авторские сорта для дома, офиса и кофейни',
      cta: 'Выбрать кофе',
    },
    marketplaceCopy: {
      trait: '250 г · фильтр · обжарка 12 мая',
      benefit: 'Новая партия',
      cta: 'Выбрать кофе',
      infographicSubtitle: 'Ягоды · Какао · Фильтр',
    },
    brandKit: {
      brandName: 'Ember Roastery',
      logoText: 'ER',
      displayFont: 'Fraunces, "Playfair Display", Georgia, serif',
      textFont: 'Manrope, Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFF4E2',
        inkMuted: '#E6C79F',
        surface: '#1B0F08',
        accent: '#D98A45',
        accentSoft: '#E9B36E',
      },
      gradient: ['#1B0F08', '#3C2112', '#6F3A1E'],
      toneOfVoice: 'editorial',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#1B0F08', '#342013', '#6A381D'] },
      decor: { kind: 'grain', seed: 18, intensity: 0.28 },
      palette: {
        ink: '#FFF4E2',
        inkMuted: '#E6C79F',
        surface: '#1B0F08',
        accent: '#D98A45',
        accentSoft: '#E9B36E',
      },
      imageSrc: photo('photo-1495474472287-4d71bcdd2085'),
      image: { focalX: 0.52, focalY: 0.5, cropZoom: 1.04, rx: 18 },
      text: {
        title: 'Свежая **обжарка** каждую неделю',
        subtitle: 'Авторские сорта кофе для дома, офиса и кофейни',
        cta: 'Выбрать кофе',
        badge: 'Новая партия',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'split-right-image',
      ...storyHero,
      ...wideSplit,
      ...marketStack,
    },
    blockOverrides: {
      ...textOverPhotoStory,
      ...hideStoryBadge,
      'vk-square': {
        title: { fontSize: 5.9, maxLines: 3, w: 47, charsPerLine: 18 },
        subtitle: { fontSize: 2.4, maxLines: 2, w: 42 },
        image: { x: 58, y: 8, w: 34, h: 84, rx: 18 },
      },
      'vk-vertical': {
        title: { fontSize: 5.9, maxLines: 3, w: 47, charsPerLine: 18 },
        subtitle: { fontSize: 2.35, maxLines: 2, w: 42 },
        image: { x: 58, y: 8, w: 34, h: 84, rx: 18 },
      },
      'vk-landscape': { title: { fontSize: 4.3, w: 44 }, subtitle: { hidden: true }, cta: { w: 24 } },
      ...priorityCompactCta,
    },
  },
  'fintech-card': {
    id: 'fintech-card',
    name: 'Fintech card',
    description: 'Vector Pay card kit for urban professionals: structured, trustworthy, modern, and benefit-led.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Карта для ежедневных трат',
      subtitle: 'Кэшбэк, лимиты и переводы в одном аккуратном приложении',
      cta: 'Оформить карту',
    },
    marketplaceCopy: {
      trait: '0 ₽ выпуск · лимиты · Apple Pay и переводы',
      benefit: 'До 5% кэшбэк',
      cta: 'Оформить карту',
      infographicSubtitle: 'Кэшбэк · Лимиты · Переводы',
    },
    brandKit: {
      brandName: 'Vector Pay',
      displayFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      textFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#BFD4E8',
        surface: '#071A2F',
        accent: '#54D79A',
        accentSoft: '#B8F1D2',
      },
      gradient: ['#071A2F', '#0D3F5E', '#167C73'],
      toneOfVoice: 'minimal',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#071A2F', '#0D3F5E', '#167C73'] },
      decor: { kind: 'dotted-grid', density: 10, color: '#FFFFFF', opacity: 0.12 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#BFD4E8',
        surface: '#071A2F',
        accent: '#54D79A',
        accentSoft: '#B8F1D2',
      },
      imageSrc: photo('photo-1554224155-6726b3ff858f'),
      image: { focalX: 0.52, focalY: 0.48, cropZoom: 1.03, rx: 18 },
      text: {
        title: 'Карта, которая **держит ритм**',
        subtitle: 'Кэшбэк до 5%, понятные лимиты и платежи без лишних экранов.',
        cta: 'Оформить карту',
        badge: 'До 5% кэшбэк',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'split-right-image',
      ...wideSplit,
      ...marketStack,
    },
    blockOverrides: {
      'vk-square': { title: { maxLines: 2, w: 48 }, subtitle: { w: 43 }, image: { x: 58, y: 10, w: 34, h: 80 } },
      'vk-landscape': { title: { fontSize: 4.4, w: 44 }, subtitle: { w: 40 } },
    },
  },
  'travel-retreat': {
    id: 'travel-retreat',
    name: 'Travel retreat',
    description: 'TERRA Retreat kit for premium weekend travel: calm, spacious, aspirational, and photo-first.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Уикенд у озера',
      subtitle: 'Три дня тишины, камерные домики и маршруты без спешки',
      cta: 'Выбрать даты',
    },
    marketplaceCopy: {
      trait: '3 дня · 2 ночи · завтрак включен',
      benefit: 'Места ограничены',
      cta: 'Выбрать даты',
      infographicSubtitle: 'Озеро · Завтрак · Маршруты',
    },
    brandKit: {
      brandName: 'TERRA Retreat',
      displayFont: '"Libre Baskerville", Georgia, "Times New Roman", serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#E5EEE9',
        surface: '#10211B',
        accent: '#EAC06A',
        accentSoft: '#F2D9A1',
      },
      gradient: ['#10211B', '#2F5D50', '#EAC06A'],
      toneOfVoice: 'editorial',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#10211B', '#2F5D50', '#EAC06A'] },
      decor: { kind: 'grain', seed: 24, intensity: 0.24 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#E5EEE9',
        surface: '#10211B',
        accent: '#EAC06A',
        accentSoft: '#F2D9A1',
      },
      imageSrc: photo('photo-1500530855697-b586d89ba3ee'),
      image: { focalX: 0.52, focalY: 0.54, cropZoom: 1.03, rx: 0 },
      text: {
        title: 'Три дня **тишины** у озера',
        subtitle: 'Камерные домики, завтраки на террасе и маршруты, в которых не нужно спешить.',
        cta: 'Выбрать даты',
        badge: 'Места ограничены',
      },
    }),
    preferredModels: {
      'vk-square': 'hero-overlay',
      'vk-vertical': 'hero-overlay',
      ...storyHero,
      ...wideSplit,
      ...marketStack,
    },
    blockOverrides: {
      ...textOverPhotoStory,
      'vk-square': { title: { y: 52, fontSize: 6.8, maxLines: 2 }, subtitle: { y: 67, maxLines: 2 }, cta: { y: 79, w: 34 } },
    },
  },
  'kids-school': {
    id: 'kids-school',
    name: 'Kids school',
    description: 'BrightNest School kit for parents: playful, optimistic, structured, and clear about enrollment.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Английский через проекты',
      subtitle: 'Мини-группы 7-10 лет с разговорной практикой и игрой',
      cta: 'Записаться',
    },
    marketplaceCopy: {
      trait: '7-10 лет · мини-группы до 8 детей',
      benefit: 'Пробный урок',
      cta: 'Записаться',
      infographicSubtitle: 'Игра · Проекты · Разговорная практика',
    },
    brandKit: {
      brandName: 'BrightNest School',
      displayFont: 'Nunito, "Inter Display", Inter, system-ui, sans-serif',
      textFont: 'Nunito, Inter, system-ui, sans-serif',
      palette: {
        ink: '#18324A',
        inkMuted: '#536A7D',
        surface: '#FFFDF5',
        accent: '#2F8DFF',
        accentSoft: '#FFE08A',
      },
      gradient: ['#FFF7C7', '#BDEBFF', '#FFD6B8'],
      toneOfVoice: 'friendly',
      ctaStyle: 'pill',
    },
    master: make({
      bg: { kind: 'tonal', base: '#FFF7C7' },
      decor: { kind: 'corner-circle', corner: 'bl', size: 34, color: '#2F8DFF', opacity: 0.2 },
      palette: {
        ink: '#18324A',
        inkMuted: '#536A7D',
        surface: '#FFFDF5',
        accent: '#2F8DFF',
        accentSoft: '#FFE08A',
      },
      ctaFill: '#FFFFFF',
      imageSrc: photo('photo-1503676260728-1c00da094a0b'),
      image: { focalX: 0.46, focalY: 0.42, cropZoom: 1.03, rx: 24 },
      text: {
        title: 'Английский через **игру** и проекты',
        subtitle: 'Мини-группы 7-10 лет: говорим, играем и собираем первые проекты на английском.',
        cta: 'Записаться',
        badge: 'Пробный урок',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'image-top-stack',
      'instagram-story': 'image-top-stack',
      'telegram-story': 'image-top-stack',
      'vk-stories': 'image-top-stack',
      ...wideSplit,
      ...marketStack,
    },
    blockOverrides: {
      'vk-square': { title: { fontSize: 6.2, maxLines: 2, w: 48 }, subtitle: { w: 42 }, image: { x: 57, y: 9, w: 34, h: 82, rx: 24 } },
    },
  },
  'estate-premium': {
    id: 'estate-premium',
    name: 'VISTA Residence',
    description: 'Luxury real estate kit for premium residential launches: architectural, calm, spacious, and refined.',
    industry: 'Luxury residential real estate',
    targetAudience: 'Покупатели квартир бизнес-класса и семьи, выбирающие спокойную городскую среду с видом и инфраструктурой.',
    valueProposition: 'Квартиры у воды с панорамными видами, приватным двором и готовой инфраструктурой.',
    visualMood: 'graphite, warm stone, champagne accent, spacious architectural restraint',
    recommendedImageStyle: 'Large architecture or waterfront residence photo with clean overlay and restrained premium color.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Квартиры у воды',
      subtitle: 'Виды, приватный двор и готовая инфраструктура',
      cta: 'Планировки',
    },
    marketplaceCopy: {
      trait: 'Бизнес-класс · вода · приватный двор',
      benefit: 'Старт продаж',
      cta: 'Планировки',
      infographicSubtitle: 'Вид · Двор · Инфраструктура',
    },
    brandKit: {
      brandName: 'VISTA Residence',
      logoText: 'VR',
      displayFont: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#F7F0E4',
        inkMuted: '#D7C8B0',
        surface: '#161719',
        accent: '#C9AA67',
        accentSoft: '#E7D6AF',
      },
      gradient: ['#161719', '#2B2A27', '#6D5B3A'],
      toneOfVoice: 'editorial',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'solid', color: '#161719' },
      decor: { kind: 'corner-bracket', corner: 'tr', size: 16, color: '#C9AA67', opacity: 0.62 },
      palette: {
        ink: '#F7F0E4',
        inkMuted: '#D7C8B0',
        surface: '#161719',
        accent: '#C9AA67',
        accentSoft: '#E7D6AF',
      },
      imageSrc: photo('photo-1600585154340-be6161a56a0c'),
      image: { focalX: 0.52, focalY: 0.5, cropZoom: 1.02, rx: 4 },
      ctaCharsPerLine: 20,
      text: {
        title: 'Квартиры бизнес-класса **у воды**',
        subtitle: 'Панорамные виды, приватный двор и готовая инфраструктура',
        cta: 'Смотреть планировки',
        badge: 'Старт продаж',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'hero-overlay',
      ...storyHero,
      ...wideSplit,
      ...marketStack,
      'avito-listing': 'split-right-image',
      'avito-skyscraper': 'image-top-stack',
    },
    blockOverrides: {
      ...textOverPhotoStory,
      ...hideStoryBadge,
      'vk-square': { title: { fontSize: 5.7, maxLines: 3, w: 46, charsPerLine: 18 }, subtitle: { w: 42 }, image: { x: 57, y: 8, w: 36, h: 84, rx: 4 } },
      'instagram-story': { title: { y: 58, fontSize: 6.1, maxLines: 3 }, subtitle: { y: 72, maxLines: 2 }, cta: { y: 81, w: 42 }, badge: { hidden: true } },
      'telegram-story': { title: { y: 58, fontSize: 6.1, maxLines: 3 }, subtitle: { y: 72, maxLines: 2 }, cta: { y: 81, w: 42 }, badge: { hidden: true } },
      'vk-stories': { title: { y: 58, fontSize: 6.1, maxLines: 3 }, subtitle: { y: 72, maxLines: 2 }, cta: { y: 81, w: 42 }, badge: { hidden: true } },
      'vk-landscape': { title: { fontSize: 4.0, w: 42 }, subtitle: { hidden: true }, cta: { w: 30 } },
      ...priorityCompactCta,
    },
  },
  'fitness-club': {
    id: 'fitness-club',
    name: 'Pulse Fitness',
    description: 'Energetic gym membership kit for urban fitness clubs: high-contrast, active, bold, and conversion-led.',
    industry: 'Fitness club and gym membership',
    targetAudience: 'Городские клиенты, которым нужен понятный старт, тренерская поддержка и регулярные тренировки.',
    valueProposition: 'Гостевой визит и программы, которые помогают встроить спорт в привычку.',
    visualMood: 'near-black, white, electric lime, punchy orange, dynamic high contrast',
    recommendedImageStyle: 'Dynamic training photo with strong crop, dark background, visible motion, and open area for text.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Тренировки в привычку',
      subtitle: 'Группы, тренер и восстановление в одном клубе',
      cta: 'Гостевой визит',
    },
    marketplaceCopy: {
      trait: '7 дней · тренер · группы',
      benefit: '7 дней бесплатно',
      cta: 'Гостевой визит',
      infographicSubtitle: 'Тренер · Силовая зона · Группы',
    },
    brandKit: {
      brandName: 'Pulse Fitness',
      logoText: 'PF',
      displayFont: 'Oswald, "Arial Narrow", Arial, sans-serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#F8FFE8',
        inkMuted: '#D8E9CA',
        surface: '#0D0F0C',
        accent: '#D7FF38',
        accentSoft: '#FF6B2C',
      },
      gradient: ['#0D0F0C', '#1A1F17', '#FF6B2C'],
      toneOfVoice: 'bold',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'solid', color: '#0D0F0C' },
      decor: { kind: 'diagonal-stripe', color: '#D7FF38', opacity: 0.14 },
      palette: {
        ink: '#F8FFE8',
        inkMuted: '#D8E9CA',
        surface: '#0D0F0C',
        accent: '#D7FF38',
        accentSoft: '#FF6B2C',
      },
      imageSrc: photo('photo-1517836357463-d25dfeac3438'),
      image: { focalX: 0.5, focalY: 0.42, cropZoom: 1.12, rx: 0 },
      ctaCharsPerLine: 24,
      badgeCharsPerLine: 16,
      text: {
        title: 'Тренировки, которые **входят в привычку**',
        subtitle: 'Персональные программы, групповые занятия и зона восстановления',
        cta: 'Получить гостевой визит',
        badge: '7 дней бесплатно',
      },
    }),
    preferredModels: {
      'vk-square': 'hero-overlay',
      'vk-vertical': 'hero-overlay',
      ...storyHero,
      ...wideSplit,
      ...marketStack,
    },
    blockOverrides: {
      ...textOverPhotoStory,
      ...hideStoryBadge,
      'vk-square': { title: { y: 48, fontSize: 6.2, maxLines: 3, w: 70, charsPerLine: 18 }, subtitle: { y: 70, maxLines: 2, w: 58 }, cta: { y: 82, w: 44 } },
      'vk-landscape': { image: { x: 55, y: 0, w: 45, h: 100, rx: 0 } },
      'instagram-story': { title: { y: 54, fontSize: 6.5, maxLines: 3, charsPerLine: 18 }, subtitle: { y: 72, maxLines: 2 }, cta: { y: 82, w: 44 }, badge: { hidden: true } },
      'telegram-story': { title: { y: 54, fontSize: 6.5, maxLines: 3, charsPerLine: 18 }, subtitle: { y: 72, maxLines: 2 }, cta: { y: 82, w: 44 }, badge: { hidden: true } },
      'vk-stories': { title: { y: 54, fontSize: 6.5, maxLines: 3, charsPerLine: 18 }, subtitle: { y: 72, maxLines: 2 }, cta: { y: 82, w: 44 }, badge: { hidden: true } },
      'yandex-market-banner': { badge: { hidden: true } },
      'yandex-rsy-300x250': { subtitle: { hidden: true }, badge: { fontSize: 1.5 }, cta: { w: 46 } },
      ...priorityCompactCta,
    },
  },
  'farm-grocery': {
    id: 'farm-grocery',
    name: 'Farm grocery',
    description: 'Harvest Lane kit for local grocery delivery: fresh, organic, honest, and produce-focused.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Свежий привоз сегодня',
      subtitle: 'Сезонные овощи от локальных фермеров с доставкой в день сбора',
      cta: 'Собрать корзину',
    },
    marketplaceCopy: {
      trait: 'Набор 2.4 кг · локальные фермы',
      benefit: 'Свежий привоз',
      cta: 'Собрать корзину',
      infographicSubtitle: 'Сезон · Фермы · Доставка',
    },
    brandKit: {
      brandName: 'Harvest Lane',
      displayFont: 'Fraunces, "Playfair Display", Georgia, serif',
      textFont: 'Manrope, Inter, system-ui, sans-serif',
      palette: {
        ink: '#173B2F',
        inkMuted: '#536B5D',
        surface: '#FFF9E8',
        accent: '#2F8F5B',
        accentSoft: '#C7E8C7',
      },
      gradient: ['#FFF9E8', '#DDEEC5', '#8CCF97'],
      toneOfVoice: 'friendly',
      ctaStyle: 'pill',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#FFF9E8', '#DDEEC5', '#8CCF97'] },
      decor: { kind: 'half-circle', edge: 'right', size: 32, color: '#2F8F5B', opacity: 0.14 },
      palette: {
        ink: '#173B2F',
        inkMuted: '#536B5D',
        surface: '#FFF9E8',
        accent: '#2F8F5B',
        accentSoft: '#C7E8C7',
      },
      imageSrc: photo('photo-1542838132-92c53300491e'),
      image: { focalX: 0.48, focalY: 0.52, cropZoom: 1.02, rx: 20 },
      text: {
        title: 'Овощи, собранные **сегодня**',
        subtitle: 'Сезонные наборы от локальных фермеров с доставкой в день сбора.',
        cta: 'Собрать корзину',
        badge: 'Свежий привоз',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'image-top-stack',
      'instagram-story': 'image-top-stack',
      'telegram-story': 'image-top-stack',
      'vk-stories': 'image-top-stack',
      ...wideSplit,
      ...marketStack,
      'ozon-fresh-square': 'product-card-safe',
    },
    blockOverrides: {
      'vk-square': { title: { fontSize: 6.3, maxLines: 2, w: 48 }, subtitle: { w: 42 }, image: { x: 56, y: 9, w: 36, h: 82, rx: 20 } },
    },
  },
  'saas-dashboard': {
    id: 'saas-dashboard',
    name: 'MetricFlow',
    description: 'MetricFlow kit for B2B teams: crisp, analytical, product-led, and built around a demo funnel.',
    industry: 'B2B SaaS analytics dashboard',
    targetAudience: 'Операционные, sales и growth-команды, которым нужен быстрый контроль метрик без ручной отчетности.',
    valueProposition: 'Единый дашборд для продаж, воронки и retention с понятным демо-флоу.',
    visualMood: 'deep navy, clean white surfaces, cyan-blue accent, structured dashboard preview',
    recommendedImageStyle: 'Dashboard UI preview, analytics panels, subtle grid, clean product surface without neon clutter.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Показатели в одном дашборде',
      subtitle: 'Продажи, воронка и retention без ручных отчетов',
      cta: 'Демо',
    },
    marketplaceCopy: {
      trait: 'Продажи · воронка · retention',
      benefit: 'Для команд',
      cta: 'Попробовать демо',
      infographicSubtitle: 'Продажи · Retention · Отчеты',
    },
    brandKit: {
      brandName: 'MetricFlow',
      logoText: 'MF',
      displayFont: '"Space Grotesk", "Inter Display", Inter, system-ui, sans-serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#B8C7E6',
        surface: '#08111F',
        accent: '#3DB7FF',
        accentSoft: '#76E4F7',
      },
      gradient: ['#08111F', '#10233B', '#1B5EA8'],
      toneOfVoice: 'minimal',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#08111F', '#10233B', '#1B5EA8'] },
      decor: { kind: 'dotted-grid', density: 10, color: '#FFFFFF', opacity: 0.08 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#B8C7E6',
        surface: '#08111F',
        accent: '#3DB7FF',
        accentSoft: '#76E4F7',
      },
      imageSrc: photo('photo-1551288049-bebda4e38f71'),
      image: { focalX: 0.54, focalY: 0.46, cropZoom: 1.02, rx: 18 },
      ctaCharsPerLine: 18,
      text: {
        title: 'Контроль показателей **в одном дашборде**',
        subtitle: 'Отслеживайте продажи, воронку и retention без ручных отчётов',
        cta: 'Попробовать демо',
        badge: 'Для команд',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'split-right-image',
      ...storyHero,
      ...wideSplit,
      ...marketStack,
    },
    blockOverrides: {
      ...hideStoryBadge,
      'vk-square': { title: { fontSize: 5.8, maxLines: 3, w: 48, charsPerLine: 18 }, subtitle: { w: 43 }, image: { x: 57, y: 10, w: 36, h: 80, rx: 18 } },
      'vk-vertical': { title: { fontSize: 5.8, maxLines: 3, w: 48, charsPerLine: 18 }, subtitle: { w: 43 }, image: { x: 57, y: 10, w: 36, h: 80, rx: 18 } },
      'instagram-story': { title: { y: 55, fontSize: 5.8, maxLines: 3 }, subtitle: { y: 72, maxLines: 2 }, cta: { y: 82, w: 36 }, badge: { hidden: true } },
      'telegram-story': { title: { y: 55, fontSize: 5.8, maxLines: 3 }, subtitle: { y: 72, maxLines: 2 }, cta: { y: 82, w: 36 }, badge: { hidden: true } },
      'vk-stories': { title: { y: 55, fontSize: 5.8, maxLines: 3 }, subtitle: { y: 72, maxLines: 2 }, cta: { y: 82, w: 36 }, badge: { hidden: true } },
      'vk-landscape': { title: { fontSize: 4.0, w: 44 }, subtitle: { hidden: true }, cta: { w: 28 } },
      'yandex-rsy-300x250': { subtitle: { hidden: true }, cta: { w: 44 } },
      ...priorityCompactCta,
    },
  },
}

export const TEMPLATES: Template[] = TEMPLATE_ORDER.map((id) => withFormatSettings(REDESIGNED_TEMPLATES[id]))

export function getTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null
}
