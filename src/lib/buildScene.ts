// The single deterministic pipeline for producing a per-format Scene
// from (master scene + format key + brand kit + enabled map).
// No randomness. No side effects.

import { contrastRatio, contrastRatioFromLuminance, luminance, pickReadableInkForLuma } from './color'
import { LAYOUTS, chooseLayoutArchetype } from './composition'
import { getFormat } from './formats'
import { applyLayoutDensity } from './layoutDensity'
import { fitFontSize as fitFontSizePx, measureTextWidth, wrapText } from './textMeasure'
import type {
  AssetHint,
  BlockKind,
  Background,
  BrandKit,
  BlockOverride,
  CompositionModel,
  EnabledMap,
  FormatKey,
  Scene,
  FormatRuleSet,
  LayoutDensity,
  TextAlign,
  TextBlock,
} from './types'

export type BuildOptions = {
  /** Force a specific composition model for this build. Overrides the profile
   *  chooser. Templates' preferredModels + user formatOverrides land here. */
  override?: CompositionModel | 'auto' | null
  /** Analyzed image stats. Optional — when present, lets layouts auto-tune
   *  things like scrim opacity under overlaid text. */
  assetHint?: AssetHint | null
  /** Optional per-block geometry override for this format. */
  blockOverrides?: Partial<Record<BlockKind, BlockOverride>>
  density?: LayoutDensity
  locale?: string
  customFormats?: FormatRuleSet[]
}

const TONE_DEFAULTS: Record<BrandKit['toneOfVoice'], { titleWeight: number; letterSpacing: number; maxLines: number; align: TextAlign }> = {
  neutral: { titleWeight: 700, letterSpacing: 0, maxLines: 3, align: 'left' },
  bold: { titleWeight: 900, letterSpacing: 0, maxLines: 2, align: 'left' },
  friendly: { titleWeight: 600, letterSpacing: 0, maxLines: 3, align: 'left' },
  minimal: { titleWeight: 400, letterSpacing: 0, maxLines: 2, align: 'left' },
  editorial: { titleWeight: 800, letterSpacing: 0, maxLines: 2, align: 'center' },
}

export type CompositionSelectionDebug = {
  manualOverride?: CompositionModel
  autoSelectorUsed: boolean
  selectedArchetype: CompositionModel
  selectionDebug?: ReturnType<typeof chooseLayoutArchetype>['selectionDebug']
}

export function normalizeCompositionOverride(
  override: CompositionModel | 'auto' | null | undefined,
): CompositionModel | undefined {
  return override && override !== 'auto' ? override : undefined
}

function pickCompositionSelection(
  branded: Scene,
  rules: FormatRuleSet,
  enabled: EnabledMap,
  override: CompositionModel | 'auto' | null | undefined,
  assetHint?: AssetHint | null,
): CompositionSelectionDebug {
  const manualOverride = normalizeCompositionOverride(override)
  if (manualOverride) {
    return {
      manualOverride,
      autoSelectorUsed: false,
      selectedArchetype: manualOverride,
    }
  }
  const selection = chooseLayoutArchetype({ format: rules, scene: branded, enabled, assetHint })
  return {
    autoSelectorUsed: true,
    selectedArchetype: selection.selected,
    selectionDebug: selection.selectionDebug,
  }
}

function pickCompositionModel(
  branded: Scene,
  rules: FormatRuleSet,
  enabled: EnabledMap,
  override: CompositionModel | 'auto' | null | undefined,
  assetHint?: AssetHint | null,
): CompositionModel {
  return pickCompositionSelection(branded, rules, enabled, override, assetHint).selectedArchetype
}

/** Same composition decision as `buildScene` — for UI (picker labels, tooltips). */
export function resolveCompositionModel(
  master: Scene,
  formatKey: FormatKey,
  brandKit: BrandKit,
  enabled: EnabledMap,
  options: BuildOptions = {},
): CompositionModel {
  const rules = applyLayoutDensity(getFormat(formatKey, options.customFormats), options.density)
  const branded = applyBrandKit(master, brandKit)
  const localized = applyLocale(branded, options.locale)
  const layoutInput = applyPreLayoutBlockOverrides(localized, options.blockOverrides)
  return pickCompositionModel(layoutInput, rules, enabled, options.override, options.assetHint)
}

