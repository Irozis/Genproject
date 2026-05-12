// Brand templates — preset BrandKit + master scene overrides.
// Each template is a complete starting point that produces a coherent visual
// system. Every template picks ONE background "mood" and ONE decor element so
// the results look designed, not templated.

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
  BuiltinFormatKey,
  BlockKind,
  BlockOverride,
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
  // Hard overrides for which composition model to use per format. Templates
  // with strong visual identities often look better pinning to one layout
  // (e.g. editorial = always text-dominant). Missing keys fall back to the
  // profile-based chooser.
  preferredModels?: Partial<Record<FormatKey, CompositionModel>>
  enabled?: Partial<EnabledMap>
  blockOverrides?: BlockOverrides
  formatDensities?: Partial<Record<FormatKey, LayoutDensity>>
  compactCopy?: CompactCopy
  /** Marketplace-specific copy contract: 1 product trait line + benefit pill +
   *  verb CTA. Applied only to card-family formats and overrides compactCopy. */
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
  opacity: 0.72,
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
  weight: 700,
  fill,
  bg: accent,
  rx,
  letterSpacing: 0,
})

const badge = (text: string, accent: string): TextBlock => ({
  text,
  x: 6,
  y: 6,
  w: 18,
  fontSize: 2.2,
  charsPerLine: 10,
  maxLines: 1,
  weight: 700,
  fill: accent,
  letterSpacing: 0,
})

const logo: LogoBlock = { x: 80, y: 6, w: 14, h: 6, src: null, bgOpacity: 0 }
const image: ImageBlock = { x: 50, y: 8, w: 44, h: 84, src: null, rx: 16, fit: 'cover' }

