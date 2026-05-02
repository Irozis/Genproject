// JSON import/export for Project. Validation via zod at the boundary.

import { z } from 'zod'
import type { BrandSnapshot, Project } from './types'

// ---------------------------------------------------------------------------
// Zod schemas — kept flat to mirror types.ts (no abstract factories)
// ---------------------------------------------------------------------------

const tripleHex = z.tuple([z.string(), z.string(), z.string()])

const blockBase = {
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number().optional(),
}

const textBlockSchema = z.object({
  ...blockBase,
  text: z.string(),
  textByLocale: z.record(z.string(), z.string()).optional(),
  fontSize: z.number(),
  charsPerLine: z.number(),
  maxLines: z.number(),
  fitMode: z.enum(['auto', 'clamp', 'ellipsis', 'overflow']).optional(),
  weight: z.number(),
  fill: z.string(),
  opacity: z.number().optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  transform: z.enum(['none', 'uppercase', 'title-case', 'sentence-case']).optional(),
  halo: z
    .object({ color: z.string(), opacity: z.number(), blurPx: z.number() })
    .optional(),
})

const ctaBlockSchema = textBlockSchema.extend({
  bg: z.string(),
  rx: z.number(),
})

const imageBlockSchema = z.object({
  ...blockBase,
  src: z.string().nullable(),
  rx: z.number(),
  fit: z.enum(['cover', 'contain']),
  focalX: z.number().optional(),
  focalY: z.number().optional(),
  cropZoom: z.number().optional(),
  cropX: z.number().optional(),
  cropY: z.number().optional(),
})

const logoBlockSchema = z.object({
  ...blockBase,
  src: z.string().nullable(),
  bgOpacity: z.number(),
})

const scrimSchema = z.object({
  y: z.number(),
  h: z.number(),
  color: z.string(),
  opacity: z.number(),
})

const backgroundSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('gradient'),
    stops: tripleHex,
    radial: z.object({ cx: z.number(), cy: z.number() }).optional(),
  }),
  z.object({ kind: z.literal('solid'), color: z.string() }),
  z.object({ kind: z.literal('tonal'), base: z.string() }),
  z.object({
    kind: z.literal('split'),
    a: z.string(),
    b: z.string(),
    angle: z.union([z.literal(0), z.literal(90)]),
  }),
])

const decorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('corner-circle'),
    corner: z.enum(['tl', 'tr', 'bl', 'br']),
    size: z.number(),
    color: z.string(),
    opacity: z.number(),
  }),
  z.object({
    kind: z.literal('diagonal-stripe'),
    color: z.string(),
    opacity: z.number(),
  }),
  z.object({
    kind: z.literal('rule'),
    y: z.number(),
    color: z.string(),
    opacity: z.number(),
  }),
  z.object({
    kind: z.literal('dotted-grid'),
    density: z.number(),
    color: z.string(),
    opacity: z.number(),
  }),
  z.object({
    kind: z.literal('corner-bracket'),
    corner: z.enum(['tl', 'tr', 'bl', 'br']),
    size: z.number(),
    color: z.string(),
    opacity: z.number(),
  }),
  z.object({
    kind: z.literal('half-circle'),
    edge: z.enum(['top', 'right', 'bottom', 'left']),
    size: z.number(),
    color: z.string(),
    opacity: z.number(),
  }),
  z.object({
    kind: z.literal('grain'),
    seed: z.number(),
    intensity: z.number(),
  }),
])

const sceneSchema = z.object({
  background: backgroundSchema,
  accent: z.string(),
  scrim: scrimSchema.optional(),
  decor: decorSchema.optional(),
  title: textBlockSchema.optional(),
  subtitle: textBlockSchema.optional(),
  cta: ctaBlockSchema.optional(),
  badge: textBlockSchema.optional(),
  logo: logoBlockSchema.optional(),
  image: imageBlockSchema.optional(),
})

const blockKindEnum = z.enum(['title', 'subtitle', 'cta', 'badge', 'logo', 'image'])
const blockOverrideSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().optional(),
  h: z.number().optional(),
  text: z.string().optional(),
  textByLocale: z.record(z.string(), z.string()).optional(),
  fontSize: z.number().optional(),
  charsPerLine: z.number().optional(),
  maxLines: z.number().optional(),
  fitMode: z.enum(['auto', 'clamp', 'ellipsis', 'overflow']).optional(),
  weight: z.number().optional(),
  fill: z.string().optional(),
  opacity: z.number().optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  transform: z.enum(['none', 'uppercase', 'title-case', 'sentence-case']).optional(),
  halo: z.object({ color: z.string(), opacity: z.number(), blurPx: z.number() }).optional(),
  bg: z.string().optional(),
  rx: z.number().optional(),
  src: z.string().nullable().optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  focalX: z.number().optional(),
  focalY: z.number().optional(),
  cropZoom: z.number().optional(),
  cropX: z.number().optional(),
  cropY: z.number().optional(),
  bgOpacity: z.number().optional(),
})