export function resolveCompositionSelection(
  master: Scene,
  formatKey: FormatKey,
  brandKit: BrandKit,
  enabled: EnabledMap,
  options: BuildOptions = {},
): CompositionSelectionDebug {
  const rules = applyLayoutDensity(getFormat(formatKey, options.customFormats), options.density)
  const branded = applyBrandKit(master, brandKit)
  const localized = applyLocale(branded, options.locale)
  const layoutInput = applyPreLayoutBlockOverrides(localized, options.blockOverrides)
  return pickCompositionSelection(layoutInput, rules, enabled, options.override, options.assetHint)
}

export function buildScene(
  master: Scene,
  formatKey: FormatKey,
  brandKit: BrandKit,
  enabled: EnabledMap,
  options: BuildOptions = {},
): Scene {
  const rules = applyLayoutDensity(getFormat(formatKey, options.customFormats), options.density)

  // 1. apply brand kit to master before layout (so layouts can override fills if needed)
  const branded = applyBrandKit(master, brandKit)
  const localizedBase = applyLocale(branded, options.locale)
  const layoutInput = applyPreLayoutBlockOverrides(localizedBase, options.blockOverrides)

  // 2. profile content + choose layout (or honour override)
  const selection = pickCompositionSelection(layoutInput, rules, enabled, options.override, options.assetHint)
  const model = selection.selectedArchetype

  // 3. compute positioned scene
  const positioned = LAYOUTS[model](layoutInput, rules, enabled, options.assetHint ?? null)

  // 4. focal-aware background: when an image with non-default focal is placed,
  //    retarget a gradient background to radiate from the subject. Linear
  //    gradients stay linear when image is absent or focal is dead-centre.
  const focalAware = applyFocalGradient(positioned)

  // 5. snap text blocks to a quarter-gutter baseline so stacks line up visually
  //    across formats without anyone having to hand-tune y values.
  const snapped = snapToBaseline(focalAware, rules.gutter / 4)

  // 6. apply explicit per-format geometry overrides copied from another format.
  const overridden = applyBlockOverrides(snapped, options.blockOverrides, layoutInput)

  // 8. clamp anything outside safe zone after overrides.
  const clamped = clampToFrame(overridden, rules.safeZone)

  // 9. tighten editable object fields to the content they actually render.
  // Designers drag these boxes in the editor, and diagnostics use them for
  // overlap checks; oversized empty boxes make good layouts look broken.
  const fieldTightened = clampToFrame(compactObjectFields(clamped, rules), rules.safeZone)

  // 10. final readability guard. This is intentionally small and deterministic:
  // layout stays untouched; only text fills and existing scrim opacity can move.
  return ensureReadableScene(fieldTightened, rules, options.assetHint ?? null)
}

function applyLocale(scene: Scene, locale: string | undefined): Scene {
  if (!locale) return scene
  const out: Scene = { ...scene }
  for (const k of ['title', 'subtitle', 'cta', 'badge'] as const) {
    const b = out[k]
    if (!b || !('textByLocale' in b)) continue
    const textByLocale = b.textByLocale
    const text = textByLocale?.[locale]
    if (!text) continue
    ;(out as Record<string, unknown>)[k] = { ...b, text }
  }
  return out
}

function applyBlockOverrides(
  scene: Scene,
  overrides?: Partial<Record<BlockKind, BlockOverride>>,
  source?: Scene,
): Scene {
  if (!overrides) return scene
  const out: Scene = { ...scene }
  for (const k of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const o = overrides[k]
    if (!o) continue
    // `hidden: true` removes the block from this format entirely — consumers
    // (renderer, hotspot map, layout issues) all gracefully handle a missing
    // block, so this is enough to make the block disappear without touching
    // the master scene or the project-wide `enabled` map.
    if (o.hidden) {
      delete (out as Record<string, unknown>)[k]
      continue
    }
    const b = out[k] ?? source?.[k]
    if (!b) continue
    ;(out as Record<string, unknown>)[k] = { ...b, ...dropUndefined(stripPresentationOnly(o)) }
  }
  return out
}

