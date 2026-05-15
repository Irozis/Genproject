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

const make = ({ bg, decor, palette, text, ctaFill, imageSrc, image: imageOverrides }: BaseArgs): Scene => {
  const scene: Scene = {
    background: bg,
    accent: palette.accent,
    title: title(text.title, palette.ink),
    subtitle: subtitle(text.subtitle, palette.ink),
    cta: cta(text.cta, palette.accent, ctaFill ?? palette.surface, 999),
    badge: badge(text.badge, palette.accent),
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
    name: 'Skincare lab',
    description: 'Luma Lab dermocosmetics kit for sensitive-skin buyers: clinical, soft, premium, and spacious.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Барьерный уход',
      subtitle: 'Керамиды, ниацинамид и спокойная формула без отдушек',
      cta: 'Подобрать уход',
    },
    marketplaceCopy: {
      trait: 'Сыворотка 30 мл · pH 5.5 · без отдушек',
      benefit: 'Новинка',
      cta: 'Подобрать уход',
      infographicSubtitle: 'Керамиды · Ниацинамид · Без отдушек',
    },
    brandKit: {
      brandName: 'Luma Lab',
      displayFont: '"DM Serif Display", "Playfair Display", Georgia, serif',
      textFont: 'Manrope, Inter, system-ui, sans-serif',
      palette: {
        ink: '#21312D',
        inkMuted: '#687B74',
        surface: '#FBF8F1',
        accent: '#6F9E8A',
        accentSoft: '#DCEBE4',
      },
      gradient: ['#FBF8F1', '#ECF4EF', '#DCEBE4'],
      toneOfVoice: 'minimal',
      ctaStyle: 'pill',
    },
    master: make({
      bg: { kind: 'solid', color: '#FBF8F1' },
      decor: { kind: 'corner-circle', corner: 'br', size: 36, color: '#6F9E8A', opacity: 0.12 },
      palette: {
        ink: '#21312D',
        inkMuted: '#687B74',
        surface: '#FBF8F1',
        accent: '#6F9E8A',
        accentSoft: '#DCEBE4',
      },
      imageSrc: photo('photo-1556228720-195a672e8a03'),
      image: { focalX: 0.5, focalY: 0.52, cropZoom: 1.0, rx: 24 },
      text: {
        title: 'Формула для **спокойного** барьера',
        subtitle: 'Керамиды, ниацинамид и легкая текстура для кожи, которой нужен бережный режим.',
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
        title: { fontSize: 6.3, maxLines: 2, w: 46 },
        subtitle: { fontSize: 2.35, maxLines: 2, w: 42 },
        image: { x: 57, y: 10, w: 34, h: 80, rx: 24, fit: 'cover' },
      },
      'vk-vertical': { image: { fit: 'cover', focalY: 0.5 } },
    },
  },
  'coffee-roastery': {
    id: 'coffee-roastery',
    name: 'Coffee roastery',
    description: 'Ember Roastery kit for craft coffee drinkers: warm, tactile, batch-specific, and quietly premium.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Эфиопия Нансебо',
      subtitle: 'Свежая партия с ягодами, какао и мягкой кислотностью',
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
      displayFont: 'Fraunces, "Playfair Display", Georgia, serif',
      textFont: 'Manrope, Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFF3DF',
        inkMuted: '#E5C59A',
        surface: '#1D1109',
        accent: '#C77732',
        accentSoft: '#F0C18A',
      },
      gradient: ['#1D1109', '#4A2A17', '#8D4C24'],
      toneOfVoice: 'editorial',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#1D1109', '#3A2113', '#70401F'] },
      decor: { kind: 'grain', seed: 18, intensity: 0.36 },
      palette: {
        ink: '#FFF3DF',
        inkMuted: '#E5C59A',
        surface: '#1D1109',
        accent: '#C77732',
        accentSoft: '#F0C18A',
      },
      imageSrc: photo('photo-1495474472287-4d71bcdd2085'),
      image: { focalX: 0.52, focalY: 0.5, cropZoom: 1.03, rx: 18 },
      text: {
        title: 'Свежая **партия** к утру',
        subtitle: 'Эфиопия Нансебо: ягоды, какао и обжарка, которую подписываем датой, а не обещанием.',
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
      'vk-square': {
        title: { fontSize: 6.2, maxLines: 2, w: 47 },
        subtitle: { fontSize: 2.4, maxLines: 2, w: 42 },
        image: { x: 58, y: 8, w: 34, h: 84, rx: 18 },
      },
      'vk-vertical': {
        title: { fontSize: 6.2, maxLines: 2, w: 47 },
        subtitle: { fontSize: 2.35, maxLines: 2, w: 42 },
        image: { x: 58, y: 8, w: 34, h: 84, rx: 18 },
      },
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
    name: 'Premium estate',
    description: 'Vesper Estate kit for premium real estate: architectural, elegant, restrained, and image-dominant.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Резиденция у парка',
      subtitle: 'Панорамные окна, террасы и готовые планировки для жизни рядом с зеленью',
      cta: 'Смотреть планировки',
    },
    marketplaceCopy: {
      trait: '186 м² · 4 спальни · вид на парк',
      benefit: 'Старт продаж',
      cta: 'Планировки',
      infographicSubtitle: 'Терраса · Парк · 4 спальни',
    },
    brandKit: {
      brandName: 'Vesper Estate',
      displayFont: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#F8F1E4',
        inkMuted: '#D9CAB0',
        surface: '#17120D',
        accent: '#C9A45C',
        accentSoft: '#EBD8A4',
      },
      gradient: ['#17120D', '#2B241B', '#4A3621'],
      toneOfVoice: 'editorial',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'solid', color: '#17120D' },
      decor: { kind: 'corner-bracket', corner: 'tr', size: 18, color: '#C9A45C', opacity: 0.75 },
      palette: {
        ink: '#F8F1E4',
        inkMuted: '#D9CAB0',
        surface: '#17120D',
        accent: '#C9A45C',
        accentSoft: '#EBD8A4',
      },
      imageSrc: photo('photo-1600585154340-be6161a56a0c'),
      image: { focalX: 0.52, focalY: 0.5, cropZoom: 1.02, rx: 8 },
      text: {
        title: 'Архитектура **у парка**',
        subtitle: 'Клубный дом с террасами, панорамными окнами и планировками для спокойной городской жизни.',
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
      'vk-square': { title: { fontSize: 6.2, maxLines: 2, w: 46 }, subtitle: { w: 42 }, image: { x: 57, y: 8, w: 36, h: 84, rx: 8 } },
    },
  },
  'fitness-club': {
    id: 'fitness-club',
    name: 'Fitness club',
    description: 'Pulse Fitness kit for active city audiences: energetic, high-contrast, bold, and action-heavy.',
    enabled: { badge: true },
    compactCopy: {
      title: '7 дней в Pulse',
      subtitle: 'Гостевой визит, тренер и сильный старт без долгих обещаний',
      cta: 'Гостевой визит',
    },
    marketplaceCopy: {
      trait: '7 дней · тренер · силовая зона и групповые',
      benefit: '7 дней бесплатно',
      cta: 'Гостевой визит',
      infographicSubtitle: 'Тренер · Силовая зона · Группы',
    },
    brandKit: {
      brandName: 'Pulse Fitness',
      displayFont: 'Oswald, "Arial Narrow", Arial, sans-serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#F7FFE8',
        inkMuted: '#D5E6C8',
        surface: '#10120D',
        accent: '#FF6B2C',
        accentSoft: '#C9FF4A',
      },
      gradient: ['#10120D', '#2B2118', '#FF6B2C'],
      toneOfVoice: 'bold',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'solid', color: '#10120D' },
      decor: { kind: 'diagonal-stripe', color: '#C9FF4A', opacity: 0.16 },
      palette: {
        ink: '#F7FFE8',
        inkMuted: '#D5E6C8',
        surface: '#10120D',
        accent: '#FF6B2C',
        accentSoft: '#C9FF4A',
      },
      imageSrc: photo('photo-1517836357463-d25dfeac3438'),
      image: { focalX: 0.5, focalY: 0.42, cropZoom: 1.08, rx: 0 },
      text: {
        title: 'Сильный старт **без паузы**',
        subtitle: 'Гостевой визит на 7 дней: тренер, силовая зона и групповые классы в одном пропуске.',
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
      'vk-square': { title: { y: 52, fontSize: 7.1, maxLines: 2 }, subtitle: { y: 68, maxLines: 2 }, cta: { y: 79, w: 44 } },
      'vk-landscape': { image: { x: 55, y: 0, w: 45, h: 100, rx: 0 } },
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
    name: 'SaaS dashboard',
    description: 'MetricFlow kit for B2B teams: crisp, analytical, product-led, and built around a demo funnel.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Метрики продаж в фокусе',
      subtitle: 'Воронка, прогноз и отчеты для команды без ручных таблиц',
      cta: 'Попробовать демо',
    },
    marketplaceCopy: {
      trait: 'CRM · отчеты · 30 дней триала',
      benefit: 'Для команд',
      cta: 'Попробовать демо',
      infographicSubtitle: 'CRM · Воронка · Отчеты',
    },
    brandKit: {
      brandName: 'MetricFlow',
      displayFont: '"Space Grotesk", "Inter Display", Inter, system-ui, sans-serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#B9C8E8',
        surface: '#08111F',
        accent: '#4FE3C1',
        accentSoft: '#A8F2DE',
      },
      gradient: ['#08111F', '#102A43', '#1C6DD0'],
      toneOfVoice: 'minimal',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#08111F', '#102A43', '#1C6DD0'] },
      decor: { kind: 'dotted-grid', density: 12, color: '#FFFFFF', opacity: 0.1 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#B9C8E8',
        surface: '#08111F',
        accent: '#4FE3C1',
        accentSoft: '#A8F2DE',
      },
      imageSrc: photo('photo-1551288049-bebda4e38f71'),
      image: { focalX: 0.54, focalY: 0.46, cropZoom: 1.02, rx: 18 },
      text: {
        title: 'Воронка продаж **на одном экране**',
        subtitle: 'Прогноз, задачи и отчеты для команды без ручных таблиц.',
        cta: 'Попробовать демо',
        badge: 'Для команд',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'split-right-image',
      ...wideSplit,
      ...marketStack,
    },
    blockOverrides: {
      'vk-square': { title: { fontSize: 6.2, maxLines: 2, w: 48 }, subtitle: { w: 43 }, image: { x: 57, y: 10, w: 36, h: 80, rx: 18 } },
      'vk-landscape': { title: { fontSize: 4.3, w: 44 }, subtitle: { w: 40 } },
    },
  },
}

export const TEMPLATES: Template[] = TEMPLATE_ORDER.map((id) => withFormatSettings(REDESIGNED_TEMPLATES[id]))

export function getTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null
}
