import {
  adjustLightness,
  adjustSaturation,
  chooseReadableTextColor,
  clampLightness,
  contrastRatio,
  hexToHsl,
  hslToHex,
  luminance,
  rotateHue,
} from './color'
import { checkOverflow } from './fixLayout'
import type {
  AssetHint,
  BrandKit,
  CompositionSettings,
  FormatRuleSet,
  LayoutStyleType,
  Palette,
  PaletteVariant,
  Project,
  Scene,
  StyleValidatorWarning,
  TypographySettings,
  VisualSystemKey,
} from './types'

export const DEFAULT_TYPOGRAPHY_SETTINGS: TypographySettings = {
  headingFontFamily: '',
  bodyFontFamily: '',
  ctaFontFamily: '',
  headingSizeScale: 1,
  bodySizeScale: 1,
  ctaSizeScale: 1,
  headingWeight: 800,
  bodyWeight: 400,
  ctaWeight: 700,
  letterSpacing: 0,
  lineHeight: 1.12,
  textTransform: 'none',
  textAlign: 'left',
  maxTextWidthRatio: 1,
  textWrap: 'auto',
  textDensity: 'normal',
}

export const DEFAULT_COMPOSITION_SETTINGS: CompositionSettings = {
  density: 'balanced',
  canvasPaddingScale: 1,
  groupGapScale: 1,
  logoTitleGap: 1,
  titleBodyGap: 1,
  bodyCtaGap: 1,
  imageTextGap: 1,
  objectGap: 1,
  mainAxisAlign: 'left',
  crossAxisAlign: 'left',
  verticalPosition: 'top',
  heroImageScale: 1,
  logoScale: 1,
  cornerRadiusScale: 1,
  borderWidth: 0,
  decorativeIntensity: 1,
}

export const TYPOGRAPHY_PRESETS: Record<string, Partial<TypographySettings>> = {
  Compact: { headingSizeScale: 0.86, bodySizeScale: 0.9, ctaSizeScale: 0.9, lineHeight: 1.02, textDensity: 'compact', maxTextWidthRatio: 0.92 },
  Balanced: { ...DEFAULT_TYPOGRAPHY_SETTINGS },
  Editorial: { headingSizeScale: 1.08, bodySizeScale: 1, ctaSizeScale: 0.96, headingWeight: 700, letterSpacing: -0.015, lineHeight: 1.18, textAlign: 'center', textDensity: 'spacious' },
  'Bold Promo': { headingSizeScale: 1.18, bodySizeScale: 0.98, ctaSizeScale: 1.08, headingWeight: 900, ctaWeight: 800, letterSpacing: -0.02, lineHeight: 1.04, textTransform: 'uppercase' },
  Premium: { headingSizeScale: 1.04, bodySizeScale: 0.94, ctaSizeScale: 0.98, headingWeight: 600, bodyWeight: 400, letterSpacing: 0.02, lineHeight: 1.22, textDensity: 'spacious' },
}

export const COMPOSITION_PRESETS: Record<string, Partial<CompositionSettings>> = {
  Dense: { density: 'compact', canvasPaddingScale: 0.82, groupGapScale: 0.72, objectGap: 0.75, decorativeIntensity: 0.45 },
  Balanced: { ...DEFAULT_COMPOSITION_SETTINGS },
  Airy: { density: 'airy', canvasPaddingScale: 1.18, groupGapScale: 1.25, objectGap: 1.2, decorativeIntensity: 0.65 },
  'Product Focus': { heroImageScale: 1.22, imageTextGap: 1.16, logoScale: 0.92, decorativeIntensity: 0.35 },
  'Text Focus': { heroImageScale: 0.82, canvasPaddingScale: 1.08, groupGapScale: 1.08, decorativeIntensity: 0.35 },
  'CTA Focus': { bodyCtaGap: 0.9, cornerRadiusScale: 1.18, decorativeIntensity: 0.75 },
}

export function normalizeTypographySettings(settings?: Partial<TypographySettings>, brand?: BrandKit): TypographySettings {
  return {
    ...DEFAULT_TYPOGRAPHY_SETTINGS,
    headingFontFamily: settings?.headingFontFamily ?? brand?.displayFont ?? '',
    bodyFontFamily: settings?.bodyFontFamily ?? brand?.textFont ?? '',
    ctaFontFamily: settings?.ctaFontFamily ?? brand?.displayFont ?? '',
    ...settings,
  }
}