function applyPreLayoutBlockOverrides(scene: Scene, overrides?: Partial<Record<BlockKind, BlockOverride>>): Scene {
  if (!overrides) return scene
  const out: Scene = { ...scene }
  for (const k of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const o = overrides[k]
    if (!o) continue
    if (o.hidden) {
      delete (out as Record<string, unknown>)[k]
      continue
    }
    const b = out[k]
    if (!b) continue
    const layoutInput = dropUndefined(stripGeometryOnly(stripPresentationOnly(o)))
    ;(out as Record<string, unknown>)[k] = { ...b, ...layoutInput }
  }
  return out
}

// `hidden` is an editor-only flag; it must not leak into the rendered Scene
// (TextBlock / CtaBlock / etc. don't have such a field). Strip it here so
// the spread below doesn't ship a stray boolean to the renderer.
function stripPresentationOnly(o: BlockOverride): Omit<BlockOverride, 'hidden'> {
  const { hidden: _hidden, ...rest } = o
  return rest
}

function stripGeometryOnly(o: Omit<BlockOverride, 'hidden'>): Omit<BlockOverride, 'hidden' | 'x' | 'y' | 'w' | 'h'> {
  const { x: _x, y: _y, w: _w, h: _h, ...rest } = o
  return rest
}

function dropUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}

// If the scene has a placed image with off-centre focal AND a linear gradient
// background, rewrite the background as a radial gradient whose centre is
// mapped from the image focal into canvas coordinates. Leaves the scene
// untouched when the image is absent, focal is default (0.5, 0.5), or the
// background isn't a gradient. Idempotent — running twice doesn't drift.
function applyFocalGradient(scene: Scene): Scene {
  const bg = scene.background
  const img = scene.image
  if (!img || !img.src || bg.kind !== 'gradient') return scene
  const fx = img.focalX ?? 0.5
  const fy = img.focalY ?? 0.5
  if (Math.abs(fx - 0.5) < 0.05 && Math.abs(fy - 0.5) < 0.05) return scene
  // Map 0..1 focal within the image bbox → 0..1 in canvas coords.
  const cx = (img.x + fx * img.w) / 100
  const cy = (img.y + fy * (img.h ?? 50)) / 100
  return {
    ...scene,
    background: { ...bg, radial: { cx, cy } },
  }
}

// Round `y` of text-ish blocks (title, subtitle, badge) to the nearest grid
// step. CTA / image / logo are left untouched — their placement is either
// corner-anchored (logo), full-bleed (image), or bottom-relative in a flow
// the snap would break (CTA in hero-overlay). Snap step is gutter/4 — about
// 0.25% on typical formats, plenty to align baselines but too small to nudge
// a block into overlap.
function snapToBaseline(scene: Scene, step: number): Scene {
  if (step <= 0) return scene
  const snap = (v: number) => Math.round(v / step) * step
  const out: Scene = { ...scene }
  if (scene.title) out.title = { ...scene.title, y: snap(scene.title.y) }
  if (scene.subtitle) out.subtitle = { ...scene.subtitle, y: snap(scene.subtitle.y) }
  if (scene.badge) out.badge = { ...scene.badge, y: snap(scene.badge.y) }
  return out
}

function applyBrandKit(master: Scene, brand: BrandKit): Scene {
  // Palette is the single source of truth for semantic colors. Master only
  // stores layout + content; any fill/bg baked into master is ignored here.
  // This guarantees that a palette update (e.g. from image analysis) always
  // propagates to every rendered format — no stale cached colors.
  const { palette } = brand
  // Contrast guard: if the user-chosen ink has nearly the same luminance as
  // the background they laid it on (bad manual palette, template drift after
  // image-derived recolor), flip ink to a readable tone. Layouts that place
  // text over an image override fill explicitly (e.g. hero-overlay sets
  // '#FFFFFF'), so this only catches text-on-background cases.
  const bgLum = backgroundLuminance(master.background)
  const ink = readableOn(palette.ink, bgLum, 0.45)
  const inkMuted = readableOn(palette.inkMuted, bgLum, 0.3, ink)
  const out: Scene = {
    background: master.background,
    accent: palette.accent,
  }
  if (master.decor) out.decor = master.decor
  if (master.scrim) out.scrim = master.scrim

  if (master.title) {
    const tone = TONE_DEFAULTS[brand.toneOfVoice]
    out.title = {
      ...master.title,
      fill: ink,
      weight: master.title.weight ?? tone.titleWeight,
      letterSpacing: master.title.letterSpacing ?? tone.letterSpacing,
      maxLines: master.title.maxLines ?? tone.maxLines,
      align: master.title.align ?? tone.align,
    }
  }
  if (master.subtitle) {
    out.subtitle = { ...master.subtitle, fill: inkMuted }
  }
  if (master.cta) {
    // CTA text color adapts to the actual contrast of its background so the
    // label always reads, including saturated mid-tone brand accents.
    const ctaBg = palette.accent
    const autoFill = contrastRatio('#FFFFFF', ctaBg) >= contrastRatio('#0E1014', ctaBg) ? '#FFFFFF' : '#0E1014'
    out.cta = {
      ...master.cta,
      bg: ctaBg,
      fill: autoFill,
      rx: ctaRadius(brand.ctaStyle),
    }
  }
  if (master.badge) {
    out.badge = { ...master.badge, fill: palette.accent }
  }
  if (master.logo) out.logo = { ...master.logo }
  if (master.image) out.image = { ...master.image }

  return out
}