const photo = (id: string): string =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=82`

const make = ({ bg, decor, palette, text, ctaFill, imageSrc, image: imageOverrides }: BaseArgs): Scene => {
  const ctaTextColor = ctaFill ?? palette.surface
  const scene: Scene = {
    background: bg,
    accent: palette.accent,
    title: title(text.title, palette.ink),
    subtitle: subtitle(text.subtitle, palette.ink),
    cta: cta(text.cta, palette.accent, ctaTextColor, 999),
    badge: badge(text.badge, palette.accent),
    logo,
    image: { ...image, src: imageSrc ?? null, ...imageOverrides },
  }
  if (decor) scene.decor = decor
  return scene
}

const FORMAT_BLOCK_OVERRIDES: BlockOverrides = {
  // Wide formats need a deliberately compact horizontal rhythm. Keeping title,
  // subtitle and CTA in the same reduced scale preserves one style inside the
  // format instead of letting only the overflowing block shrink.
  'vk-landscape': {
    title: { fontSize: 4.6, maxLines: 3, w: 46 },
    subtitle: { fontSize: 2.1, maxLines: 2, w: 42 },
    cta: { fontSize: 1.9, w: 28, h: 8 },
    badge: { fontSize: 1.55 },
  },
  'wb-card': {
    image: { x: 5, y: 6, w: 90, h: 53, rx: 18, fit: 'contain' },
    title: { y: 63, fontSize: 5.8, maxLines: 2, w: 88, charsPerLine: 20 },
    subtitle: { y: 74.5, fontSize: 2.05, maxLines: 1, w: 76, charsPerLine: 28 },
    cta: { y: 84, fontSize: 2.45, w: 50, h: 7.2, charsPerLine: 12 },
    badge: { y: 59.5, fontSize: 1.7, w: 30, charsPerLine: 12 },
  },
  'wb-infographic': {
    image: { x: 6, y: 7, w: 88, h: 51, rx: 18, fit: 'contain' },
    title: { y: 63, fontSize: 5.7, maxLines: 2, w: 88, charsPerLine: 20 },
    subtitle: { y: 74.3, fontSize: 2.1, maxLines: 1, w: 78, charsPerLine: 26 },
    cta: { y: 84, fontSize: 2.45, w: 50, h: 7.2, charsPerLine: 12 },
    badge: { y: 59, fontSize: 1.75, w: 34, charsPerLine: 12 },
  },
  'ozon-card': {
    image: { x: 5, y: 6, w: 90, h: 53, rx: 18, fit: 'contain' },
    title: { y: 63, fontSize: 5.8, maxLines: 2, w: 88, charsPerLine: 20 },
    subtitle: { y: 74.5, fontSize: 2.05, maxLines: 1, w: 76, charsPerLine: 28 },
    cta: { y: 84, fontSize: 2.45, w: 50, h: 7.2, charsPerLine: 12 },
    badge: { y: 59.5, fontSize: 1.7, w: 30, charsPerLine: 12 },
  },
  'yandex-market-vertical': {
    image: { x: 7, y: 7, w: 86, h: 53, rx: 18, fit: 'contain' },
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
    cta: { fontSize: 1.55, w: 18, h: 42, charsPerLine: 12 },
  },
  'yandex-rsy-300x250': {
    title: { fontSize: 4.6, maxLines: 2, w: 52, charsPerLine: 16 },
    subtitle: { fontSize: 2.0, maxLines: 1, w: 46, charsPerLine: 20 },
    cta: { fontSize: 3.75, w: 42, h: 13, charsPerLine: 12 },
    badge: { fontSize: 1.35 },
  },
  'yandex-rsy-240x400': {
    title: { fontSize: 5.8, maxLines: 2, charsPerLine: 16 },
    subtitle: { fontSize: 2.2, maxLines: 1, charsPerLine: 20 },
    cta: { fontSize: 4.75, w: 64, h: 8.2, charsPerLine: 12 },
    badge: { fontSize: 1.55 },
  },
  'avito-skyscraper': {
    title: { fontSize: 6.5, maxLines: 2, charsPerLine: 16 },
    subtitle: { fontSize: 2.35, maxLines: 1, charsPerLine: 20 },
    cta: { fontSize: 4.0, w: 76, h: 7.6, charsPerLine: 12 },
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

type FormatBlockPreset = Partial<Record<BlockKind, BlockOverride>>
type BuiltinBlockOverrides = Partial<Record<BuiltinFormatKey, FormatBlockPreset>>

const exactText = { fitMode: 'ellipsis' as const }

const DIRECTED_FORMAT_MODELS: Record<BuiltinFormatKey, CompositionModel> = {
  'vk-square': 'split-right-image',
  'vk-vertical': 'split-right-image',
  'vk-landscape': 'split-right-image',
  'vk-stories': 'hero-overlay',
  'telegram-story': 'hero-overlay',
  'instagram-story': 'hero-overlay',
  'wb-card': 'image-top-text-bottom',
  'wb-infographic': 'image-top-text-bottom',
  'ozon-card': 'image-top-text-bottom',
  'ozon-fresh-square': 'split-right-image',
  'yandex-market-card': 'split-right-image',
  'yandex-market-banner': 'split-right-image',
  'yandex-market-stretch': 'split-right-image',
  'yandex-market-vertical': 'image-top-text-bottom',
  'avito-listing': 'split-right-image',
  'avito-fullscreen': 'hero-overlay',
  'avito-skyscraper': 'image-top-text-bottom',
  'yandex-rsy-240x400': 'image-top-text-bottom',
  'yandex-rsy-300x250': 'split-right-image',
  'yandex-rsy-728x90': 'split-right-image',
}

const DIRECTED_FORMAT_BLOCKS: Record<BuiltinFormatKey, FormatBlockPreset> = {
  'vk-square': {
    image: { x: 56, y: 8, w: 38, h: 84, rx: 18, fit: 'cover' },
    logo: { x: 88, y: 8, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 8, w: 28, h: 3.6, fontSize: 1.6, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 30, w: 46, fontSize: 6.2, maxLines: 3, charsPerLine: 15 },
    subtitle: { ...exactText, x: 6, y: 55, w: 42, fontSize: 2.35, maxLines: 2, charsPerLine: 30 },
    cta: { ...exactText, x: 6, y: 79, w: 32, h: 7.2, fontSize: 2.25, charsPerLine: 14 },
  },
  'vk-vertical': {
    image: { x: 56, y: 7, w: 38, h: 86, rx: 18, fit: 'cover' },
    logo: { x: 88, y: 8, w: 6, h: 5.2 },
    badge: { ...exactText, x: 6, y: 8, w: 30, h: 3.4, fontSize: 1.45, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 31, w: 46, fontSize: 5.9, maxLines: 3, charsPerLine: 15 },
    subtitle: { ...exactText, x: 6, y: 55, w: 42, fontSize: 2.25, maxLines: 2, charsPerLine: 30 },
    cta: { ...exactText, x: 6, y: 79, w: 34, h: 6.4, fontSize: 2.15, charsPerLine: 14 },
  },
  'vk-landscape': {
    image: { x: 61, y: 8, w: 33, h: 84, rx: 18, fit: 'cover' },
    logo: { x: 88, y: 9, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 10, w: 24, h: 4.2, fontSize: 1.45, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 23, w: 49, fontSize: 4.7, maxLines: 2, charsPerLine: 20 },
    subtitle: { ...exactText, x: 6, y: 50, w: 45, fontSize: 1.9, maxLines: 2, charsPerLine: 38 },
    cta: { ...exactText, x: 6, y: 75, w: 27, h: 9, fontSize: 1.8, charsPerLine: 14 },
  },
  'vk-stories': {
    image: { x: 0, y: 0, w: 100, h: 100, rx: 0, fit: 'cover' },
    logo: { x: 88, y: 83, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 14, w: 30, h: 3.4, fontSize: 2.0, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 57, w: 72, fontSize: 7.0, maxLines: 2, charsPerLine: 18 },
    subtitle: { ...exactText, x: 6, y: 70, w: 68, fontSize: 2.45, maxLines: 2, charsPerLine: 34 },
    cta: { ...exactText, x: 6, y: 82, w: 38, h: 6.8, fontSize: 2.3, charsPerLine: 14 },
  },
  'telegram-story': {
    image: { x: 0, y: 0, w: 100, h: 100, rx: 0, fit: 'cover' },
    logo: { x: 88, y: 83, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 14, w: 30, h: 3.4, fontSize: 2.0, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 57, w: 72, fontSize: 7.0, maxLines: 2, charsPerLine: 18 },
    subtitle: { ...exactText, x: 6, y: 70, w: 68, fontSize: 2.45, maxLines: 2, charsPerLine: 34 },
    cta: { ...exactText, x: 6, y: 82, w: 38, h: 6.8, fontSize: 2.3, charsPerLine: 14 },
  },
  'instagram-story': {
    image: { x: 0, y: 0, w: 100, h: 100, rx: 0, fit: 'cover' },
    logo: { x: 88, y: 83, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 15, w: 30, h: 3.4, fontSize: 2.0, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 58, w: 72, fontSize: 7.0, maxLines: 2, charsPerLine: 18 },
    subtitle: { ...exactText, x: 6, y: 71, w: 68, fontSize: 2.45, maxLines: 2, charsPerLine: 34 },
    cta: { ...exactText, x: 6, y: 83, w: 38, h: 6.8, fontSize: 2.3, charsPerLine: 14 },
  },
  'wb-card': {
    image: { x: 5, y: 6, w: 90, h: 52, rx: 18, fit: 'contain' },
    logo: { x: 86, y: 8, w: 6, h: 5 },
    badge: { ...exactText, x: 6, y: 60, w: 34, h: 3.2, fontSize: 1.65, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 65, w: 88, fontSize: 5.5, maxLines: 2, charsPerLine: 20 },
    subtitle: { ...exactText, x: 6, y: 76, w: 78, fontSize: 2.05, maxLines: 1, charsPerLine: 30 },
    cta: { ...exactText, x: 6, y: 85, w: 50, h: 7.2, fontSize: 2.3, charsPerLine: 14 },
  },
  'wb-infographic': {
    image: { x: 6, y: 7, w: 88, h: 50, rx: 18, fit: 'contain' },
    logo: { x: 86, y: 9, w: 6, h: 5 },
    badge: { ...exactText, x: 6, y: 59, w: 36, h: 3.2, fontSize: 1.7, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 64, w: 88, fontSize: 5.35, maxLines: 2, charsPerLine: 20 },
    subtitle: { ...exactText, x: 6, y: 75, w: 82, fontSize: 2.05, maxLines: 1, charsPerLine: 30 },
    cta: { ...exactText, x: 6, y: 84, w: 50, h: 7.2, fontSize: 2.3, charsPerLine: 14 },
  },
  'ozon-card': {
    image: { x: 5, y: 6, w: 90, h: 52, rx: 18, fit: 'contain' },
    logo: { x: 86, y: 8, w: 6, h: 5 },
    badge: { ...exactText, x: 6, y: 60, w: 34, h: 3.2, fontSize: 1.65, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 65, w: 88, fontSize: 5.5, maxLines: 2, charsPerLine: 20 },
    subtitle: { ...exactText, x: 6, y: 76, w: 78, fontSize: 2.05, maxLines: 1, charsPerLine: 30 },
    cta: { ...exactText, x: 6, y: 85, w: 50, h: 7.2, fontSize: 2.3, charsPerLine: 14 },
  },
  'ozon-fresh-square': {
    image: { x: 56, y: 8, w: 38, h: 84, rx: 18, fit: 'cover' },
    logo: { x: 88, y: 8, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 8, w: 32, h: 3.6, fontSize: 1.6, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 30, w: 46, fontSize: 6.0, maxLines: 3, charsPerLine: 16 },
    subtitle: { ...exactText, x: 6, y: 55, w: 42, fontSize: 2.3, maxLines: 2, charsPerLine: 30 },
    cta: { ...exactText, x: 6, y: 79, w: 32, h: 7.2, fontSize: 2.2, charsPerLine: 14 },
  },
  'yandex-market-card': {
    image: { x: 56, y: 8, w: 38, h: 84, rx: 18, fit: 'cover' },
    logo: { x: 88, y: 8, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 8, w: 32, h: 3.6, fontSize: 1.6, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 30, w: 46, fontSize: 6.0, maxLines: 3, charsPerLine: 16 },
    subtitle: { ...exactText, x: 6, y: 55, w: 42, fontSize: 2.3, maxLines: 2, charsPerLine: 30 },
    cta: { ...exactText, x: 6, y: 79, w: 32, h: 7.2, fontSize: 2.2, charsPerLine: 14 },
  },
  'yandex-market-banner': {
    image: { x: 62, y: 8, w: 32, h: 84, rx: 16, fit: 'cover' },
    logo: { x: 88, y: 10, w: 6, h: 6 },
    badge: { ...exactText, x: 5, y: 11, w: 28, h: 4.0, fontSize: 1.25, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 5, y: 25, w: 50, fontSize: 3.35, maxLines: 2, charsPerLine: 24 },
    subtitle: { ...exactText, x: 5, y: 54, w: 46, fontSize: 1.55, maxLines: 1, charsPerLine: 42 },
    cta: { ...exactText, x: 5, y: 73, w: 24, h: 10, fontSize: 1.45, charsPerLine: 14 },
  },
  'yandex-market-stretch': {
    image: { x: 8, y: 9, w: 18, h: 82, rx: 10, fit: 'contain' },
    logo: { x: 93, y: 28, w: 3, h: 28 },
    badge: { ...exactText, x: 9, y: 15, w: 16, h: 15, fontSize: 0.75, charsPerLine: 12, transform: 'uppercase', align: 'center' },
    title: { ...exactText, x: 30, y: 21, w: 38, fontSize: 1.75, maxLines: 1, charsPerLine: 32 },
    subtitle: { ...exactText, x: 30, y: 57, w: 36, fontSize: 0.78, maxLines: 1, charsPerLine: 44 },
    cta: { ...exactText, x: 73, y: 29, w: 19, h: 42, fontSize: 1.0, charsPerLine: 14 },
  },
  'yandex-market-vertical': {
    image: { x: 7, y: 7, w: 86, h: 52, rx: 18, fit: 'contain' },
    logo: { x: 86, y: 9, w: 6, h: 5 },
    badge: { ...exactText, x: 7, y: 61, w: 34, h: 3.2, fontSize: 1.6, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 7, y: 66, w: 86, fontSize: 5.6, maxLines: 2, charsPerLine: 20 },
    subtitle: { ...exactText, x: 7, y: 77, w: 78, fontSize: 2.0, maxLines: 1, charsPerLine: 30 },
    cta: { ...exactText, x: 7, y: 85.5, w: 50, h: 7, fontSize: 2.25, charsPerLine: 14 },
  },
  'avito-listing': {
    image: { x: 59, y: 8, w: 35, h: 84, rx: 18, fit: 'cover' },
    logo: { x: 88, y: 9, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 9, w: 30, h: 3.8, fontSize: 1.6, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 30, w: 48, fontSize: 5.5, maxLines: 3, charsPerLine: 18 },
    subtitle: { ...exactText, x: 6, y: 55, w: 44, fontSize: 2.1, maxLines: 2, charsPerLine: 34 },
    cta: { ...exactText, x: 6, y: 78, w: 32, h: 7.2, fontSize: 2.0, charsPerLine: 14 },
  },
  'avito-fullscreen': {
    image: { x: 0, y: 0, w: 100, h: 100, rx: 0, fit: 'cover' },
    logo: { x: 88, y: 83, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 14, w: 30, h: 3.4, fontSize: 2.0, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 57, w: 72, fontSize: 7.0, maxLines: 2, charsPerLine: 18 },
    subtitle: { ...exactText, x: 6, y: 70, w: 68, fontSize: 2.45, maxLines: 2, charsPerLine: 34 },
    cta: { ...exactText, x: 6, y: 82, w: 38, h: 6.8, fontSize: 2.3, charsPerLine: 14 },
  },
  'avito-skyscraper': {
    image: { x: 7, y: 7, w: 86, h: 38, rx: 18, fit: 'contain' },
    logo: { x: 85, y: 9, w: 7, h: 5 },
    badge: { ...exactText, x: 7, y: 48, w: 42, h: 3.0, fontSize: 1.75, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 7, y: 54, w: 86, fontSize: 5.9, maxLines: 2, charsPerLine: 15 },
    subtitle: { ...exactText, x: 7, y: 69, w: 80, fontSize: 2.05, maxLines: 1, charsPerLine: 28 },
    cta: { ...exactText, x: 7, y: 82, w: 76, h: 7.6, fontSize: 4.4, charsPerLine: 12 },
  },
  'yandex-rsy-240x400': {
    image: { x: 7, y: 7, w: 86, h: 36, rx: 16, fit: 'contain' },
    logo: { x: 85, y: 9, w: 7, h: 5 },
    badge: { ...exactText, x: 7, y: 46, w: 40, h: 3.2, fontSize: 1.65, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 7, y: 52, w: 86, fontSize: 5.4, maxLines: 2, charsPerLine: 15 },
    subtitle: { ...exactText, x: 7, y: 67, w: 80, fontSize: 2.0, maxLines: 1, charsPerLine: 28 },
    cta: { ...exactText, x: 7, y: 82, w: 64, h: 8.2, fontSize: 5.1, charsPerLine: 12 },
  },
  'yandex-rsy-300x250': {
    image: { x: 60, y: 9, w: 34, h: 48, rx: 14, fit: 'contain' },
    logo: { x: 86, y: 10, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 10, w: 34, h: 3.6, fontSize: 1.25, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 28, w: 48, fontSize: 4.3, maxLines: 2, charsPerLine: 16 },
    subtitle: { ...exactText, x: 6, y: 52, w: 46, fontSize: 1.75, maxLines: 1, charsPerLine: 28 },
    cta: { ...exactText, x: 6, y: 72, w: 42, h: 13.5, fontSize: 4.1, charsPerLine: 12 },
  },
  'yandex-rsy-728x90': {
    image: { x: 4, y: 10, w: 14, h: 80, rx: 8, fit: 'contain' },
    logo: { x: 94, y: 32, w: 3, h: 30 },
    badge: { ...exactText, x: 5, y: 18, w: 12, h: 16, fontSize: 1.15, charsPerLine: 10, transform: 'uppercase', align: 'center' },
    title: { ...exactText, x: 22, y: 18, w: 40, fontSize: 2.45, maxLines: 1, charsPerLine: 30 },
    subtitle: { ...exactText, x: 22, y: 56, w: 38, fontSize: 1.18, maxLines: 1, charsPerLine: 36 },
    cta: { ...exactText, x: 76, y: 26, w: 18, h: 46, fontSize: 1.65, charsPerLine: 12 },
  },
}

type BrandDirector = {
  titleScale: number
  subtitleScale: number
  ctaScale: number
  badgeScale: number
  imageZoom: number
  models?: Partial<Record<BuiltinFormatKey, CompositionModel>>
  blocks?: BuiltinBlockOverrides
}

const BRAND_DIRECTORS: Record<string, BrandDirector> = {
  'coffee-roastery': {
    titleScale: 0.96,
    subtitleScale: 1.0,
    ctaScale: 0.96,
    badgeScale: 0.96,
    imageZoom: 1.02,
    models: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'split-right-image',
      'vk-stories': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'avito-fullscreen': 'hero-overlay',
    },
  },
  'skincare-lab': {
    titleScale: 0.94,
    subtitleScale: 0.98,
    ctaScale: 0.95,
    badgeScale: 0.92,
    imageZoom: 1.0,
    models: {
      'vk-stories': 'image-top-text-bottom',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
      'avito-fullscreen': 'image-top-text-bottom',
    },
    blocks: imageTopStoryBlocks(0.93),
  },
  'fashion-drop': {
    titleScale: 0.82,
    subtitleScale: 0.92,
    ctaScale: 0.94,
    badgeScale: 0.95,
    imageZoom: 1.08,
    models: {
      'vk-square': 'hero-overlay',
      'vk-vertical': 'hero-overlay',
      'vk-stories': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'avito-fullscreen': 'hero-overlay',
    },
    blocks: {
      'vk-square': heroSquareBlocks(0.92),
      'vk-vertical': heroSquareBlocks(0.88),
      'yandex-rsy-300x250': {
        title: { fontSize: 3.75, maxLines: 1, charsPerLine: 22 },
        subtitle: { fontSize: 1.65, maxLines: 1, charsPerLine: 30 },
      },
      'yandex-rsy-240x400': {
        title: { fontSize: 4.65, maxLines: 1, charsPerLine: 22 },
        subtitle: { fontSize: 1.8, maxLines: 1, charsPerLine: 30 },
      },
      'avito-skyscraper': {
        title: { fontSize: 5.05, maxLines: 1, charsPerLine: 22 },
        subtitle: { fontSize: 1.9, maxLines: 1, charsPerLine: 30 },
      },
    },
  },
  'saas-dashboard': {
    titleScale: 0.9,
    subtitleScale: 0.96,
    ctaScale: 0.95,
    badgeScale: 0.9,
    imageZoom: 1.0,
    models: {
      'vk-stories': 'image-top-text-bottom',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
      'avito-fullscreen': 'image-top-text-bottom',
    },
    blocks: imageTopStoryBlocks(0.9),
  },
  'farm-grocery': {
    titleScale: 0.94,
    subtitleScale: 1.0,
    ctaScale: 0.96,
    badgeScale: 0.94,
    imageZoom: 1.02,
    models: {
      'vk-stories': 'image-top-text-bottom',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
      'avito-fullscreen': 'image-top-text-bottom',
    },
    blocks: imageTopStoryBlocks(0.94),
  },
  'fitness-club': {
    titleScale: 0.88,
    subtitleScale: 0.96,
    ctaScale: 0.98,
    badgeScale: 0.92,
    imageZoom: 1.1,
    models: {
      'vk-square': 'hero-overlay',
      'vk-vertical': 'hero-overlay',
      'vk-stories': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'avito-fullscreen': 'hero-overlay',
    },
    blocks: {
      'vk-square': heroSquareBlocks(0.9),
      'vk-vertical': heroSquareBlocks(0.86),
    },
  },
  'estate-premium': {
    titleScale: 0.92,
    subtitleScale: 0.98,
    ctaScale: 0.92,
    badgeScale: 0.9,
    imageZoom: 1.0,
    models: {
      'vk-stories': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'avito-fullscreen': 'hero-overlay',
    },
  },
  'kids-school': {
    titleScale: 0.88,
    subtitleScale: 0.96,
    ctaScale: 0.96,
    badgeScale: 0.95,
    imageZoom: 1.0,
    models: {
      'vk-stories': 'image-top-text-bottom',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
      'avito-fullscreen': 'image-top-text-bottom',
    },
    blocks: imageTopStoryBlocks(0.88),
  },
  'travel-retreat': {
    titleScale: 0.9,
    subtitleScale: 0.96,
    ctaScale: 0.96,
    badgeScale: 0.92,
    imageZoom: 1.06,
    models: {
      'vk-square': 'hero-overlay',
      'vk-vertical': 'hero-overlay',
      'vk-stories': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'avito-fullscreen': 'hero-overlay',
    },
    blocks: {
      'vk-square': heroSquareBlocks(0.92),
      'vk-vertical': heroSquareBlocks(0.88),
    },
  },
  'fintech-card': {
    titleScale: 0.9,
    subtitleScale: 0.96,
    ctaScale: 0.92,
    badgeScale: 0.9,
    imageZoom: 1.0,
    models: {
      'vk-stories': 'image-top-text-bottom',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
      'avito-fullscreen': 'image-top-text-bottom',
    },
    blocks: imageTopStoryBlocks(0.9),
  },
}

function imageTopStoryBlocks(scale: number): BuiltinBlockOverrides {
  const story: FormatBlockPreset = {
    image: { x: 0, y: 0, w: 100, h: 58, rx: 0, fit: 'cover' },
    logo: { x: 88, y: 8, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 63, w: 30, h: 3.2, fontSize: 1.85 * scale, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 68, w: 82, fontSize: 6.4 * scale, maxLines: 2, charsPerLine: 20 },
    subtitle: { ...exactText, x: 6, y: 79.5, w: 76, fontSize: 2.3 * scale, maxLines: 2, charsPerLine: 34 },
    cta: { ...exactText, x: 6, y: 88, w: 42, h: 6.4, fontSize: 2.2 * scale, charsPerLine: 14 },
  }
  return {
    'vk-stories': story,
    'telegram-story': story,
    'instagram-story': story,
    'avito-fullscreen': story,
  }
}

function heroSquareBlocks(scale: number): FormatBlockPreset {
  return {
    image: { x: 0, y: 0, w: 100, h: 100, rx: 0, fit: 'cover' },
    logo: { x: 88, y: 8, w: 6, h: 6 },
    badge: { ...exactText, x: 6, y: 9, w: 30, h: 3.4, fontSize: 1.7 * scale, charsPerLine: 14, transform: 'uppercase' },
    title: { ...exactText, x: 6, y: 54, w: 74, fontSize: 6.9 * scale, maxLines: 2, charsPerLine: 18 },
    subtitle: { ...exactText, x: 6, y: 68, w: 68, fontSize: 2.35 * scale, maxLines: 2, charsPerLine: 34 },
    cta: { ...exactText, x: 6, y: 82, w: 38, h: 7.0, fontSize: 2.25 * scale, charsPerLine: 14 },
  }
}

function scaleDirectedBlocks(base: Record<BuiltinFormatKey, FormatBlockPreset>, director: BrandDirector): BlockOverrides {
  const out: BlockOverrides = {}
  for (const [formatKey, blocks] of Object.entries(base) as Array<[BuiltinFormatKey, FormatBlockPreset]>) {
    const next: FormatBlockPreset = {}
    for (const [kind, block] of Object.entries(blocks) as Array<[BlockKind, BlockOverride]>) {
      const scaled = { ...block }
      if (scaled.fontSize !== undefined) {
        const scale = kind === 'title'
          ? director.titleScale
          : kind === 'subtitle'
            ? director.subtitleScale
            : kind === 'cta'
              ? director.ctaScale
              : kind === 'badge'
                ? director.badgeScale
                : 1
        scaled.fontSize = round(scaled.fontSize * scale, 2)
      }
      if ((kind === 'title' || kind === 'subtitle' || kind === 'cta' || kind === 'badge') && !scaled.fitMode) {
        scaled.fitMode = 'ellipsis'
      }
      if (kind === 'image') {
        scaled.cropZoom = Math.max(scaled.cropZoom ?? 1, director.imageZoom)
      }
      next[kind] = scaled
    }
    out[formatKey] = next
  }
  return out
}

function round(value: number, digits: number): number {
  const p = 10 ** digits
  return Math.round(value * p) / p
}

function withFormatSettings(template: Template): Template {
  // Layered merge order: format defaults → compactCopy (smallAd + banner +
  // card families) → marketplaceCopy (card-only voice) → template-author
  // overrides. Later layers win, so authors can still tweak anything.
  const compact = template.compactCopy ? compactCopyOverrides(template.compactCopy) : undefined
  const market = template.marketplaceCopy ? marketplaceCopyOverrides(template.marketplaceCopy) : undefined
  const director = BRAND_DIRECTORS[template.id]
  const directed = director ? scaleDirectedBlocks(DIRECTED_FORMAT_BLOCKS, director) : DIRECTED_FORMAT_BLOCKS
  return {
    ...template,
    preferredModels: {
      ...DIRECTED_FORMAT_MODELS,
      ...(template.preferredModels ?? {}),
      ...(director?.models ?? {}),
    },
    blockOverrides: mergeBlockOverrides(
      mergeBlockOverrides(
        mergeBlockOverrides(
          mergeBlockOverrides(FORMAT_BLOCK_OVERRIDES, directed),
          compact,
        ),
        mergeBlockOverrides(market ?? {}, director?.blocks),
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
    id: 'coffee-roastery',
    name: 'Кофейня и обжарка',
    description: 'Премиальная кофейная система с теплым фото, спокойной типографикой и ясным оффером.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Кофе свежей обжарки',
      subtitle: 'Зерно и дрипы к выходным',
      cta: 'Выбрать кофе',
    },
    marketplaceCopy: {
      trait: '250 г · средняя обжарка',
      benefit: 'Свежая обжарка',
      cta: 'В корзину',
      infographicSubtitle: 'Зерно · Фильтр · Эспрессо',
    },
    brandKit: {
      brandName: 'Nord Beans',
      displayFont: 'Fraunces, "Playfair Display", Georgia, serif',
      textFont: 'Manrope, Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFF5E6',
        inkMuted: '#E7CFAF',
        surface: '#1B1008',
        accent: '#D89B54',
        accentSoft: '#F1D1A9',
      },
      gradient: ['#1B1008', '#4D2B16', '#D89B54'],
      toneOfVoice: 'neutral',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#1B1008', '#3A2112', '#7B4A25'] },
      decor: { kind: 'grain', seed: 11, intensity: 0.42 },
      palette: {
        ink: '#FFF5E6',
        inkMuted: '#E7CFAF',
        surface: '#1B1008',
        accent: '#D89B54',
        accentSoft: '#F1D1A9',
      },
      imageSrc: photo('photo-1495474472287-4d71bcdd2085'),
      image: { focalX: 0.52, focalY: 0.5, cropZoom: 1.0 },
      text: {
        title: 'Свежая **обжарка** для дома',
        subtitle: 'Моносорта, дрипы и зерно с доставкой к выходным.',
        cta: 'Выбрать кофе',
        badge: 'Обжарка',
      },
    }),
    blockOverrides: {
      'vk-square': {
        title: { fontSize: 6.2, maxLines: 3, w: 48 },
        subtitle: { fontSize: 2.45, maxLines: 2, w: 42 },
        cta: { fontSize: 2.25, w: 28, h: 6.4 },
        badge: { fontSize: 1.45 },
        image: { x: 58, y: 8, w: 34, h: 84, rx: 18, fit: 'cover' },
      },
      'vk-vertical': {
        title: { fontSize: 6.2, maxLines: 3, w: 48 },
        subtitle: { fontSize: 2.35, maxLines: 2, w: 42 },
        cta: { fontSize: 2.2, w: 30, h: 5.8 },
        badge: { fontSize: 1.45 },
        image: { x: 58, y: 8, w: 34, h: 84, rx: 18, fit: 'cover' },
      },
      'wb-card': {
        title: { y: 64, fontSize: 5.5, maxLines: 2 },
        subtitle: { y: 75.5, fontSize: 2.25, maxLines: 2 },
        cta: { y: 85, fontSize: 2.2, w: 34, h: 6.2 },
      },
      'wb-infographic': {
        title: { y: 64, fontSize: 5.5, maxLines: 2 },
        subtitle: { y: 75.5, fontSize: 2.25, maxLines: 2 },
        cta: { y: 85, fontSize: 2.2, w: 34, h: 6.2 },
      },
      'ozon-card': {
        title: { y: 64, fontSize: 5.5, maxLines: 2 },
        subtitle: { y: 75.5, fontSize: 2.25, maxLines: 2 },
        cta: { y: 85, fontSize: 2.2, w: 34, h: 6.2 },
      },
      'yandex-market-vertical': {
        title: { fontSize: 6.0, maxLines: 2 },
        subtitle: { fontSize: 2.25, maxLines: 2 },
        cta: { fontSize: 2.15, w: 36, h: 6.2 },
      },
      'instagram-story': {
        title: { y: 57, fontSize: 6.6, maxLines: 2 },
        subtitle: { y: 67.5, fontSize: 2.45, maxLines: 2 },
        cta: { y: 72.8, w: 32, h: 6.4 },
      },
      'telegram-story': {
        title: { y: 58, fontSize: 6.6, maxLines: 2 },
        subtitle: { y: 69, fontSize: 2.45, maxLines: 2 },
        cta: { y: 76, w: 32, h: 6.4 },
      },
      'vk-stories': {
        title: { y: 58, fontSize: 6.6, maxLines: 2 },
        subtitle: { y: 69, fontSize: 2.45, maxLines: 2 },
        cta: { y: 76, w: 32, h: 6.4 },
      },
      'avito-fullscreen': {
        title: { y: 58, fontSize: 6.6, maxLines: 2 },
        subtitle: { y: 69, fontSize: 2.45, maxLines: 2 },
        cta: { y: 76, w: 32, h: 6.4 },
      },
    },
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-vertical': 'split-right-image',
      'vk-stories': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'wb-card': 'image-top-text-bottom',
      'wb-infographic': 'image-top-text-bottom',
      'ozon-card': 'image-top-text-bottom',
      'yandex-market-vertical': 'image-top-text-bottom',
      'avito-fullscreen': 'hero-overlay',
    },
  },
  {
    id: 'skincare-lab',
    name: 'Косметика и уход',
    description: 'Чистый beauty-пресет с мягкой палитрой, продуктовым фокусом и деликатным CTA.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Уход без лишнего',
      subtitle: 'Сыворотка и крем в наборе',
      cta: 'Смотреть набор',
    },
    marketplaceCopy: {
      trait: 'Ниацинамид 4% · 30 мл',
      benefit: 'Бестселлер',
      cta: 'В корзину',
      infographicSubtitle: 'Без отдушки · pH 5.5 · Веган',
    },
    brandKit: {
      brandName: 'Luma Skin',
      displayFont: '"DM Serif Display", "Playfair Display", Georgia, serif',
      textFont: 'Manrope, Inter, system-ui, sans-serif',
      palette: {
        ink: '#2B1E26',
        inkMuted: '#7A5E68',
        surface: '#FFF8F2',
        accent: '#C86B86',
        accentSoft: '#F3CAD6',
      },
      gradient: ['#FFF8F2', '#F6DFD9', '#EEC2CD'],
      toneOfVoice: 'friendly',
      ctaStyle: 'pill',
    },
    master: make({
      bg: { kind: 'solid', color: '#FFF8F2' },
      decor: { kind: 'corner-circle', corner: 'br', size: 42, color: '#C86B86', opacity: 0.16 },
      palette: {
        ink: '#2B1E26',
        inkMuted: '#7A5E68',
        surface: '#FFF8F2',
        accent: '#C86B86',
        accentSoft: '#F3CAD6',
      },
      imageSrc: photo('photo-1556228720-195a672e8a03'),
      image: { focalX: 0.5, focalY: 0.5, rx: 22 },
      text: {
        title: 'Уход, который **работает** мягко',
        subtitle: 'Ниацинамид, керамиды и понятная ежедневная схема.',
        cta: 'Смотреть набор',
        badge: 'Уход',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-stories': 'image-top-text-bottom',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
      'avito-fullscreen': 'image-top-text-bottom',
      'wb-card': 'split-right-image',
      'ozon-card': 'split-right-image',
    },
  },
  {
    id: 'fashion-drop',
    name: 'Модный дроп',
    description: 'Контрастный fashion-пресет для капсулы, лимитированного дропа и sneaker-запуска.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Drop 06 уже онлайн',
      subtitle: 'Кроссовки и худи в лимите',
      cta: 'Смотреть',
    },
    marketplaceCopy: {
      trait: 'Лимитированная капсула',
      benefit: '−15% по подписке',
      cta: 'Купить',
      infographicSubtitle: 'Капсула · Лимит · Доставка',
    },
    brandKit: {
      brandName: 'Line Dept',
      displayFont: '"Bebas Neue", Impact, "Arial Black", sans-serif',
      textFont: 'Montserrat, Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#D7D7D7',
        surface: '#090909',
        accent: '#F2FF3D',
        accentSoft: '#F6FF9D',
      },
      gradient: ['#090909', '#242424', '#F2FF3D'],
      toneOfVoice: 'bold',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'solid', color: '#090909' },
      decor: { kind: 'diagonal-stripe', color: '#F2FF3D', opacity: 0.22 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#D7D7D7',
        surface: '#090909',
        accent: '#F2FF3D',
        accentSoft: '#F6FF9D',
      },
      imageSrc: photo('photo-1542291026-7eec264c27ff'),
      image: { focalX: 0.52, focalY: 0.58, cropZoom: 1.05 },
      text: {
        title: 'Drop 06 **Urban Run**',
        subtitle: 'Кроссовки, худи и аксессуары в лимитированном релизе.',
        cta: 'Смотреть дроп',
        badge: 'Дроп',
      },
    }),
    blockOverrides: {
      'yandex-rsy-300x250': {
        title: { fontSize: 3.9, maxLines: 1, charsPerLine: 20 },
        subtitle: { fontSize: 1.8, maxLines: 1, charsPerLine: 28 },
      },
      'yandex-rsy-240x400': {
        title: { fontSize: 4.9, maxLines: 1, charsPerLine: 20 },
        subtitle: { fontSize: 1.95, maxLines: 1, charsPerLine: 28 },
      },
      'avito-skyscraper': {
        title: { fontSize: 5.3, maxLines: 1, charsPerLine: 20 },
        subtitle: { fontSize: 2.05, maxLines: 1, charsPerLine: 28 },
      },
    },
    preferredModels: {
      'vk-stories': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'avito-fullscreen': 'hero-overlay',
    },
  },
  {
    id: 'saas-dashboard',
    name: 'SaaS-продукт',
    description: 'Собранный B2B-пресет для аналитики, личного кабинета, CRM и продуктового демо.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Сделки под контролем',
      subtitle: 'Демо за 15 минут',
      cta: 'Запросить',
    },
    marketplaceCopy: {
      trait: 'Облако · 30 дней триала',
      benefit: 'B2B SaaS',
      cta: 'Подробнее',
      infographicSubtitle: 'CRM · Воронка · Отчёты',
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
      toneOfVoice: 'bold',
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
      imageSrc: photo('photo-1497366754035-f200968a6e72'),
      image: { focalX: 0.52, focalY: 0.46, rx: 18 },
      text: {
        title: '**Сделки** и задачи на одном экране',
        subtitle: 'Прогноз, отчеты и командные действия в одном кабинете.',
        cta: 'Получить демо',
        badge: 'B2B',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-landscape': 'split-right-image',
      'vk-stories': 'image-top-text-bottom',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
      'avito-fullscreen': 'image-top-text-bottom',
      'yandex-rsy-728x90': 'split-right-image',
    },
  },
  {
    id: 'farm-grocery',
    name: 'Фермерская лавка',
    description: 'Свежий продуктовый пресет с натуральным фото, зеленым акцентом и понятной выгодой.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Фермерский набор',
      subtitle: 'Овощи и зелень сегодня',
      cta: 'Заказать',
    },
    marketplaceCopy: {
      trait: 'Набор 2.4 кг · Россия',
      benefit: 'Свежее сегодня',
      cta: 'В корзину',
      infographicSubtitle: 'Доставка · Сезон · Возврат',
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
      image: { focalX: 0.48, focalY: 0.52, rx: 20 },
      text: {
        title: 'Свежий набор **к ужину**',
        subtitle: 'Овощи, зелень и ягоды от локальных фермеров.',
        cta: 'Собрать корзину',
        badge: 'Ферма',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-stories': 'image-top-text-bottom',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
      'avito-fullscreen': 'image-top-text-bottom',
      'ozon-fresh-square': 'split-right-image',
      'yandex-market-card': 'split-right-image',
    },
  },
  {
    id: 'fitness-club',
    name: 'Фитнес-клуб',
    description: 'Энергичный спортивный пресет с сильным фото, темным фоном и кислотным акцентом.',
    enabled: { badge: true },
    compactCopy: {
      title: '8 недель силы',
      subtitle: 'Тренер, план и замеры',
      cta: 'В челлендж',
    },
    marketplaceCopy: {
      trait: '8 недель · 24 тренировки',
      benefit: '−20% подписка',
      cta: 'Купить',
      infographicSubtitle: 'Тренер · Питание · Замер',
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
      decor: { kind: 'diagonal-stripe', color: '#B6FF2E', opacity: 0.2 },
      palette: {
        ink: '#F7FFE8',
        inkMuted: '#D7E8C8',
        surface: '#10120D',
        accent: '#B6FF2E',
        accentSoft: '#E4FF9A',
      },
      imageSrc: photo('photo-1517836357463-d25dfeac3438'),
      image: { focalX: 0.5, focalY: 0.42, cropZoom: 1.05 },
      text: {
        title: '8 недель до **сильной** формы',
        subtitle: 'Тренер, питание и поддержка с первым замером в субботу.',
        cta: 'Войти в челлендж',
        badge: 'Челлендж',
      },
    }),
    preferredModels: {
      'vk-square': 'hero-overlay',
      'vk-vertical': 'hero-overlay',
      'vk-stories': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'avito-fullscreen': 'hero-overlay',
    },
  },
  {
    id: 'estate-premium',
    name: 'Премиум недвижимость',
    description: 'Журнальный премиум-пресет для объекта, агентства или закрытого показа.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Дом у парка',
      subtitle: '186 м², готовый интерьер',
      cta: 'Записаться',
    },
    marketplaceCopy: {
      trait: '186 м² · 4 спальни · парк',
      benefit: 'Закрытый показ',
      cta: 'Записаться',
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
      image: { focalX: 0.52, focalY: 0.52, rx: 18 },
      text: {
        title: 'Дом у парка с **панорамой** города',
        subtitle: 'Терраса, 186 м² и готовый интерьер.',
        cta: 'На показ',
        badge: 'Закрыто',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-stories': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'avito-listing': 'split-right-image',
      'avito-fullscreen': 'hero-overlay',
      'avito-skyscraper': 'image-top-text-bottom',
    },
  },
  {
    id: 'kids-school',
    name: 'Детская школа',
    description: 'Светлый дружелюбный пресет для курсов, кружков и семейных сервисов.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Английский через игру',
      subtitle: 'Мини-группы 7-10 лет',
      cta: 'На урок',
    },
    marketplaceCopy: {
      trait: 'Мини-группы 7-10 лет',
      benefit: 'Пробный бесплатно',
      cta: 'Купить',
      infographicSubtitle: 'Игра · Проекты · Друзья',
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
      decor: { kind: 'corner-circle', corner: 'bl', size: 38, color: '#49B6FF', opacity: 0.28 },
      palette: {
        ink: '#18324A',
        inkMuted: '#51677A',
        surface: '#FFFDF5',
        accent: '#FF8A3D',
        accentSoft: '#FFD6B8',
      },
      imageSrc: photo('photo-1503676260728-1c00da094a0b'),
      image: { focalX: 0.46, focalY: 0.42, rx: 22 },
      text: {
        title: 'Английский через **игру** и проекты',
        subtitle: 'Мини-группы 7-10 лет: говорим, играем и собираем проекты.',
        cta: 'На пробный урок',
        badge: 'Дети',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
    },
  },
  {
    id: 'travel-retreat',
    name: 'Загородный ретрит',
    description: 'Атмосферный travel-пресет для тура, отеля, глэмпинга или уикенда за городом.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Тишина у озера',
      subtitle: 'Домики, камин и маршруты',
      cta: 'Выбрать даты',
    },
    marketplaceCopy: {
      trait: '3 дня · 2 ночи · полупансион',
      benefit: 'Раннее бронирование',
      cta: 'Купить',
      infographicSubtitle: 'Озеро · Завтрак · Маршрут',
    },
    brandKit: {
      brandName: 'Slow North',
      displayFont: '"Libre Baskerville", Georgia, "Times New Roman", serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#DDE9E3',
        surface: '#10211B',
        accent: '#F4C46B',
        accentSoft: '#F8DDA0',
      },
      gradient: ['#10211B', '#2F5D50', '#F4C46B'],
      toneOfVoice: 'editorial',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#10211B', '#2F5D50', '#F4C46B'] },
      decor: { kind: 'grain', seed: 24, intensity: 0.35 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#DDE9E3',
        surface: '#10211B',
        accent: '#F4C46B',
        accentSoft: '#F8DDA0',
      },
      imageSrc: photo('photo-1500530855697-b586d89ba3ee'),
      image: { focalX: 0.5, focalY: 0.54, cropZoom: 1.03 },
      text: {
        title: 'Три дня **тишины** у озера',
        subtitle: 'Домики с камином, завтраки на террасе и прогулки без спешки.',
        cta: 'Выбрать даты',
        badge: 'Ретрит',
      },
    }),
    preferredModels: {
      'vk-square': 'hero-overlay',
      'vk-vertical': 'hero-overlay',
      'vk-stories': 'hero-overlay',
      'telegram-story': 'hero-overlay',
      'instagram-story': 'hero-overlay',
      'avito-fullscreen': 'hero-overlay',
    },
  },
  {
    id: 'fintech-card',
    name: 'Финтех и банк',
    description: 'Уверенный финансовый пресет для карты, приложения, рассрочки или B2B-сервиса.',
    enabled: { badge: true },
    compactCopy: {
      title: 'Счёт для бизнеса',
      subtitle: 'Карты и лимиты',
      cta: 'Открыть',
    },
    marketplaceCopy: {
      trait: 'Расчётный счёт · 0 ₽ открытие',
      benefit: '0 ₽ обслуживание',
      cta: 'Открыть счёт',
      infographicSubtitle: 'Карты · Лимиты · API',
    },
    brandKit: {
      brandName: 'North Pay',
      displayFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      textFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#C9D7FF',
        surface: '#071426',
        accent: '#7CFFB2',
        accentSoft: '#BDFBD5',
      },
      gradient: ['#071426', '#123B68', '#2D6CDF'],
      toneOfVoice: 'minimal',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#071426', '#123B68', '#2D6CDF'] },
      decor: { kind: 'dotted-grid', density: 10, color: '#FFFFFF', opacity: 0.12 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#C9D7FF',
        surface: '#071426',
        accent: '#7CFFB2',
        accentSoft: '#BDFBD5',
      },
      imageSrc: photo('photo-1554224155-6726b3ff858f'),
      image: { focalX: 0.52, focalY: 0.5, rx: 18 },
      text: {
        title: 'Финансы бизнеса **под контролем**',
        subtitle: 'Карты, лимиты и платежный календарь в одном приложении.',
        cta: 'Открыть счёт',
        badge: 'Финансы',
      },
    }),
    preferredModels: {
      'vk-square': 'split-right-image',
      'vk-landscape': 'split-right-image',
      'vk-stories': 'image-top-text-bottom',
      'telegram-story': 'image-top-text-bottom',
      'instagram-story': 'image-top-text-bottom',
      'avito-fullscreen': 'image-top-text-bottom',
      'yandex-rsy-728x90': 'split-right-image',
    },
  },
]

export const TEMPLATES: Template[] = RAW_TEMPLATES.map(withFormatSettings)

export function getTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null
}