export function normalizeCompositionSettings(settings?: Partial<CompositionSettings>): CompositionSettings {
  return { ...DEFAULT_COMPOSITION_SETTINGS, ...settings }
}

export function layoutTypeFromProject(project: Pick<Project, 'visualSystem' | 'selectedFormats'>): LayoutStyleType {
  const joined = project.selectedFormats.join(' ')
  if (/market|ozon|wb|avito|yandex-market/.test(joined)) return 'marketplace'
  if (/story|vk|telegram|instagram|social/.test(joined)) return 'social'
  return layoutTypeFromVisualSystem(project.visualSystem)
}

export function layoutTypeFromVisualSystem(visualSystem: VisualSystemKey): LayoutStyleType {
  if (visualSystem === 'minimal') return 'minimal'
  if (visualSystem === 'bold-editorial') return 'editorial'
  return 'product'
}

type PaletteOptions = {
  seed?: number
  assetHint?: AssetHint | null
  layoutType?: LayoutStyleType
  industry?: string
  preset?: 'auto' | 'brand' | 'contrast' | 'dark' | 'light' | 'accent'
}

export function paletteVariantToBrandKit(brand: BrandKit, variant: PaletteVariant): BrandKit {
  const palette: Palette = {
    ink: variant.primaryText,
    inkMuted: variant.secondaryText,
    surface: variant.surface,
    accent: variant.accent,
    accentSoft: variant.muted,
  }
  return {
    ...brand,
    palette,
    gradient: [variant.background, variant.surface, variant.muted],
  }
}