function compactObjectFields(scene: Scene, rules: FormatRuleSet): Scene {
  const out: Scene = { ...scene }
  if (scene.title) out.title = compactTextField(scene.title, rules, 'title')
  if (scene.subtitle) out.subtitle = compactTextField(scene.subtitle, rules, 'subtitle')
  if (scene.badge) out.badge = compactBadgeField(scene.badge, rules)
  if (scene.cta) out.cta = compactCtaField(scene.cta, rules)
  return out
}

function compactTextField<T extends TextBlock>(block: T, rules: FormatRuleSet, kind: 'title' | 'subtitle'): T {
  const plain = plainRenderedText(block)
  if (!plain) return block
  const currentWpx = pctToPx(block.w, rules.width)
  if (currentWpx <= 0) return block
  const fontFamily = block.fontFamily ?? 'Inter, system-ui, sans-serif'
  const fitMode = block.fitMode ?? 'auto'
  const wrapMaxLines = fitMode === 'overflow' ? 99 : block.maxLines
  const fontSizePx = renderedTextFontSizePx(block, plain, currentWpx, wrapMaxLines, fontFamily, rules.width)
  const overflow = fitMode === 'clamp' || fitMode === 'overflow' ? 'clip' : 'ellipsis'
  const lines = wrapText({
    text: plain,
    fontSizePx,
    fontWeight: block.weight,
    fontFamily,
    maxWidthPx: currentWpx,
    maxLines: wrapMaxLines,
    overflow,
  })
  const renderedLines = lines.length > 0 ? lines : [plain]
  const letterSpacingPx = fontSizePx * (block.letterSpacing ?? 0)
  const maxLineWidthPx = Math.max(
    1,
    ...renderedLines.map((line) => measureTextWidth(line, fontSizePx, block.weight, fontFamily) + letterSpacingPx * line.length),
  )
  const padX = Math.max(2, fontSizePx * (kind === 'title' ? 0.08 : 0.1))
  const padY = Math.max(2, fontSizePx * 0.08)
  const minWpx = Math.max(18, fontSizePx * 1.6)
  const targetWpx = Math.min(currentWpx, Math.max(minWpx, maxLineWidthPx + padX * 2))
  const lineHeightPx = fontSizePx * (block.lineHeight ?? 1.12)
  const targetHpx = Math.max(fontSizePx, lineHeightPx * renderedLines.length + padY * 2)
  if (fitMode === 'auto') {
    return {
      ...block,
      h: roundField(pxToHeightPct(targetHpx, rules)),
    }
  }
  const targetW = pxToWidthPct(targetWpx, rules)
  const targetH = pxToHeightPct(targetHpx, rules)
  const x = anchorCompactedX(block.x, block.w, targetW, block.align ?? 'left')
  return {
    ...block,
    x,
    w: roundField(targetW),
    h: roundField(targetH),
    maxLines: fitMode === 'overflow' ? block.maxLines : Math.max(1, Math.min(block.maxLines, renderedLines.length)),
  }
}

