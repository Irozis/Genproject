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
  CtaBlock,
  LogoBlock,
  ImageBlock,
} from './types'

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
}

type BaseArgs = {
  bg: Background
  decor?: Decor
  palette: Palette
  text: { title: string; subtitle: string; cta: string; badge: string }
  ctaFill?: string
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
  letterSpacing: -0.02,
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
  letterSpacing: 0.02,
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
  letterSpacing: 0.1,
})

const logo: LogoBlock = { x: 80, y: 6, w: 14, h: 6, src: null, bgOpacity: 0 }
const image: ImageBlock = { x: 50, y: 8, w: 44, h: 84, src: null, rx: 16, fit: 'cover' }

const make = ({ bg, decor, palette, text, ctaFill }: BaseArgs): Scene => {
  const ctaTextColor = ctaFill ?? palette.surface
  const scene: Scene = {
    background: bg,
    accent: palette.accent,
    title: title(text.title, palette.ink),
    subtitle: subtitle(text.subtitle, palette.ink),
    cta: cta(text.cta, palette.accent, ctaTextColor, 999),
    badge: badge(text.badge, palette.accent),
    logo,
    image,
  }
  if (decor) scene.decor = decor
  return scene
}

export const TEMPLATES: Template[] = [
  {
    id: 'bold-editorial',
    name: 'Bold Editorial',
    description: 'Diagonal split field with oversize display type.',
    brandKit: {
      brandName: 'Atlas Press',
      displayFont: '"Playfair Display", "Times New Roman", Georgia, serif',
      textFont: '"Inter", system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#E6E6EA',
        surface: '#FFFFFF',
        accent: '#FF3B30',
        accentSoft: '#FFD1CE',
      },
      gradient: ['#0E1014', '#FF3B30', '#FFFFFF'],
      toneOfVoice: 'editorial',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'split', a: '#0E1014', b: '#FF3B30', angle: 90 },
      decor: { kind: 'rule', y: 48, color: '#FFFFFF', opacity: 0.8 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#E6E6EA',
        surface: '#FFFFFF',
        accent: '#FF3B30',
        accentSoft: '#FFD1CE',
      },
      ctaFill: '#0E1014',
      text: {
        title: 'Issue 04 — **Summer stories**',
        subtitle: 'Dispatches from the edge of retail.',
        cta: 'Read now',
        badge: 'Vol 04',
      },
    }),
    preferredModels: {
      'marketplace-card': 'text-dominant',
      'social-square': 'text-dominant',
    },
  },
  {
    id: 'mono-minimal',
    name: 'Mono Minimal',
    description: 'Paper-white surface with a soft accent circle in the corner.',
    brandKit: {
      brandName: 'Mono Studio',
      displayFont: '"Inter Display", Inter, system-ui, sans-serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#000000',
        inkMuted: '#4E5155',
        surface: '#FFFFFF',
        accent: '#0061FF',
        accentSoft: '#CFE0FF',
      },
      gradient: ['#FAFAFA', '#F5F5F7', '#EFEFF1'],
      toneOfVoice: 'minimal',
      ctaStyle: 'sharp',
    },
    master: make({
      bg: { kind: 'solid', color: '#F5F5F7' },
      decor: { kind: 'corner-circle', corner: 'br', size: 45, color: '#0061FF', opacity: 0.08 },
      palette: {
        ink: '#000000',
        inkMuted: '#4E5155',
        surface: '#FFFFFF',
        accent: '#0061FF',
        accentSoft: '#CFE0FF',
      },
      text: {
        title: 'Quiet **confidence** in every layout',
        subtitle: 'Designed for brands that whisper.',
        cta: 'View collection',
        badge: 'Studio',
      },
    }),
  },
  {
    id: 'vibrant-pop',
    name: 'Vibrant Pop',
    description: 'Tonal magenta with a yellow sun in the top-left.',
    brandKit: {
      brandName: 'Pop Shop',
      displayFont: '"Archivo Black", "Inter Display", Inter, system-ui, sans-serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#FFE5F0',
        surface: '#0E0014',
        accent: '#FFD60A',
        accentSoft: '#FFF2A8',
      },
      gradient: ['#FF006E', '#FF4D94', '#FF9EC0'],
      toneOfVoice: 'friendly',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'tonal', base: '#FF006E' },
      decor: { kind: 'corner-circle', corner: 'tl', size: 28, color: '#FFD60A', opacity: 1 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#FFE5F0',
        surface: '#0E0014',
        accent: '#FFD60A',
        accentSoft: '#FFF2A8',
      },
      ctaFill: '#0E0014',
      text: {
        title: 'Drop **one** is live',
        subtitle: 'Limited run. While it lasts.',
        cta: 'Grab yours',
        badge: 'Hot',
      },
    }),
    preferredModels: {
      'story-vertical': 'hero-overlay',
    },
  },
  {
    id: 'tech-stack',
    name: 'Tech Stack',
    description: 'Deep navy gradient with a cyan diagonal accent.',
    brandKit: {
      brandName: 'Stack Cloud',
      displayFont: '"JetBrains Mono", "SF Mono", ui-monospace, monospace',
      textFont: '"Inter", system-ui, sans-serif',
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#B8C2E0',
        surface: '#0A0E27',
        accent: '#00D4FF',
        accentSoft: '#6EE9FF',
      },
      gradient: ['#0A0E27', '#13192F', '#1E2749'],
      toneOfVoice: 'bold',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'gradient', stops: ['#0A0E27', '#13192F', '#1E2749'] },
      decor: { kind: 'diagonal-stripe', color: '#00D4FF', opacity: 0.12 },
      palette: {
        ink: '#FFFFFF',
        inkMuted: '#B8C2E0',
        surface: '#0A0E27',
        accent: '#00D4FF',
        accentSoft: '#6EE9FF',
      },
      ctaFill: '#0A0E27',
      text: {
        title: 'Ship **features**, not pixels',
        subtitle: 'The composer your team has been asking for.',
        cta: 'Try it free',
        badge: 'v1.0',
      },
    }),
  },
  {
    id: 'soft-pastel',
    name: 'Soft Pastel',
    description: 'Tonal cream palette with a subtle editorial rule.',
    brandKit: {
      brandName: 'Bloom Co',
      displayFont: '"DM Serif Display", "Playfair Display", Georgia, serif',
      textFont: 'Inter, system-ui, sans-serif',
      palette: {
        ink: '#3D2C40',
        inkMuted: '#6B5865',
        surface: '#FBF5EE',
        accent: '#8B5A3C',
        accentSoft: '#DCC0A8',
      },
      gradient: ['#F4E4DB', '#EDD5C6', '#E6C6B1'],
      toneOfVoice: 'friendly',
      ctaStyle: 'rounded',
    },
    master: make({
      bg: { kind: 'tonal', base: '#F4E4DB' },
      decor: { kind: 'rule', y: 52, color: '#8B5A3C', opacity: 0.35 },
      palette: {
        ink: '#3D2C40',
        inkMuted: '#6B5865',
        surface: '#FBF5EE',
        accent: '#8B5A3C',
        accentSoft: '#DCC0A8',
      },
      text: {
        title: 'Slower mornings, **brighter** afternoons',
        subtitle: 'A small ritual for every day.',
        cta: 'Explore',
        badge: 'New',
      },
    }),
  },
]

export function getTemplate(id: string): Template | null {
  return TEMPLATES.find((t) => t.id === id) ?? null
}