export function generatePaletteVariants(brand: BrandKit, layout: LayoutStyleType, options: PaletteOptions = {}): PaletteVariant[] {
  const seed = options.seed ?? 1
  const base = brand.palette.accent || brand.palette.ink || '#2563EB'
  const secondary = brand.palette.accentSoft || brand.palette.surface || adjustLightness(base, 34)
  const bg = brand.palette.surface || '#FFFFFF'
  const imageColor = pickImageColor(options.assetHint, base)
  const toneShift = toneHueShift(brand.toneOfVoice) + layoutHueShift(layout) + seeded(seed, -8, 8)
  const accent = mixHue(base, imageColor, 0.22, toneShift)
  const softAccent = adjustSaturation(adjustLightness(accent, 28), -22)
  const darkBase = clampLightness(adjustSaturation(accent, -10), 10, 22)
  const brightAccent = clampLightness(adjustSaturation(rotateHue(accent, seeded(seed + 11, -18, 18)), 18), 42, 58)
  const neutral = neutralize(base)

  return [
    makeVariant('brand-core', 'Brand Core', 'Close to the current brand colors with safe text contrast.', {
      background: bg,
      surface: lightSurface(bg, secondary),
      accent,
      ctaBackground: accent,
      muted: softAccent,
      border: adjustLightness(softAccent, -8),
      warningColor: '#B45309',
      moodTags: ['brand', brand.toneOfVoice, layout],
    }),
    makeVariant('high-contrast', 'High Contrast', 'Sharper text, stronger CTA and clearer separation for dense placements.', {
      background: luminance(bg) > 0.45 ? '#FFFFFF' : '#080A0F',
      surface: luminance(bg) > 0.45 ? '#F3F6FB' : '#111827',
      accent: brightAccent,
      ctaBackground: luminance(brightAccent) > 0.42 ? clampLightness(brightAccent, 30, 42) : brightAccent,
      muted: luminance(bg) > 0.45 ? '#E5E7EB' : '#1F2937',
      border: luminance(bg) > 0.45 ? '#CBD5E1' : '#334155',
      warningColor: '#F59E0B',
      moodTags: ['contrast', 'performance', layout],
    }),
    makeVariant('soft-calm', 'Soft / Calm', 'A softer advertising palette derived from the brand hue.', {
      background: hslToHex(hexToHsl(accent).h, Math.max(12, hexToHsl(accent).s * 0.28), 96),
      surface: '#FFFFFF',
      accent: adjustSaturation(clampLightness(accent, 44, 62), -8),
      ctaBackground: adjustSaturation(clampLightness(accent, 38, 52), -4),
      muted: hslToHex(hexToHsl(accent).h, 28, 90),
      border: hslToHex(hexToHsl(accent).h, 22, 82),
      warningColor: '#B45309',
      moodTags: ['soft', 'calm', brand.toneOfVoice],
    }),
    makeVariant('premium-dark', 'Premium Dark', 'A dark premium system with a restrained brand accent.', {
      background: darkBase,
      surface: adjustLightness(darkBase, 7),
      accent: clampLightness(adjustSaturation(rotateHue(accent, seeded(seed + 3, -10, 10)), -12), 58, 72),
      ctaBackground: clampLightness(adjustSaturation(accent, 4), 56, 70),
      muted: adjustLightness(darkBase, 14),
      border: adjustLightness(darkBase, 22),
      warningColor: '#FBBF24',
      moodTags: ['premium', 'dark', layout],
    }),
    makeVariant('fresh-bright', 'Fresh / Bright', 'A brighter campaign version with more retail energy.', {
      background: hslToHex(hexToHsl(brightAccent).h, 46, 95),
      surface: '#FFFFFF',
      accent: brightAccent,
      ctaBackground: brightAccent,
      muted: hslToHex(hexToHsl(brightAccent).h + 16, 54, 88),
      border: hslToHex(hexToHsl(brightAccent).h, 40, 78),
      warningColor: '#D97706',
      moodTags: ['fresh', 'bright', 'promo'],
    }),
    makeVariant('mono-accent', 'Monochrome Accent', 'Mostly monochrome with one computed brand accent.', {
      background: hslToHex(hexToHsl(neutral).h, 8, luminance(bg) > 0.45 ? 96 : 12),
      surface: hslToHex(hexToHsl(neutral).h, 9, luminance(bg) > 0.45 ? 100 : 18),
      accent: clampLightness(accent, luminance(bg) > 0.45 ? 34 : 58, luminance(bg) > 0.45 ? 48 : 74),
      ctaBackground: clampLightness(accent, luminance(bg) > 0.45 ? 30 : 58, luminance(bg) > 0.45 ? 46 : 74),
      muted: hslToHex(hexToHsl(neutral).h, 10, luminance(bg) > 0.45 ? 88 : 24),
      border: hslToHex(hexToHsl(neutral).h, 10, luminance(bg) > 0.45 ? 78 : 34),
      warningColor: '#B45309',
      moodTags: ['monochrome', 'accent', layout],
    }),
  ]
}

function makeVariant(id: string, name: string, description: string, input: Omit<PaletteVariant, 'id' | 'name' | 'description' | 'primaryText' | 'secondaryText' | 'ctaText' | 'contrastScore'>): PaletteVariant {
  let background = input.background
  let surface = input.surface
  let primaryText = chooseReadableTextColor(background)
  let secondaryText = contrastRatio('#4E5155', background) >= 4.5 ? '#4E5155' : primaryText
  let ctaText = chooseReadableTextColor(input.ctaBackground)
  if (contrastRatio(primaryText, background) < 4.5) primaryText = luminance(background) > 0.5 ? '#0E1014' : '#FFFFFF'
  if (contrastRatio(secondaryText, background) < 4.5) secondaryText = luminance(background) > 0.5 ? '#2A2D35' : '#E6E8EC'
  if (contrastRatio(ctaText, input.ctaBackground) < 4.5) ctaText = luminance(input.ctaBackground) > 0.5 ? '#0E1014' : '#FFFFFF'
  if (contrastRatio(primaryText, background) < 4.5) background = luminance(background) > 0.5 ? adjustLightness(background, 10) : adjustLightness(background, -10)
  if (Math.abs(luminance(surface) - luminance(background)) < 0.04) {
    surface = luminance(background) > 0.5 ? adjustLightness(surface, -4) : adjustLightness(surface, 6)
  }
  const contrastScore = Math.min(
    contrastRatio(primaryText, background),
    contrastRatio(secondaryText, background),
    contrastRatio(ctaText, input.ctaBackground),
  )
  return { ...input, id, name, description, background, surface, primaryText, secondaryText, ctaText, contrastScore }
}