function compactBadgeField<T extends TextBlock>(block: T, rules: FormatRuleSet): T {
  const text = plainRenderedText({ ...block, transform: block.transform ?? 'uppercase' })
  if (!text) return block
  const fontFamily = block.fontFamily ?? 'Inter, system-ui, sans-serif'
  const fontSizePx = resolveFontSizePx(block.fontSize, rules.width)
  const letterSpacingPx = fontSizePx * (block.letterSpacing ?? 0)
  const baseTextWidth = measureTextWidth(text, fontSizePx, block.weight, fontFamily)
  const trackedTextWidth = (baseTextWidth + letterSpacingPx * text.length) * 1.02
  const padX = fontSizePx * 0.85
  const padY = fontSizePx * 0.4
  const targetW = pxToWidthPct(trackedTextWidth + padX * 2, rules)
  const targetH = pxToHeightPct(fontSizePx + padY * 2, rules)
  return {
    ...block,
    w: roundField(Math.min(block.w, Math.max(pxToWidthPct(18, rules), targetW))),
    h: roundField(targetH),
  }
}

function compactCtaField<T extends TextBlock & { bg: string; rx: number }>(block: T, rules: FormatRuleSet): T {
  const label = plainRenderedText(block)
  if (!label) return block
  if ((block.fitMode ?? 'auto') === 'auto') return block
  const currentWpx = pctToPx(block.w, rules.width)
  const currentHpx = pctToPx(block.h ?? 0, rules.height)
  const fontFamily = block.fontFamily ?? 'Inter, system-ui, sans-serif'
  const fontSizePx = resolveFontSizePx(block.fontSize, rules.width)
  const letterSpacingPx = fontSizePx * (block.letterSpacing ?? 0)
  const labelWidthPx = measureTextWidth(label, fontSizePx, block.weight, fontFamily) + letterSpacingPx * label.length
  const minWidthPx = isCompactAdRules(rules) ? 96 : Math.max(72, fontSizePx * 4)
  const targetWpx = Math.max(minWidthPx, labelWidthPx / 0.82, labelWidthPx + fontSizePx * 2.4)
  const targetHpx = Math.max(isCompactAdRules(rules) ? 34 : 36, fontSizePx * 2.35)
  const nextWpx = currentWpx > 0 ? Math.min(currentWpx, targetWpx) : targetWpx
  const nextHpx = currentHpx > 1 ? Math.min(currentHpx, targetHpx) : targetHpx
  const targetW = pxToWidthPct(nextWpx, rules)
  const targetH = pxToHeightPct(nextHpx, rules)
  return {
    ...block,
    x: anchorCtaX(block.x, block.w, targetW),
    w: roundField(targetW),
    h: roundField(targetH),
    maxLines: 1,
  }
}

function renderedTextFontSizePx(
  block: TextBlock,
  text: string,
  maxWidthPx: number,
  maxLines: number,
  fontFamily: string,
  frameWidth: number,
): number {
  const basePx = resolveFontSizePx(block.fontSize, frameWidth)
  if ((block.fitMode ?? 'auto') !== 'auto') return basePx
  return fitFontSizePx({
    baseFontSizePx: basePx,
    minFontSizePx: Math.max(8, basePx * 0.62),
    fits: (fontSizePx) => {
      const lines = wrapText({
        text,
        fontSizePx,
        fontWeight: block.weight,
        fontFamily,
        maxWidthPx: maxWidthPx * 0.96,
        maxLines,
        overflow: 'ellipsis',
      })
      return !lines.some((line) => line.includes('...') || line.includes('…') || line.includes('вЂ¦'))
    },
  })
}

