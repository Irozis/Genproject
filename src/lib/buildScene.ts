// The single deterministic pipeline for producing a per-format Scene
// from (master scene + format key + brand kit + enabled map).
// No randomness. No side effects.

import { luminance } from './color'
import { LAYOUTS, chooseModel, profile } from './composition'
import { getFormat } from './formats'
import { applyLayoutDensity } from './layoutDensity'
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
} from './types'

export type BuildOptions = {
  /** Force a specific composition model for this build. Overrides the profile
   *  chooser. Templates' preferredModels + user formatOverrides land here. */
  override?: CompositionModel
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
  bold: { titleWeight: 900, letterSpacing: -0.02, maxLines: 2, align: 'left' },
  friendly: { titleWeight: 600, letterSpacing: 0, maxLines: 3, align: 'left' },
  minimal: { titleWeight: 400, letterSpacing: 0.01, maxLines: 2, align: 'left' },
  editorial: { titleWeight: 800, letterSpacing: -0.03, maxLines: 2, align: 'center' },
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
  const model: CompositionModel = options.override ?? chooseModel(profile(branded, rules, enabled))

  // 3. compute positioned scene
  const positioned = LAYOUTS[model](branded, rules, enabled, options.assetHint ?? null)

  // 4. focal-aware background: when an image with non-default focal is placed,
  //    retarget a gradient background to radiate from the subject. Linear
  //    gradients stay linear when image is absent or focal is dead-centre.
  const focalAware = applyFocalGradient(positioned)

  // 5. snap text blocks to a quarter-gutter baseline so stacks line up visually
  //    across formats without anyone having to hand-tune y values.
  const snapped = snapToBaseline(focalAware, rules.gutter / 4)

  // 6. apply locale-specific text if present.
  const localized = applyLocale(snapped, options.locale)

  // 7. clamp anything outside safe zone (defensive — does not move blocks, only shrinks widths)
  const clamped = clampToFrame(localized, rules.safeZone)

  // 8. apply explicit per-format geometry overrides copied from another format.
  return applyBlockOverrides(clamped, options.blockOverrides)
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
    const b = out[k]
    if (!o || !b) continue
    ;(out as Record<string, unknown>)[k] = { ...b, ...dropUndefined(o) }
  }
  return out
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
      fill: master.title.fill ?? ink,
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
    // CTA text color adapts to the luminance of its background so the label
    // always reads. Dark accent → white text; light accent → near-black.
    const ctaBg = palette.accent
    const autoFill = luminance(ctaBg) < 0.5 ? '#FFFFFF' : '#0E1014'
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
    const x = Math.max(minX, Math.min(maxX, b.x))
    const y = Math.max(minY, Math.min(maxY, b.y))
    const w = Math.min(b.w, maxX - x)
    const h = b.h !== undefined ? Math.min(b.h, maxY - y) : b.h
    ;(out as Record<string, unknown>)[k] = { ...b, x, y, w, h }
  }
  return out
}