export function applyStyleSettingsToScene(scene: Scene, rules: FormatRuleSet, typography?: TypographySettings, composition?: CompositionSettings): Scene {
  const typo = normalizeTypographySettings(typography)
  const comp = normalizeCompositionSettings(composition)
  let out: Scene = { ...scene }
  const formatScale = Math.min(1.18, Math.max(0.78, Math.sqrt((rules.width * rules.height) / (1080 * 1080))))
  const minPct = ((rules.minFontSize ?? 11) / rules.width) * 100
  const titleMax = rules.aspectRatio > 1.8 ? 5.8 : rules.aspectRatio < 0.7 ? 8.2 : 7.2
  const align = typo.textAlign
  const widthScale = Math.min(1.08, Math.max(0.58, typo.maxTextWidthRatio))

  if (out.title) {
    const size = Math.max(minPct * 1.22, Math.min(titleMax, out.title.fontSize * typo.headingSizeScale * formatScale))
    out.title = {
      ...out.title,
      fontFamily: typo.headingFontFamily || out.title.fontFamily,
      fontSize: size,
      weight: typo.headingWeight,
      letterSpacing: typo.letterSpacing,
      lineHeight: typo.lineHeight,
      align,
      transform: mapTransform(typo.textTransform),
      w: Math.min(out.title.w * widthScale, maxWidthFromSafeArea(out.title.x, rules)),
      maxLines: typo.textWrap === 'no-wrap' ? 1 : out.title.maxLines,
    }
  }
  if (out.subtitle) {
    out.subtitle = {
      ...out.subtitle,
      fontFamily: typo.bodyFontFamily || out.subtitle.fontFamily,
      fontSize: Math.max(minPct, out.subtitle.fontSize * typo.bodySizeScale * formatScale),
      weight: typo.bodyWeight,
      letterSpacing: typo.letterSpacing * 0.5,
      lineHeight: Math.max(1.05, typo.lineHeight + (typo.textDensity === 'spacious' ? 0.14 : typo.textDensity === 'compact' ? -0.04 : 0.08)),
      align,
      transform: mapTransform(typo.textTransform),
      w: Math.min(out.subtitle.w * widthScale, maxWidthFromSafeArea(out.subtitle.x, rules)),
      maxLines: typo.textWrap === 'no-wrap' ? 1 : out.subtitle.maxLines,
    }
  }
  if (out.cta) {
    out.cta = {
      ...out.cta,
      fontFamily: typo.ctaFontFamily || out.cta.fontFamily,
      fontSize: Math.max(minPct, out.cta.fontSize * typo.ctaSizeScale * formatScale),
      weight: typo.ctaWeight,
      letterSpacing: typo.letterSpacing,
      lineHeight: 1,
      align: 'center',
      transform: mapTransform(typo.textTransform),
      rx: out.cta.rx === 999 ? 999 : Math.max(0, out.cta.rx * comp.cornerRadiusScale),
    }
  }
  if (out.badge) {
    out.badge = { ...out.badge, fontFamily: typo.bodyFontFamily || out.badge.fontFamily, align }
  }
  if (out.logo) out.logo = { ...out.logo, w: out.logo.w * comp.logoScale, h: out.logo.h ? out.logo.h * comp.logoScale : out.logo.h }
  if (out.image) {
    const nextW = Math.min(100, out.image.w * comp.heroImageScale)
    const nextH = Math.min(100, (out.image.h ?? 50) * comp.heroImageScale)
    out.image = { ...out.image, w: nextW, h: nextH, rx: out.image.rx * comp.cornerRadiusScale }
  }
  if (out.decor) out = applyDecorIntensity(out, comp.decorativeIntensity * comp.objectGap)
  out = applyCompositionFlow(out, rules, comp)
  return out
}

