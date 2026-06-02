// The single deterministic pipeline for producing a per-format Scene
// from (master scene + format key + brand kit + enabled map).
// No randomness. No side effects.

import { contrastRatio, contrastRatioFromLuminance, luminance, pickReadableInkForLuma } from './color'
import { LAYOUTS, chooseLayoutArchetype } from './composition'
import { safeAreaToPercentEdges, visibleAreaToPercentRect } from './formatGeometry'
import { getFormat } from './formats'
import { normalizeGroupLayout } from './groupLayout'
import { applyLayoutDensity } from './layoutDensity'
import { applyStyleSettingsToScene } from './styleSettings'
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
  TypographySettings,
  CompositionSettings,
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
  typographySettings?: TypographySettings
  compositionSettings?: CompositionSettings
  locale?: string
  customFormats?: FormatRuleSet[]
}

const TONE_DEFAULTS: Record<BrandKit['toneOfVoice'], { titleWeight: number; letterSpacing: number; maxLines: number; align: TextAlign }> = {
  neutral: { titleWeight: 700, letterSpacing: 0, maxLines: 3, align: 'left' },
  bold: { titleWeight: 900, letterSpacing: -0.02, maxLines: 2, align: 'left' },
  friendly: { titleWeight: 600, letterSpacing: 0, maxLines: 3, align: 'left' },
  minimal: { titleWeight: 400, letterSpacing: 0.01, maxLines: 2, align: 'left' },
  editorial: { titleWeight: 800, letterSpacing: -0.03, maxLines: 2, align: 'center' },
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
  return pickCompositionModel(branded, rules, enabled, options.override, options.assetHint)
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
  return pickCompositionSelection(branded, rules, enabled, options.override, options.assetHint)
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

  // 2. profile content + choose layout (or honour override)
  const selection = pickCompositionSelection(branded, rules, enabled, options.override, options.assetHint)
  const model = selection.selectedArchetype

  // 3. compute positioned scene
  const generated = LAYOUTS[model](branded, rules, enabled, options.assetHint ?? null)

  // 3b. apply global style controls from the wizard. These are intentionally
  // downstream of the layout archetype so the user can tune the visual system
  // without pinning every format to hand-authored geometry.
  const positioned = applyStyleSettingsToScene(generated, rules, options.typographySettings, options.compositionSettings)

  // 4. focal-aware background: when an image with non-default focal is placed,
  //    retarget a gradient background to radiate from the subject. Linear
  //    gradients stay linear when image is absent or focal is dead-centre.
  const focalAware = applyFocalGradient(positioned)

  // 5. snap text blocks to a quarter-gutter baseline so stacks line up visually
  //    across formats without anyone having to hand-tune y values.
  const snapped = snapToBaseline(focalAware, rules.gutter / 4)

  // 6. apply locale-specific text if present.
  const localized = applyLocale(snapped, options.locale)
  const localizedContent = applyLocale(branded, options.locale)
  const groupSource: Scene = {
    ...localized,
    title: localized.title ?? localizedContent.title,
    subtitle: localized.subtitle ?? localizedContent.subtitle,
    cta: localized.cta ?? localizedContent.cta,
    badge: localized.badge ?? localizedContent.badge,
    logo: localized.logo ?? localizedContent.logo,
    image: localized.image ?? (model === 'text-dominant' ? undefined : localizedContent.image),
  }

  // 7. clamp anything outside safe zone (defensive — does not move blocks, only shrinks widths)
  const grouped = normalizeGroupLayout(groupSource, rules, enabled)
  const clamped = clampToFrame(grouped, effectiveSafeZone(rules))

  // 8. Generated CTA geometry follows the label before user overrides apply.
  const ctaSized = clamped

  // 9. apply explicit per-format geometry overrides copied from another format.
  const overridden = applyBlockOverrides(ctaSized, options.blockOverrides)

  // 10. Clamp again because manual per-format overrides can move fixed-size
  // blocks (especially CTAs) past the safe-zone after the generated layout
  // was already clamped.
  const reclamped = clampToFrame(overridden, effectiveSafeZone(rules))

  // 11. final readability guard. This is intentionally small and deterministic:
  // layout stays untouched; only text fills and existing scrim opacity can move.
  return ensureReadableScene(reclamped, rules, options.assetHint ?? null)
}

function effectiveSafeZone(rules: FormatRuleSet): FormatRuleSet['safeZone'] {
  const safe = rules.safeArea ? safeAreaToPercentEdges(rules.safeArea, rules.width, rules.height) : rules.safeZone
  const visible = visibleAreaToPercentRect(rules)
  const base = visible
    ? {
        top: Math.max(safe.top, visible.y),
        right: Math.max(safe.right, 100 - (visible.x + visible.w)),
        bottom: Math.max(safe.bottom, 100 - (visible.y + visible.h)),
        left: Math.max(safe.left, visible.x),
      }
    : safe
  const pad = rules.requiredPadding ? (rules.requiredPadding / Math.min(rules.width, rules.height)) * 100 : 0
  return {
    top: base.top + pad,
    right: base.right + pad,
    bottom: base.bottom + pad,
    left: base.left + pad,
  }
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

function applyBlockOverrides(scene: Scene, overrides?: Partial<Record<BlockKind, BlockOverride>>): Scene {
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
    const b = out[k]
    if (!b) continue
    ;(out as Record<string, unknown>)[k] = { ...b, ...dropUndefined(stripPresentationOnly(o)) }
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
  if (muted) return bgLum > 0.5 ? '#2A2D35' : '#E6E8EC'
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
    const desiredW = Math.min(b.w, maxX - minX)
    const desiredH = b.h !== undefined ? Math.min(b.h, maxY - minY) : b.h
    const x = Math.max(minX, Math.min(maxX - desiredW, b.x))
    const y = desiredH !== undefined
      ? Math.max(minY, Math.min(maxY - desiredH, b.y))
      : Math.max(minY, Math.min(maxY, b.y))
    const w = desiredW
    const h = desiredH
    ;(out as Record<string, unknown>)[k] = { ...b, x, y, w, h }
  }
  return out
}