function plainRenderedText(block: Pick<TextBlock, 'text' | 'transform'>): string {
  const raw = block.text.replace(/\*\*/g, '').trim()
  if (block.transform === 'uppercase') return raw.toLocaleUpperCase()
  if (block.transform === 'title-case') {
    return raw.replace(/\w\S*/g, (w) => (w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
  }
  if (block.transform === 'sentence-case') {
    return raw.length > 0 ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : raw
  }
  return raw
}

function resolveFontSizePx(fontSize: number, frameWidth: number): number {
  if (!Number.isFinite(fontSize) || fontSize <= 0) return 0
  return fontSize <= 100 ? (fontSize / 100) * frameWidth : fontSize
}

function pctToPx(value: number, total: number): number {
  return (value / 100) * total
}

function pxToWidthPct(value: number, rules: FormatRuleSet): number {
  return (value / rules.width) * 100
}

function pxToHeightPct(value: number, rules: FormatRuleSet): number {
  return (value / rules.height) * 100
}

function anchorCompactedX(x: number, oldW: number, newW: number, align: TextAlign): number {
  if (newW >= oldW) return x
  if (align === 'center') return roundField(x + (oldW - newW) / 2)
  if (align === 'right') return roundField(x + oldW - newW)
  return x
}

function anchorCtaX(x: number, oldW: number, newW: number): number {
  if (newW >= oldW) return x
  const center = x + oldW / 2
  const right = x + oldW
  if (right > 86) return roundField(right - newW)
  if (Math.abs(center - 50) < 8) return roundField(center - newW / 2)
  return x
}

function isCompactAdRules(rules: FormatRuleSet): boolean {
  return rules.width <= 320 || rules.height <= 400 || rules.aspectRatio > 4 || rules.key === 'avito-skyscraper'
}

function roundField(value: number): number {
  return Math.round(value * 100) / 100
}

function ensureReadableScene(scene: Scene, rules: FormatRuleSet, hint: AssetHint | null): Scene {
  const out: Scene = { ...scene }
  const cta = scene.cta
  if (cta) {
    const ctaFill = contrastRatio(cta.fill, cta.bg) >= 4.5
      ? cta.fill
      : pickReadableInkForLuma(luminance(cta.bg))
    out.cta = { ...cta, fill: ctaFill }
  }

  const needsScrimGuard = Boolean(scene.scrim && scene.image?.src && isOverlayLikeFormat(rules))
  let strongestTextContrast = Number.POSITIVE_INFINITY

  if (scene.title) {
    const bgLum = estimatedBlockBackgroundLuminance(scene, scene.title, hint, false)
    strongestTextContrast = Math.min(strongestTextContrast, contrastRatioFromLuminance(luminance(scene.title.fill), bgLum))
    out.title = {
      ...scene.title,
      fill: readableTextFill(scene.title.fill, bgLum, false),
    }
  }

  if (scene.subtitle) {
    const bgLum = estimatedBlockBackgroundLuminance(scene, scene.subtitle, hint, true)
    strongestTextContrast = Math.min(strongestTextContrast, contrastRatioFromLuminance(luminance(scene.subtitle.fill), bgLum))
    out.subtitle = {
      ...scene.subtitle,
      fill: readableTextFill(scene.subtitle.fill, bgLum, true),
    }
  }

  if (needsScrimGuard && scene.scrim && strongestTextContrast < 4.5) {
    out.scrim = {
      ...scene.scrim,
      opacity: Math.min(0.92, Math.max(scene.scrim.opacity, 0.78)),
    }
  }

  return out
}

function readableTextFill(current: string, bgLum: number, muted: boolean): string {
  if (contrastRatioFromLuminance(luminance(current), bgLum) >= 4.5) return current
  if (muted) {
    const candidate = bgLum > 0.5 ? '#2A2D35' : '#E6E8EC'
    if (contrastRatioFromLuminance(luminance(candidate), bgLum) >= 4.5) return candidate
  }
  return pickReadableInkForLuma(bgLum)
}

function estimatedBlockBackgroundLuminance(
  scene: Scene,
  block: { x: number; y: number; w: number; h?: number; fontSize?: number; maxLines?: number; lineHeight?: number },
  hint: AssetHint | null,
  muted: boolean,
): number {
  const fallback = hint ? (hint.isDarkBackground ? 0.18 : 0.82) : backgroundLuminance(scene.background)
  const textH = block.h ?? ((block.fontSize ?? 4) * (block.lineHeight ?? 1.2) * (block.maxLines ?? 1))
  let bgLum = backgroundLuminance(scene.background)
  if (scene.image?.src && intersects(block.x, block.y, block.w, textH, scene.image.x, scene.image.y, scene.image.w, scene.image.h ?? 100)) {
    bgLum = regionBrightness(hint?.brightnessGrid, block.x, block.y, block.w, textH, fallback)
  }
  if (scene.scrim && intersects(block.x, block.y, block.w, textH, 0, scene.scrim.y, 100, scene.scrim.h)) {
    const scrimLum = luminance(scene.scrim.color)
    const opacity = Math.min(1, Math.max(0, scene.scrim.opacity * (muted ? 0.72 : 0.82)))
    bgLum = bgLum * (1 - opacity) + scrimLum * opacity
  }
  return Math.min(1, Math.max(0, bgLum))
}

function isOverlayLikeFormat(rules: FormatRuleSet): boolean {
  return rules.aspectRatio < 0.9 || rules.key.includes('story') || rules.key.includes('fullscreen')
}

function regionBrightness(
  grid: number[][] | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: number,
): number {
  const firstRow = grid?.[0]
  if (!grid || grid.length === 0 || !firstRow || firstRow.length === 0) return fallback
  const rows = grid.length
  const cols = firstRow.length
  const x0 = Math.max(0, Math.floor((x / 100) * cols))
  const x1 = Math.min(cols - 1, Math.floor(((x + w) / 100) * cols))
  const y0 = Math.max(0, Math.floor((y / 100) * rows))
  const y1 = Math.min(rows - 1, Math.floor(((y + h) / 100) * rows))
  let sum = 0
  let count = 0
  for (let row = y0; row <= y1; row += 1) {
    for (let col = x0; col <= x1; col += 1) {
      const value = grid[row]?.[col]
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
      sum += value
      count += 1
    }
  }
  return count > 0 ? sum / count : fallback
}

function intersects(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

// Mean luminance of the background. Gradient → average of stops; solid →
// single color; tonal → base; split → average of two halves. Cheap — each
// branch is one-to-three luminance() calls.
function backgroundLuminance(bg: Background): number {
  if (bg.kind === 'solid') return luminance(bg.color)
  if (bg.kind === 'tonal') return luminance(bg.base)
  if (bg.kind === 'split') return (luminance(bg.a) + luminance(bg.b)) / 2
  // gradient
  return (luminance(bg.stops[0]) + luminance(bg.stops[1]) + luminance(bg.stops[2])) / 3
}

// If `color`'s luminance is within `minGap` of `bgLum`, return a near-white or
// near-black replacement (whichever makes the gap widest). Otherwise return
// the color unchanged. When `muted` is provided and flipping is needed, the
// replacement is a less-saturated ink so subtitle doesn't become as loud as
// title. `muted` lets us chain: readableOn(inkMuted, bg, gap, ink) keeps the
// muted flip coordinated with the ink flip direction.
function readableOn(color: string, bgLum: number, minGap: number, muted?: string): string {
  const cLum = luminance(color)
  if (Math.abs(cLum - bgLum) >= minGap) return color
  // Flip: bg is light → text goes dark; bg is dark → text goes light.
  if (muted) {
    // muted tone follows the chosen ink direction but at 80% luminance gap
    return bgLum > 0.5 ? '#2A2D35' : '#E6E8EC'
  }
  return bgLum > 0.5 ? '#0E1014' : '#FFFFFF'
}

function ctaRadius(style: BrandKit['ctaStyle']): number {
  if (style === 'pill') return 999
  if (style === 'rounded') return 14
  return 0
}

function clampToFrame(scene: Scene, sz: { top: number; right: number; bottom: number; left: number }): Scene {
  const out: Scene = { background: scene.background, accent: scene.accent }
  if (scene.scrim) out.scrim = scene.scrim
  if (scene.decor) out.decor = scene.decor
  const maxX = 100 - sz.right
  const maxY = 100 - sz.bottom
  const minX = sz.left
  const minY = sz.top

  for (const k of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const b = scene[k]
    if (!b) continue
    // image is allowed to bleed past safe zone (full-bleed hero, top-bleed stacked)
    if (k === 'image') {
      ;(out as Record<string, unknown>)[k] = { ...b }
      continue
    }
    const h = b.h !== undefined ? Math.max(0, Math.min(b.h, maxY - minY)) : b.h
    const x = Math.max(minX, Math.min(maxX, b.x))
    const yMax = h !== undefined ? Math.max(minY, maxY - h) : maxY
    const y = Math.max(minY, Math.min(yMax, b.y))
    const w = Math.max(0, Math.min(b.w, maxX - x))
    ;(out as Record<string, unknown>)[k] = { ...b, x, y, w, ...(h !== undefined ? { h } : {}) }
  }
  return out
}