export function validateStyleScene(scene: Scene, format: FormatRuleSet, brand: BrandKit): StyleValidatorWarning[] {
  const warnings: StyleValidatorWarning[] = []
  const bg = scene.background.kind === 'solid' ? scene.background.color : scene.background.kind === 'gradient' ? scene.background.stops[1] : scene.background.kind === 'split' ? scene.background.a : scene.background.base
  const textBlocks = [
    ['title', scene.title],
    ['subtitle', scene.subtitle],
  ] as const
  for (const [name, block] of textBlocks) {
    if (!block) continue
    if (contrastRatio(block.fill, bg) < 4.5) warnings.push({ id: `${name}-contrast`, target: 'palette', severity: 'warning', message: 'Контраст текста недостаточен' })
    const px = (block.fontSize / 100) * format.width
    if (px < (format.minFontSize ?? 11)) warnings.push({ id: `${name}-small`, target: 'typography', severity: 'warning', message: name === 'title' ? 'Заголовок может быть слишком мелким для этого формата' : 'Описание может быть слишком мелким для этого формата' })
  }
  if (scene.cta) {
    if (contrastRatio(scene.cta.fill, scene.cta.bg) < 4.5) warnings.push({ id: 'cta-contrast', target: 'palette', severity: 'warning', message: 'Контраст CTA недостаточен' })
    const ctaHeightPx = ((scene.cta.h ?? 0) / 100) * format.height
    if (ctaHeightPx < 34) warnings.push({ id: 'cta-small', target: 'composition', severity: 'warning', message: 'CTA может быть слишком маленьким для этого формата' })
  }
  for (const issue of checkOverflow(scene, format)) {
    if (/overlay zone/.test(issue.message)) warnings.push({ id: `overlay-${issue.block}`, target: 'composition', severity: 'warning', message: 'CTA попадает в зону маркировки' })
    if (/safe area/.test(issue.message)) warnings.push({ id: `safe-${issue.block}`, target: 'composition', severity: 'warning', message: 'Текст или ключевой объект выходит за safe area' })
    if (/Text area may exceed/.test(issue.message)) warnings.push({ id: `text-area-${issue.block}`, target: 'typography', severity: 'warning', message: `Текст занимает слишком много площади для ${format.label}` })
  }
  void brand
  return dedupeWarnings(warnings)
}

function applyCompositionFlow(scene: Scene, rules: FormatRuleSet, comp: CompositionSettings): Scene {
  const out: Scene = { ...scene }
  const pad = rules.safeZone.left * comp.canvasPaddingScale
  const rightLimit = 100 - rules.safeZone.right * comp.canvasPaddingScale
  const stack = [out.logo, out.title, out.subtitle, out.cta].filter(Boolean) as Array<{ x: number; y: number; w: number; h?: number }>
  if (stack.length > 0) {
    const minY = Math.min(...stack.map((b) => b.y))
    const maxY = Math.max(...stack.map((b) => b.y + (b.h ?? 6)))
    const height = maxY - minY
    const targetY = comp.verticalPosition === 'center' ? (100 - height) / 2 : comp.verticalPosition === 'bottom' ? 100 - rules.safeZone.bottom - height : rules.safeZone.top * comp.canvasPaddingScale
    const dy = (targetY - minY) * 0.45
    const alignX = comp.mainAxisAlign === 'center' ? 50 : comp.mainAxisAlign === 'right' ? rightLimit : pad
    for (const k of ['logo', 'title', 'subtitle', 'cta'] as const) {
      const block = out[k]
      if (!block) continue
      const w = block.w
      const x = comp.mainAxisAlign === 'center' ? alignX - w / 2 : comp.mainAxisAlign === 'right' ? alignX - w : alignX
      ;(out as Record<string, unknown>)[k] = { ...block, x: Math.max(pad, Math.min(rightLimit - w, x)), y: Math.max(rules.safeZone.top, Math.min(100 - rules.safeZone.bottom - (block.h ?? 4), block.y + dy)) }
    }
  }
  const gapScale = comp.groupGapScale * (comp.density === 'compact' ? 0.8 : comp.density === 'airy' ? 1.2 : 1)
  if (out.logo && out.title) out.title = { ...out.title, y: Math.max(out.title.y, out.logo.y + (out.logo.h ?? 5) + 1.2 * comp.logoTitleGap * gapScale) }
  if (out.title && out.subtitle) out.subtitle = { ...out.subtitle, y: Math.max(out.subtitle.y, out.title.y + textHeight(out.title, rules) + 1.6 * comp.titleBodyGap * gapScale) }
  if (out.subtitle && out.cta) out.cta = { ...out.cta, y: Math.max(out.cta.y, out.subtitle.y + textHeight(out.subtitle, rules) + 2.2 * comp.bodyCtaGap * gapScale) }
  if (out.cta && comp.borderWidth > 0) {
    const growX = (comp.borderWidth / rules.width) * 200
    const growY = (comp.borderWidth / rules.height) * 200
    out.cta = { ...out.cta, w: Math.min(100 - out.cta.x, out.cta.w + growX), h: (out.cta.h ?? 6) + growY }
  }
  if (out.image && out.title) {
    const textRight = Math.max(out.title.x + out.title.w, out.subtitle ? out.subtitle.x + out.subtitle.w : 0, out.cta ? out.cta.x + out.cta.w : 0)
    if (out.image.x < textRight && out.image.x > out.title.x) {
      const nextX = Math.min(100 - out.image.w, textRight + comp.imageTextGap * gapScale)
      out.image = { ...out.image, x: nextX }
    }
  }
  for (const k of ['title', 'subtitle'] as const) {
    const block = out[k]
    if (block) out[k] = { ...block, align: comp.crossAxisAlign }
  }
  return out
}

