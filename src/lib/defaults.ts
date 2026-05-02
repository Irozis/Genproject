// Default Scene, BrandKit, EnabledMap, Project for a fresh project.

import type {
  BrandKit,
  EnabledMap,
  FormatKey,
  Palette,
  Project,
  Scene,
} from './types'
import { DEFAULT_COMPOSITION_BY_FORMAT } from './formats'
import { compactCopyOverrides } from './formatCopy'

const DEFAULT_PALETTE: Palette = {
  ink: '#0E1014',
  inkMuted: '#4E5155',
  surface: '#FFFFFF',
  accent: '#FF5A1F',
  accentSoft: '#FED7AA',
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  brandName: 'Atlas Goods',
  displayFont: '"Inter Display", Inter, system-ui, sans-serif',
  textFont: 'Inter, system-ui, sans-serif',
  palette: DEFAULT_PALETTE,
  gradient: ['#FFEDD5', '#FED7AA', '#FDBA74'],
  toneOfVoice: 'neutral',
  ctaStyle: 'pill',
}

export const DEFAULT_ENABLED: EnabledMap = {
  title: true,
  subtitle: true,
  cta: true,
  badge: false,
  logo: true,
  image: true,
}

export const DEFAULT_MASTER: Scene = {
  background: { kind: 'gradient', stops: ['#FFEDD5', '#FED7AA', '#FDBA74'] },
  accent: '#FF5A1F',
  title: {
    text: 'Покупки к лету лучше делать заранее',
    x: 6,
    y: 18,
    w: 60,
    fontSize: 7,
    charsPerLine: 18,
    maxLines: 3,
    weight: 900,
    fill: '#0E1014',
    letterSpacing: -0.02,
    lineHeight: 1.02,
  },
  subtitle: {
    text: 'Готовые макеты для маркетплейсов в пару кликов.',
    x: 6,
    y: 44,
    w: 50,
    fontSize: 3,
    charsPerLine: 32,
    maxLines: 2,
    weight: 400,
    fill: '#0E1014',
    opacity: 0.72,
    lineHeight: 1.35,
  },
  cta: {
    text: 'Купить сейчас',
    x: 6,
    y: 84,
    w: 30,
    h: 7,
    fontSize: 2.6,
    charsPerLine: 14,
    maxLines: 1,
    weight: 700,
    fill: '#FFFFFF',
    bg: '#FF5A1F',
    rx: 999,
  },
  badge: {
    text: 'Новинка',
    x: 6,
    y: 6,
    w: 18,
    fontSize: 2.2,
    charsPerLine: 10,
    maxLines: 1,
    weight: 700,
    fill: '#FF5A1F',
  },
  logo: {
    x: 80,
    y: 6,
    w: 14,
    h: 6,
    src: null,
    bgOpacity: 0,
  },
  image: {
    x: 50,
    y: 8,
    w: 44,
    h: 84,
    src: null,
    rx: 16,
    fit: 'cover',
  },
}

export const DEFAULT_FORMATS: FormatKey[] = [
  'vk-square',
  'vk-vertical',
  'vk-landscape',
  'vk-stories',
  'telegram-story',
  'instagram-story',
  'wb-card',
  'wb-infographic',
  'ozon-card',
  'ozon-fresh-square',
  'yandex-market-card',
  'yandex-market-banner',
  'yandex-market-stretch',
  'yandex-market-vertical',
  'avito-listing',
  'avito-fullscreen',
  'avito-skyscraper',
  'yandex-rsy-240x400',
  'yandex-rsy-300x250',
  'yandex-rsy-728x90',
]

export function newProject(name = 'novyy-proekt'): Project {
  return {
    id: cryptoId(),
    name,
    master: DEFAULT_MASTER,
    enabled: { ...DEFAULT_ENABLED },
    brandKit: { ...DEFAULT_BRAND_KIT, palette: { ...DEFAULT_BRAND_KIT.palette } },
    goal: 'promo-pack',
    visualSystem: 'product-card',
    assetHint: null,
    imageSrc: null,
    logoSrc: null,
    selectedFormats: [...DEFAULT_FORMATS],
    formatOverrides: { ...DEFAULT_COMPOSITION_BY_FORMAT },
    blockOverrides: compactCopyOverrides({
      title: 'Готовые макеты',
      subtitle: 'Для маркетплейсов и рекламы',
      cta: 'Купить',
    }),
  }
}

function cryptoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'p_' + Math.floor(performance.now() * 1000).toString(36)
}
