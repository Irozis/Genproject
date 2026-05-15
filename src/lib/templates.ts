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
  'wb-card': 'image-top-stack',
  'wb-infographic': 'image-top-stack',
  'ozon-card': 'image-top-stack',
  'ozon-fresh-square': 'image-top-stack',
  'yandex-market-card': 'image-top-stack',
  'yandex-market-vertical': 'image-top-stack',
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

const RAW_TEMPLATES: Template[] = [
  {
    id: 'fashion-drop',
    name: 'Fashion drop',
    description: 'Editorial capsule launch with bold typography, black-white contrast, and a single electric retail accent.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Urban Capsule',
      subtitle: 'Лимитированный дроп уже онлайн',
      cta: 'Смотреть',
    },
    marketplaceCopy: {
      trait: 'Капсула · худи · деним · аксессуары',
      benefit: 'Limited drop',
      cta: 'Купить',
      infographicSubtitle: 'Лимит · Новые силуэты · Доставка',
    },
    brandKit: {
      brandName: 'MONO ROOM',
      displayFont: '"Bebas Neue", Impact, "Arial Black", sans-serif',
      textFont: 'Montserrat, Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#D6D6D6',
        surface: '#070707',
        accent: '#D8FF2F',
        accentSoft: '#F1FF9A',
      },
      gradient: ['#070707', '#1E1E1E', '#D8FF2F'],
      toneOfVoice: 'bold',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'solid', color: '#070707' },
      decor: { kind: 'diagonal-stripe', color: '#D8FF2F', opacity: 0.18 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#D6D6D6',
        surface: '#070707',
        accent: '#D8FF2F',
        accentSoft: '#F1FF9A',
      },
      imageSrc: photo('photo-1529139574466-a303027c1d8b'),
      image: { focalX: 0.48, focalY: 0.42, cropZoom: 1.06, rx: 0 },
      text: {
        title: 'Новая **капсула** в городе',
        subtitle: 'Графичные силуэты, плотный хлопок и вещи, которые быстро заканчиваются.',
        cta: 'Смотреть дроп',
        badge: 'Drop 04',
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
        title: { y: 50, fontSize: 7.2, maxLines: 2 },
        subtitle: { y: 66, fontSize: 2.6, maxLines: 2 },
        cta: { y: 78, w: 34, h: 7 },
      },
      'vk-landscape': { title: { fontSize: 5, w: 40 }, image: { x: 55, y: 0, w: 45, h: 100, rx: 0 } },
    },
  },
  {
    id: 'skincare-lab',
    name: 'Skincare lab',
    description: 'Clean clinical beauty system with soft neutrals, airy spacing, calm claims, and product-first compositions.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Барьерный уход',
      subtitle: 'Керамиды и ниацинамид',
      cta: 'Выбрать',
    },
    marketplaceCopy: {
      trait: 'Сыворотка 30 мл · без отдушки',
      benefit: 'pH 5.5',
      cta: 'В корзину',
      infographicSubtitle: 'Керамиды · Ниацинамид · Без отдушки',
    },
    brandKit: {
      brandName: 'Luma Lab',
      displayFont: '"DM Serif Display", "Playfair Display", Georgia, serif',
      textFont: 'Manrope, Inter, system-ui, sans-serif',
      palette: {
        ink: '#24312D',
        inkMuted: '#63736C',
        surface: '#FBF8F2',
        accent: '#7DA58D',
        accentSoft: '#DDE8DD',
      },
      gradient: ['#FBF8F2', '#EAF1EA', '#D8E7E2'],
      toneOfVoice: 'minimal',
      ctaStyle: 'pill',
    },
    master: make({
      bg: { kind: 'solid', color: '#FBF8F2' },
      decor: { kind: 'corner-circle', corner: 'br', size: 40, color: '#7DA58D', opacity: 0.14 },
      palette: {
        ink: '#24312D',
        inkMuted: '#63736C',
        surface: '#FBF8F2',
        accent: '#7DA58D',
        accentSoft: '#DDE8DD',
      },
      imageSrc: photo('photo-1556228720-195a672e8a03'),
      image: { focalX: 0.5, focalY: 0.5, cropZoom: 1.02, rx: 24 },
      text: {
        title: 'Уход для **спокойного** барьера',
        subtitle: 'Керамиды, ниацинамид и честная формула без лишнего шума.',
        cta: 'Выбрать уход',
        badge: 'Sensitive',
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
        title: { fontSize: 6.4, maxLines: 2, w: 46 },
        subtitle: { fontSize: 2.45, maxLines: 2, w: 42 },
        image: { x: 57, y: 9, w: 34, h: 82, rx: 24, fit: 'cover' },
      },
      'vk-vertical': { image: { fit: 'cover', focalY: 0.52 } },
    },
  },
  {
    id: 'coffee-roastery',
    name: 'Coffee roastery',
    description: 'Warm artisanal roastery kit with rich browns, tactile grain, sensory copy, and honest product details.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Эфиопия Нансебо',
      subtitle: 'Ягоды, какао и свежая обжарка',
      cta: 'Выбрать',
    },
    marketplaceCopy: {
      trait: '250 г · фильтр · обжарка 12 мая',
      benefit: 'Свежая обжарка',
      cta: 'В корзину',
      infographicSubtitle: 'Ягоды · Какао · Фильтр',
    },
    brandKit: {
      brandName: 'North Roast',
      displayFont: 'Fraunces, "Playfair Display", Georgia, serif',
      textFont: 'Manrope, Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFF3DF',
        inkMuted: '#E2C5A2',
        surface: '#1B1008',
        accent: '#D4934D',
        accentSoft: '#F0C995',
      },
      gradient: ['#1B1008', '#4B2B17', '#8D5329'],
      toneOfVoice: 'editorial',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#1B1008', '#3C2111', '#7A4520'] },
      decor: { kind: 'grain', seed: 18, intensity: 0.42 },
      palette: {
        ink: '#FFF3DF',
        inkMuted: '#E2C5A2',
        surface: '#1B1008',
        accent: '#D4934D',
        accentSoft: '#F0C995',
      },
      imageSrc: photo('photo-1495474472287-4d71bcdd2085'),
      image: { focalX: 0.52, focalY: 0.5, cropZoom: 1.03, rx: 18 },
      text: {
        title: 'Свежая **обжарка** к утру',
        subtitle: 'Моносорт Эфиопия Нансебо: ягоды, какао и мягкая кислотность.',
        cta: 'Выбрать кофе',
        badge: 'Roast date',
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
  {
    id: 'fintech-card',
    name: 'Fintech card',
    description: 'Structured financial service preset with confident blues, clear product benefits, and conversion-led layout.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Счет за 10 минут',
      subtitle: 'Карты, лимиты и платежи',
      cta: 'Открыть',
    },
    marketplaceCopy: {
      trait: '0 ₽ открытие · карты для команды',
      benefit: 'Для бизнеса',
      cta: 'Оформить',
      infographicSubtitle: 'Счет · Карты · Лимиты · API',
    },
    brandKit: {
      brandName: 'North Pay',
      displayFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      textFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#C8D8F4',
        surface: '#071427',
        accent: '#77F6B2',
        accentSoft: '#BDF7D8',
      },
      gradient: ['#071427', '#123B68', '#245CE0'],
      toneOfVoice: 'minimal',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#071427', '#123B68', '#245CE0'] },
      decor: { kind: 'dotted-grid', density: 10, color: '#FFFFFF', opacity: 0.12 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#C8D8F4',
        surface: '#071427',
        accent: '#77F6B2',
        accentSoft: '#BDF7D8',
      },
      imageSrc: photo('photo-1554224155-6726b3ff858f'),
      image: { focalX: 0.52, focalY: 0.48, cropZoom: 1.03, rx: 18 },
      text: {
        title: 'Финансы бизнеса **под контролем**',
        subtitle: 'Счет, карты, лимиты и платежный календарь в одном приложении.',
        cta: 'Оформить счет',
        badge: '0 ₽ старт',
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
  {
    id: 'travel-retreat',
    name: 'Travel retreat',
    description: 'Premium escape preset with scenic image dominance, calm spacing, warm hospitality copy, and airy overlays.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Три дня у озера',
      subtitle: 'Домики, завтраки и маршруты',
      cta: 'Даты',
    },
    marketplaceCopy: {
      trait: '3 дня · 2 ночи · завтрак включен',
      benefit: 'Раннее бронирование',
      cta: 'Забронировать',
      infographicSubtitle: 'Озеро · Завтрак · Маршруты',
    },
    brandKit: {
      brandName: 'Slow North',
      displayFont: '"Libre Baskerville", Georgia, "Times New Roman", serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#E0E9E4',
        surface: '#10211B',
        accent: '#F3C66F',
        accentSoft: '#F7DDA6',
      },
      gradient: ['#10211B', '#2F5D50', '#F3C66F'],
      toneOfVoice: 'editorial',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#10211B', '#2F5D50', '#F3C66F'] },
      decor: { kind: 'grain', seed: 24, intensity: 0.28 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#E0E9E4',
        surface: '#10211B',
        accent: '#F3C66F',
        accentSoft: '#F7DDA6',
      },
      imageSrc: photo('photo-1500530855697-b586d89ba3ee'),
      image: { focalX: 0.52, focalY: 0.54, cropZoom: 1.03, rx: 0 },
      text: {
        title: 'Три дня **тишины** у озера',
        subtitle: 'Домики с камином, завтраки на террасе и маршруты без спешки.',
        cta: 'Забронировать',
        badge: 'Early booking',
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
      'vk-square': { title: { y: 52, fontSize: 6.8, maxLines: 2 }, subtitle: { y: 67, maxLines: 2 }, cta: { y: 79 } },
    },
  },
  {
    id: 'kids-school',
    name: 'Kids school',
    description: 'Friendly education starter with bright controlled color, rounded energy, clear parent-facing enrollment copy.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Английский через игру',
      subtitle: 'Мини-группы 7-10 лет',
      cta: 'Записаться',
    },
    marketplaceCopy: {
      trait: '7-10 лет · мини-группы до 8 детей',
      benefit: 'Пробный урок',
      cta: 'Записаться',
      infographicSubtitle: 'Игра · Проекты · Разговорная практика',
    },
    brandKit: {
      brandName: 'Bright Kids',
      displayFont: 'Nunito, "Inter Display", Inter, system-ui, sans-serif',
      textFont: 'Nunito, Inter, system-ui, sans-serif',
      palette: {
        ink: '#18324A',
        inkMuted: '#51677A',
        surface: '#FFFDF5',
        accent: '#FF8A3D',
        accentSoft: '#FFD6B8',
      },
      gradient: ['#FFF4B8', '#BDEBFF', '#FFD6B8'],
      toneOfVoice: 'friendly',
      ctaStyle: 'pill',
    },
    master: make({
      bg: { kind: 'tonal', base: '#FFF4B8' },
      decor: { kind: 'corner-circle', corner: 'bl', size: 38, color: '#49B6FF', opacity: 0.26 },
      palette: {
        ink: '#18324A',
        inkMuted: '#51677A',
        surface: '#FFFDF5',
        accent: '#FF8A3D',
        accentSoft: '#FFD6B8',
      },
      imageSrc: photo('photo-1503676260728-1c00da094a0b'),
      image: { focalX: 0.46, focalY: 0.42, cropZoom: 1.03, rx: 24 },
      text: {
        title: 'Английский через **игру** и проекты',
        subtitle: 'Мини-группы 7-10 лет: говорим, играем и собираем первые проекты.',
        cta: 'Записаться',
        badge: 'Набор открыт',
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
  {
    id: 'estate-premium',
    name: 'Premium estate',
    description: 'Refined real-estate campaign with architectural imagery, restrained luxury palette, and consultation-first CTA.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Дом у парка',
      subtitle: '186 м², терраса и готовый интерьер',
      cta: 'Просмотр',
    },
    marketplaceCopy: {
      trait: '186 м² · 4 спальни · вид на парк',
      benefit: 'Закрытый показ',
      cta: 'Смотреть',
      infographicSubtitle: 'Терраса · Парк · 4 спальни',
    },
    brandKit: {
      brandName: 'Aurum Estate',
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
      decor: { kind: 'corner-bracket', corner: 'tr', size: 18, color: '#C9A45C', opacity: 0.8 },
      palette: {
        ink: '#F8F1E4',
        inkMuted: '#D9CAB0',
        surface: '#17120D',
        accent: '#C9A45C',
        accentSoft: '#EBD8A4',
      },
      imageSrc: photo('photo-1600585154340-be6161a56a0c'),
      image: { focalX: 0.52, focalY: 0.5, cropZoom: 1.02, rx: 12 },
      text: {
        title: 'Резиденция **у парка**',
        subtitle: '186 м², терраса, панорамные окна и готовый интерьер.',
        cta: 'Записаться на просмотр',
        badge: 'Private viewing',
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
      'vk-square': { title: { fontSize: 6.2, maxLines: 2, w: 46 }, subtitle: { w: 42 }, image: { x: 57, y: 8, w: 36, h: 84, rx: 12 } },
    },
  },
  {
    id: 'fitness-club',
    name: 'Fitness club',
    description: 'High-contrast athletic pack with motion-heavy imagery, direct challenge copy, and a loud action CTA.',
    enabled: { badge: true },
    compactCopy: {
      title: '8 недель силы',
      subtitle: 'Тренер, питание и замеры',
      cta: 'Начать',
    },
    marketplaceCopy: {
      trait: '8 недель · 24 тренировки · замеры',
      benefit: '-20% на старт',
      cta: 'Записаться',
      infographicSubtitle: 'Тренер · Питание · Прогресс',
    },
    brandKit: {
      brandName: 'Pulse Club',
      displayFont: 'Oswald, "Arial Narrow", Arial, sans-serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#F7FFE8',
        inkMuted: '#D7E8C8',
        surface: '#10120D',
        accent: '#B6FF2E',
        accentSoft: '#E4FF9A',
      },
      gradient: ['#10120D', '#253116', '#B6FF2E'],
      toneOfVoice: 'bold',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'solid', color: '#10120D' },
      decor: { kind: 'diagonal-stripe', color: '#B6FF2E', opacity: 0.18 },
      palette: {
        ink: '#F7FFE8',
        inkMuted: '#D7E8C8',
        surface: '#10120D',
        accent: '#B6FF2E',
        accentSoft: '#E4FF9A',
      },
      imageSrc: photo('photo-1517836357463-d25dfeac3438'),
      image: { focalX: 0.5, focalY: 0.42, cropZoom: 1.08, rx: 0 },
      text: {
        title: '8 недель до **сильной** формы',
        subtitle: 'Тренер, питание и еженедельные замеры в одной программе.',
        cta: 'Начать',
        badge: 'Challenge',
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
      'vk-square': { title: { y: 52, fontSize: 7.1, maxLines: 2 }, subtitle: { y: 68, maxLines: 2 }, cta: { y: 79, w: 30 } },
      'vk-landscape': { image: { x: 55, y: 0, w: 45, h: 100, rx: 0 } },
    },
  },
  {
    id: 'farm-grocery',
    name: 'Farm grocery',
    description: 'Fresh local grocery system with produce-led imagery, honest seasonal copy, and approachable organic color.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Овощи к ужину',
      subtitle: 'Сезонные наборы с доставкой',
      cta: 'Заказать',
    },
    marketplaceCopy: {
      trait: 'Набор 2.4 кг · локальные фермы',
      benefit: 'Сегодня свежее',
      cta: 'В корзину',
      infographicSubtitle: 'Сезон · Фермы · Доставка',
    },
    brandKit: {
      brandName: 'Fresh Field',
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
      decor: { kind: 'half-circle', edge: 'right', size: 34, color: '#2F8F5B', opacity: 0.16 },
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
        title: 'Сезонные овощи **к ужину**',
        subtitle: 'Наборы от локальных фермеров с доставкой в день сбора.',
        cta: 'Собрать корзину',
        badge: 'Local farms',
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
      'ozon-fresh-square': 'split-right-image',
    },
    blockOverrides: {
      'vk-square': { title: { fontSize: 6.3, maxLines: 2, w: 48 }, subtitle: { w: 42 }, image: { x: 56, y: 9, w: 36, h: 82, rx: 20 } },
    },
  },
  {
    id: 'saas-dashboard',
    name: 'SaaS dashboard',
    description: 'Crisp B2B product preset with dashboard-like imagery, efficient grids, and a clear demo-request funnel.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Метрики продаж',
      subtitle: 'Демо за 15 минут',
      cta: 'Демо',
    },
    marketplaceCopy: {
      trait: 'CRM · отчеты · 30 дней триала',
      benefit: 'B2B SaaS',
      cta: 'Попробовать',
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
      decor: { kind: 'dotted-grid', density: 12, color: '#FFFFFF', opacity: 0.11 },
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
        cta: 'Запросить демо',
        badge: 'Product demo',
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
]

export const TEMPLATES: Template[] = RAW_TEMPLATES.map(withFormatSettings)

export function getTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null
}