function textHeight(block: { fontSize: number; maxLines: number; lineHeight?: number }, rules: FormatRuleSet): number {
  return block.fontSize * (block.lineHeight ?? 1.15) * Math.max(1, block.maxLines) * rules.aspectRatio
}

function maxWidthFromSafeArea(x: number, rules: FormatRuleSet): number {
  return Math.max(20, 100 - rules.safeZone.right - x)
}

function mapTransform(transform: TypographySettings['textTransform']): 'none' | 'uppercase' | 'title-case' | 'sentence-case' {
  if (transform === 'uppercase') return 'uppercase'
  if (transform === 'title-case') return 'title-case'
  return 'none'
}

function applyDecorIntensity(scene: Scene, intensity: number): Scene {
  if (!scene.decor || intensity <= 0.02) {
    const { decor: _decor, ...rest } = scene
    return rest
  }
  const decor = scene.decor.kind === 'grain'
    ? { ...scene.decor, intensity: scene.decor.intensity * intensity }
    : { ...scene.decor, opacity: scene.decor.opacity * intensity }
  return { ...scene, decor }
}

function pickImageColor(hint: AssetHint | null | undefined, fallback: string): string {
  const colors = hint?.dominantColors?.filter((color) => /^#?[0-9a-f]{3,6}$/i.test(color)) ?? []
  return colors.find((color) => Math.abs(luminance(color) - 0.5) > 0.12) ?? colors[0] ?? fallback
}

function toneHueShift(tone: BrandKit['toneOfVoice']): number {
  if (tone === 'bold') return 8
  if (tone === 'friendly') return 16
  if (tone === 'minimal') return -6
  if (tone === 'editorial') return -14
  return 0
}

function layoutHueShift(layout: LayoutStyleType): number {
  if (layout === 'premium') return -10
  if (layout === 'bold') return 12
  if (layout === 'editorial') return -8
  if (layout === 'social') return 18
  if (layout === 'marketplace') return 4
  return 0
}

function seeded(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  const n = x - Math.floor(x)
  return min + n * (max - min)
}

function mixHue(a: string, b: string, amount: number, shift: number): string {
  const ah = hexToHsl(a)
  const bh = hexToHsl(b)
  return hslToHex(ah.h * (1 - amount) + bh.h * amount + shift, ah.s * 0.75 + bh.s * 0.25, ah.l * 0.78 + bh.l * 0.22)
}

function neutralize(hex: string): string {
  const h = hexToHsl(hex)
  return hslToHex(h.h, Math.min(12, h.s), h.l)
}

function lightSurface(bg: string, secondary: string): string {
  return luminance(bg) > 0.5 ? '#FFFFFF' : clampLightness(adjustSaturation(secondary, -18), 14, 24)
}

function dedupeWarnings(warnings: StyleValidatorWarning[]): StyleValidatorWarning[] {
  const seen = new Set<string>()
  return warnings.filter((warning) => {
    if (seen.has(warning.id)) return false
    seen.add(warning.id)
    return true
  })
}