const enabledMapSchema = z.record(blockKindEnum, z.boolean())

const paletteSchema = z.object({
  ink: z.string(),
  inkMuted: z.string(),
  surface: z.string(),
  accent: z.string(),
  accentSoft: z.string(),
})

const brandKitSchema = z.object({
  brandName: z.string(),
  displayFont: z.string(),
  textFont: z.string(),
  palette: paletteSchema,
  gradient: tripleHex,
  toneOfVoice: z
    .string()
    .transform((v) =>
      ['neutral', 'bold', 'friendly', 'minimal', 'editorial'].includes(v)
        ? (v as 'neutral' | 'bold' | 'friendly' | 'minimal' | 'editorial')
        : 'neutral',
    ),
  ctaStyle: z.enum(['pill', 'rounded', 'sharp']),
})

export const brandSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  brandKit: brandKitSchema,
  createdAt: z.number(),
})

export const brandSnapshotListSchema = z.array(brandSnapshotSchema)

const compositionModelSchema = z.enum([
  'text-dominant',
  'split-right-image',
  'hero-overlay',
  'image-top-text-bottom',
])

const assetHintSchema = z.object({
  width: z.number(),
  height: z.number(),
  aspectRatio: z.number(),
  dominantColors: z.array(z.string()),
  isDarkBackground: z.boolean(),
  bottomBandBrightness: z.number().optional(),
  brightnessGrid: z.array(z.array(z.number())).optional(),
})

const formatKeySchema = z.enum([
  'vk-square',
  'vk-vertical',
  'vk-landscape',
  'vk-stories',
  'telegram-story',
  'instagram-story',
  'ozon-fresh-square',
  'yandex-market-card',
  'yandex-market-banner',
  'yandex-market-stretch',
  'yandex-market-vertical',
  'avito-fullscreen',
  'avito-skyscraper',
  'yandex-rsy-240x400',
  'yandex-rsy-300x250',
  'yandex-rsy-728x90',
  'marketplace-card',
  'marketplace-highlight',
  'social-square',
  'story-vertical',
  'wb-card',
  'wb-infographic',
  'ozon-card',
  'avito-listing',
  'avito-square',
])
const anyFormatKeySchema = z.union([formatKeySchema, z.string().startsWith('custom:')])

const formatRuleSetSchema = z.object({
  key: anyFormatKeySchema,
  label: z.string(),
  width: z.number(),
  height: z.number(),
  aspectRatio: z.number(),
  safeZone: z.object({ top: z.number(), right: z.number(), bottom: z.number(), left: z.number() }),
  gutter: z.number(),
  minTitleSize: z.number(),
  maxTitleLines: z.number(),
  typescaleBoost: z.number().optional(),
  requiredElements: z.array(blockKindEnum),
})

const blockOverridesSchema = z.record(anyFormatKeySchema, z.record(blockKindEnum, blockOverrideSchema).optional())
const layoutDensitySchema = z.enum(['compact', 'balanced', 'spacious'])

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  master: sceneSchema,
  enabled: enabledMapSchema,
  brandKit: brandKitSchema,
  goal: z.enum(['promo-pack', 'product-highlight', 'announcement']),
  visualSystem: z.enum(['product-card', 'minimal', 'bold-editorial']),
  assetHint: assetHintSchema.nullable(),
  imageSrc: z.string().nullable(),
  logoSrc: z.string().nullable(),
  selectedFormats: z.array(anyFormatKeySchema),
  formatOverrides: z.record(anyFormatKeySchema, compositionModelSchema).optional(),
  imageFocals: z
    .record(anyFormatKeySchema, z.object({ x: z.number(), y: z.number() }))
    .optional(),
  blockOverrides: blockOverridesSchema.optional(),
  layoutDensity: layoutDensitySchema.optional(),
  formatDensities: z.record(anyFormatKeySchema, layoutDensitySchema).optional(),
  paletteLocked: z.boolean().optional(),
  activeLocale: z.string().optional(),
  availableLocales: z.array(z.string()).optional(),
  customFormats: z.array(formatRuleSetSchema).optional(),
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function exportJson(project: Project): void {
  const safe = project.name.replace(/[^a-z0-9_-]/gi, '_') || 'project'
  const json = JSON.stringify(project, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safe}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importJson(file: File): Promise<Project> {
  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    throw new Error('Not a valid JSON file')
  }
  const result = projectSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('JSON does not match Project schema: ' + result.error.issues[0]?.message)
  }
  return result.data as Project
}

export function parseBrandSnapshotList(value: unknown): BrandSnapshot[] {
  const parsed = brandSnapshotListSchema.safeParse(value)
  if (!parsed.success) return []
  return parsed.data as BrandSnapshot[]
}
