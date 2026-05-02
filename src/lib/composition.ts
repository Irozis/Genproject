// Four deterministic composition models. No randomization.
// Each function takes (master scene, format rules) and returns positioned blocks
// in % units. The chooser is also deterministic — same inputs → same output.

import type {
  AssetHint,
  CompositionModel,
  EnabledMap,
  FormatKey,
  FormatRuleSet,
  Scene,
  TextBlock,
} from './types'
import { fitFontSize as fitFontSizePx, wrapText } from './textMeasure'

export type ContentProfile = {
  hasImage: boolean
  imageIsLarge: boolean       // master.image && image.w >= 30%
  isPortrait: boolean         // aspectRatio < 0.85
  isWide: boolean             // aspectRatio > 2
}

export function profile(scene: Scene, rules: FormatRuleSet, enabled: EnabledMap): ContentProfile {
  const hasImage = enabled.image && !!scene.image && !!scene.image.src
  const imageIsLarge = hasImage && (scene.image?.w ?? 0) >= 30
  // Portrait starts below ~4:5. 1080x1350 and 1080x1920 both count; 1:1 does not.
  const isPortrait = rules.aspectRatio < 0.9
  // "Horizontal" for split layout. Real-world ad banners are often only mildly wide.
  const isWide = rules.aspectRatio > 1.1
  return { hasImage, imageIsLarge, isPortrait, isWide }
}

export function chooseModel(p: ContentProfile): CompositionModel {
  // Strict, explicit decision tree. No scoring, no fallback chain.
  if (!p.hasImage) return 'text-dominant'
  // Horizontal formats read best as text column + media column.
  if (p.isWide) return 'split-right-image'
  // Portrait formats keep image-first storytelling, then text stack.
  if (p.isPortrait) return 'image-top-text-bottom'
  // Square / near-square formats use text overlay with a protective scrim.
  if (p.imageIsLarge) return 'hero-overlay'
  return 'hero-overlay'
}

// ---------------------------------------------------------------------------
// Typography tokens — consistent across all layouts
// ---------------------------------------------------------------------------

const TITLE_TOKENS = { letterSpacing: -0.02, lineHeight: 1.02, weight: 900 }
const SUBTITLE_TOKENS = { letterSpacing: 0, lineHeight: 1.35, weight: 400, opacity: 0.72 }
const BADGE_TOKENS = { letterSpacing: 0.1, lineHeight: 1.0, weight: 700 }
const CTA_TOKENS = { letterSpacing: 0.02, lineHeight: 1.0, weight: 700 }

// Per-platform "bottom of the CTA" anchor for story-style formats. Each value
// is the maximum y (% of canvas height) where the CTA's bottom edge can sit,
// accounting for the platform's reactive overlay UI (IG "Send message", VK/TG
// reactions, Avito feed strip). Keeps the CTA inside the thumb-zone instead
// of letting it drift down to the safeZone bottom edge.
const STORY_CTA_BOTTOM: Partial<Record<FormatKey, number>> = {
  'instagram-story': 86,
  'vk-stories': 87,
  'telegram-story': 87,
  'avito-fullscreen': 87,
}

function apply<T extends TextBlock>(block: T, tokens: Partial<TextBlock>): T {
  return { ...block, ...tokens }
}

// Head-to-core scaffolding: compute the y-positions by stacking with gutter rhythm.
function rhythm(rules: FormatRuleSet) {
  const g = rules.gutter
  return {
    g,
    // slots in % of height — rough heuristic, tuned against safeZone
    titleY: rules.safeZone.top + g * 3,
    afterTitleGap: g * 0.75,
    beforeCtaGap: g * 1.5,
    ctaY: 100 - rules.safeZone.bottom - g * 2,
  }
}

// Deterministic estimate of how many lines `text` actually occupies when laid
// out inside `widthPct` at `fontSizePct`. Uses a linear char-width heuristic
// (0.55 × fontSize per char). Same inputs → same output; no canvas.
function estimateLines(text: string, fontSizePct: number, widthPct: number, maxLines: number): number {
  if (!text || widthPct <= 0 || fontSizePct <= 0) return 1
  const capacity = Math.max(1, Math.floor(widthPct / (fontSizePct * 0.55)))
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1
  let lines = 1
  let used = 0
  for (const w of words) {
    const need = used === 0 ? w.length : used + 1 + w.length
    if (need > capacity) {
      lines += 1
      used = w.length
      if (lines >= maxLines) return maxLines
    } else {
      used = need
    }
  }
  return Math.min(maxLines, Math.max(1, lines))
}

// Height of a text block in % of width, given actual line count.
function textBlockHeight(fontSizePct: number, lines: number, lineHeight: number, rules: FormatRuleSet): number {
  return fontSizePct * lines * lineHeight * rules.aspectRatio
}

function measuredLines(
  text: string,
  fontSizePct: number,
  widthPct: number,
  maxLines: number,
  rules: FormatRuleSet,
  weight: number | undefined,
): number {
  const lines = wrapText({
    text,
    fontSizePx: (fontSizePct / 100) * rules.width,
    fontWeight: weight ?? 400,
    fontFamily: 'Inter, system-ui, sans-serif',
    maxWidthPx: (widthPct / 100) * rules.width,
    maxLines,
  })
  return Math.max(1, lines.length, estimateLines(text, fontSizePct, widthPct, maxLines))
}

// Step a font size down from `base` (in %) toward `min` until the text wraps
// to no more than `targetLines`. Deterministic — no search, no randomness,
// just a linear walk in 0.2 increments. When even `min` doesn't fit, the
// wrap/maxLines machinery will truncate with ellipsis. Used for both titles
// and subtitles so any single-line block that grows can auto-shrink rather
// than clip or overflow.
export function fitFontSize(
  text: string,
  widthPct: number,
  targetLines: number,
  base: number,
  min: number,
): number {
  if (!text || widthPct <= 0) return base
  let size = base
  while (size > min + 0.0001) {
    const lines = estimateLines(text, size, widthPct, targetLines + 1)
    if (lines <= targetLines) return size
    size = Math.max(min, size - 0.2)
  }
  return min
}

// Backwards-compat alias — keep in case serialization or external callers
// reference the older name. Title is just the most common caller.
export const fitTitleFontSize = fitFontSize

// Min font size for subtitle text (% of width). Anything below ≈2% becomes
// unreadable at thumbnail scale, so we clamp here instead of shrinking forever.
const MIN_SUBTITLE_SIZE = 2.0

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function capFontSize(block: TextBlock | undefined, fittedSize: number): number {
  if (block?.fontSize === undefined) return fittedSize
  return (block.fitMode ?? 'auto') === 'auto' ? Math.min(block.fontSize, fittedSize) : block.fontSize
}

function maxLinesFor(block: TextBlock | undefined, fallback: number, cap = fallback): number {
  return Math.max(1, Math.min(block?.maxLines ?? fallback, cap))
}

function pxToHeightPct(px: number, rules: FormatRuleSet): number {
  if (rules.height <= 0) return 0
  return (px / rules.height) * 100
}

function pxToWidthPct(px: number, rules: FormatRuleSet): number {
  if (rules.width <= 0) return 0
  return (px / rules.width) * 100
}

function readableCtaFont(block: TextBlock | undefined, base: number, rules: FormatRuleSet): number {
  const minPx = rules.width <= 320 || rules.key === 'avito-skyscraper' ? 11 : rules.aspectRatio > 4 ? 10 : 12
  return Math.max(capFontSize(block, base), pxToWidthPct(minPx, rules))
}

function readableSubtitleFont(block: TextBlock | undefined, base: number, rules: FormatRuleSet): number {
  const minPx = rules.width <= 320 ? 8 : rules.aspectRatio > 4 ? 9 : 12
  return Math.max(capFontSize(block, base), pxToWidthPct(minPx, rules))
}

function readableCtaHeight(basePct: number, rules: FormatRuleSet): number {
  const minPx = rules.width <= 320 ? 34 : rules.aspectRatio > 4 ? 32 : 44
  return Math.max(basePct, pxToHeightPct(minPx, rules))
}

// Resolve the format's typescale multiplier. Default 1.0 when a format doesn't
// override — keeps square formats as-is. Clamped to [0.8, 1.4] so a typo in
// the rules file can't blow up text sizing.
function tscale(rules: FormatRuleSet): number {
  return clamp(rules.typescaleBoost ?? 1.0, 0.8, 1.4)
}

// Mean luminance of the rectangle (x, y, w, h) in % coordinates, looked up
// from the image's coarse brightness grid. Falls back to `fallback` when the
// hint has no grid. Clamps bbox into 0..100 first so out-of-frame requests
// return sane values. O(cells in grid) — cheap.
function regionBrightness(
  grid: number[][] | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: number,
): number {
  if (!grid || grid.length === 0) return fallback
  const n = grid.length
  const left = Math.max(0, Math.min(100, x))
  const right = Math.max(0, Math.min(100, x + w))
  const top = Math.max(0, Math.min(100, y))
  const bottom = Math.max(0, Math.min(100, y + h))
  if (right <= left || bottom <= top) return fallback
  const col0 = Math.max(0, Math.min(n - 1, Math.floor((left / 100) * n)))
  const col1 = Math.max(0, Math.min(n - 1, Math.floor(((right - 0.01) / 100) * n)))
  const row0 = Math.max(0, Math.min(n - 1, Math.floor((top / 100) * n)))
  const row1 = Math.max(0, Math.min(n - 1, Math.floor(((bottom - 0.01) / 100) * n)))
  let sum = 0
  let count = 0
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) {
      sum += grid[r]?.[c] ?? fallback
      count += 1
    }
  }
  return count === 0 ? fallback : sum / count
}

// Map region brightness → halo params. White text on a bright patch (>= 0.5
// luminance) needs a visible dark halo; on a dark patch it's redundant.
// Tuned to be subtle (low opacity) so it never reads as a glow.
function haloForBrightness(brightness: number): { color: string; opacity: number; blurPx: number } | undefined {
  if (brightness < 0.42) return undefined
  // 0.42 → 0, 0.85 → 0.55 (capped)
  const opacity = clamp((brightness - 0.42) * 1.3, 0, 0.55)
  if (opacity <= 0.05) return undefined
  return { color: '#000000', opacity, blurPx: 1.2 }
}

// Subject-mass proxy: variability of brightness inside the bbox. A uniform
// patch (sky, snow, solid background) returns ≈0; a busy patch with bright
// and dark cells alternating (faces, products, edges of subjects) returns
// closer to 0.4-0.7. We blend the brightness range with the mean absolute
// deviation so a patch that's mostly mid-grey but has one outlier still
// scores higher than a uniform patch. Used by layoutHeroOverlay to decide
// whether the natural bottom-anchor would land on a subject.
function regionContrast(
  grid: number[][] | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: number,
): number {
  if (!grid || grid.length === 0) return fallback
  const n = grid.length
  const left = Math.max(0, Math.min(100, x))
  const right = Math.max(0, Math.min(100, x + w))
  const top = Math.max(0, Math.min(100, y))
  const bottom = Math.max(0, Math.min(100, y + h))
  if (right <= left || bottom <= top) return fallback
  const col0 = Math.max(0, Math.min(n - 1, Math.floor((left / 100) * n)))
  const col1 = Math.max(0, Math.min(n - 1, Math.floor(((right - 0.01) / 100) * n)))
  const row0 = Math.max(0, Math.min(n - 1, Math.floor((top / 100) * n)))
  const row1 = Math.max(0, Math.min(n - 1, Math.floor(((bottom - 0.01) / 100) * n)))
  let min = 1
  let max = 0
  let sum = 0
  let count = 0
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) {
      const v = grid[r]?.[c] ?? fallback
      if (v < min) min = v
      if (v > max) max = v
      sum += v
      count += 1
    }
  }
  if (count === 0) return fallback
  const mean = sum / count
  let mad = 0
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) {
      const v = grid[r]?.[c] ?? fallback
      mad += Math.abs(v - mean)
    }
  }
  mad /= count
  const range = max - min
  return clamp(range * 0.6 + mad * 1.4, 0, 1)
}

// ---------------------------------------------------------------------------
// Each layout returns a Scene with all positioned blocks.
// ---------------------------------------------------------------------------

type Layout = (
  scene: Scene,
  rules: FormatRuleSet,
  enabled: EnabledMap,
  hint?: AssetHint | null,
) => Scene

const layoutTextDominant: Layout = (scene, rules, enabled) => {
  const sz = rules.safeZone
  const innerW = 100 - sz.left - sz.right
  const left = sz.left
  const r = rhythm(rules)

  const out: Scene = {
    background: scene.background,
    accent: scene.accent,
  }

  if (enabled.badge && scene.badge) {
    out.badge = apply(
      { ...scene.badge, x: left, y: sz.top, w: 30, fontSize: 2.2 },
      BADGE_TOKENS,
    )
  }

  const ts = tscale(rules)
  const baseTitle = (rules.aspectRatio < 0.7 ? 8 : 7) * ts
  const targetLines = maxLinesFor(scene.title, Math.min(2, rules.maxTitleLines), rules.maxTitleLines)
  const titleFontSize = scene.title
    ? fitFontSize(scene.title.text, innerW, targetLines, baseTitle, rules.minTitleSize)
    : baseTitle
  const actualTitleFontSize = capFontSize(scene.title, titleFontSize)
  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: r.titleY,
        w: innerW,
        fontSize: actualTitleFontSize,
        maxLines: targetLines,
      },
      TITLE_TOKENS,
    )
  }

  if (enabled.subtitle && scene.subtitle) {
    const titleLines = scene.title
      ? measuredLines(scene.title.text, actualTitleFontSize, innerW, targetLines, rules, TITLE_TOKENS.weight)
      : 1
    const titleH = textBlockHeight(actualTitleFontSize, titleLines, 1.02, rules)
    const subW = innerW * 0.85
    const subFont = fitFontSize(scene.subtitle.text, subW, 2, 3.2 * ts, MIN_SUBTITLE_SIZE)
    const actualSubFont = capFontSize(scene.subtitle, subFont)
    out.subtitle = apply(
      {
        ...scene.subtitle,
        x: left,
        y: r.titleY + titleH + r.afterTitleGap,
        w: subW,
        fontSize: actualSubFont,
      },
      SUBTITLE_TOKENS,
    )
  }

  if (enabled.cta && scene.cta) {
    const ctaFont = readableCtaFont(scene.cta, 2.6, rules)
    const ctaH = readableCtaHeight(7, rules)
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: Math.min(r.ctaY - ctaH * 0.5, 100 - sz.bottom - ctaH),
      w: 32,
      h: ctaH,
      fontSize: ctaFont,
    }
  }

  if (enabled.logo && scene.logo) {
    out.logo = {
      ...scene.logo,
      x: 100 - sz.right - 6,
      y: sz.top,
      w: 6,
      h: 6,
    }
  }

  return out
}

// 58% text column on left, 42% image column on right.
const layoutSplitRightImage: Layout = (scene, rules, enabled) => {
  if (rules.aspectRatio > 4) return layoutUltraWideBanner(scene, rules, enabled)
  if (rules.key === 'yandex-rsy-300x250') return layoutCompactBanner(scene, rules, enabled)

  const sz = rules.safeZone
  const left = sz.left
  const isAvito = rules.key === 'avito-listing' || rules.key === 'avito-fullscreen' || rules.key === 'avito-skyscraper'
  const imageGap = 2
  const splitX = 58
  const baseTextW = splitX - sz.left - imageGap
  const textW = rules.aspectRatio > 1 ? Math.max(50, baseTextW) : baseTextW
  const imageX = left + textW + imageGap

  const out: Scene = {
    background: scene.background,
    accent: scene.accent,
  }

  if (enabled.image && scene.image) {
    out.image = {
      ...scene.image,
      x: imageX,
      y: sz.top,
      w: 100 - sz.right - imageX,
      h: 100 - sz.top - sz.bottom,
      rx: scene.image.rx ?? 16,
      fit: isAvito ? 'contain' : (scene.image.fit ?? 'cover'),
    }
  }

  if (enabled.badge && scene.badge) {
    out.badge = apply(
      { ...scene.badge, x: left, y: sz.top, w: 24, fontSize: 2.2 },
      BADGE_TOKENS,
    )
  }

  const ts = tscale(rules)
  const baseSplitTitle = 6.5 * ts
  const splitTarget = maxLinesFor(scene.title, Math.min(3, rules.maxTitleLines), Math.min(rules.maxTitleLines, 4))
  const baseSplitTitlePx = (baseSplitTitle / 100) * rules.width
  const minTitlePx = 14
  const titleFontSize = scene.title
    ? (fitFontSizePx({
        baseFontSizePx: baseSplitTitlePx,
        minFontSizePx: minTitlePx,
        fits: (fontSizePx) => {
          const lines = wrapText({
            text: scene.title?.text ?? '',
            fontSizePx,
            fontWeight: TITLE_TOKENS.weight,
            fontFamily: 'Inter, system-ui, sans-serif',
            maxWidthPx: (textW / 100) * rules.width,
            maxLines: splitTarget,
          })
          return lines.length <= splitTarget
        },
      }) /
        rules.width) *
      100
    : baseSplitTitle
  const actualTitleFontSize = capFontSize(scene.title, titleFontSize)
  const titleLines = scene.title
    ? measuredLines(scene.title.text, actualTitleFontSize, textW, splitTarget, rules, TITLE_TOKENS.weight)
    : 0
  const titleH = titleLines ? textBlockHeight(actualTitleFontSize, titleLines, 1.02, rules) : 0
  const hasSubtitle = enabled.subtitle && !!scene.subtitle
  const titleSubtitleGap = hasSubtitle ? Math.max(pxToHeightPct(12, rules), rules.gutter) : 0
  const subW = textW * 0.95
  const subFont = scene.subtitle ? fitFontSize(scene.subtitle.text, subW, 3, 2.8 * ts, MIN_SUBTITLE_SIZE) : 0
  const actualSubFont = capFontSize(scene.subtitle, subFont)
  const subtitleLines = scene.subtitle
    ? measuredLines(scene.subtitle.text, actualSubFont, subW, 3, rules, SUBTITLE_TOKENS.weight)
    : 0
  const subtitleH = hasSubtitle && subtitleLines ? textBlockHeight(actualSubFont, subtitleLines, 1.35, rules) : 0
  const hasCta = enabled.cta && !!scene.cta
  const subtitleCtaGap = hasCta ? Math.max(pxToHeightPct(16, rules), rules.gutter * 1.05) : 0
  const ctaTextW = Math.max(24, textW * 0.62)
  const actualCtaFont = readableCtaFont(scene.cta, 2.6, rules)
  const ctaLines = scene.cta ? measuredLines(scene.cta.text, actualCtaFont, ctaTextW, 2, rules, CTA_TOKENS.weight) : 0
  const ctaTextH = hasCta ? textBlockHeight(actualCtaFont, ctaLines || 1, 1.0, rules) : 0
  const ctaPadV = hasCta ? Math.max(pxToHeightPct(20, rules), rules.gutter * 0.9) : 0
  const ctaH = hasCta ? Math.max(readableCtaHeight(0, rules), ctaTextH + ctaPadV) : 0
  const stackH = titleH + titleSubtitleGap + subtitleH + subtitleCtaGap + ctaH
  const preferredTop = (100 - stackH) / 2
  const minTop = sz.top + (enabled.badge && scene.badge ? rules.gutter * 3.1 : rules.gutter * 1.4)
  const titleY = clamp(preferredTop, minTop, 100 - sz.bottom - stackH)

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: titleY,
        w: textW,
        fontSize: actualTitleFontSize,
        maxLines: splitTarget,
      },
      TITLE_TOKENS,
    )
  }

  if (hasSubtitle && scene.subtitle) {
    out.subtitle = apply(
      {
        ...scene.subtitle,
        x: left,
        y: titleY + titleH + titleSubtitleGap,
        w: subW,
        fontSize: actualSubFont,
      },
      SUBTITLE_TOKENS,
    )

    if (hasCta && scene.cta) {
      out.cta = {
        ...scene.cta,
        ...CTA_TOKENS,
        x: left,
        y: titleY + titleH + titleSubtitleGap + subtitleH + subtitleCtaGap,
        w: ctaTextW,
        h: ctaH,
        fontSize: actualCtaFont,
      }
    }
  }

  if (hasCta && scene.cta && !out.cta) {
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: titleY + titleH + subtitleCtaGap,
      w: 30,
      h: ctaH,
      fontSize: actualCtaFont,
    }
  }

  if (enabled.logo && scene.logo) {
    // Right safe-zone corner so the logo never collides with the contain-fit
    // image (Avito) or the title column on the left.
    out.logo = {
      ...scene.logo,
      x: 100 - sz.right - 6,
      y: sz.top,
      w: 6,
      h: 6,
    }
  }

  return out
}

const layoutUltraWideBanner: Layout = (scene, rules, enabled) => {
  const sz = rules.safeZone
  const left = sz.left
  const out: Scene = { background: scene.background, accent: scene.accent }

  const imageW = enabled.image && scene.image ? 18 : 0
  const ctaW = enabled.cta && scene.cta ? 22 : 0
  const gap = Math.max(rules.gutter, 2)
  const titleW = 100 - sz.left - sz.right - imageW - ctaW - gap * 2
  const titleFont = scene.title
    ? fitFontSize(scene.title.text, titleW, 1, 3.6, rules.minTitleSize)
    : 3.6
  const actualTitleFont = capFontSize(scene.title, titleFont)
  const subW = Math.max(18, titleW * 0.7)
  const subFont = capFontSize(scene.subtitle, 1.36)
  const titleLines = scene.title ? measuredLines(scene.title.text, actualTitleFont, titleW, 1, rules, TITLE_TOKENS.weight) : 0
  const subLines = scene.subtitle ? measuredLines(scene.subtitle.text, subFont, subW, 1, rules, SUBTITLE_TOKENS.weight) : 0
  const titleH = titleLines ? textBlockHeight(actualTitleFont, titleLines, 1.02, rules) : 0
  const subH = subLines ? textBlockHeight(subFont, subLines, 1.35, rules) : 0
  const supportGap = enabled.subtitle && scene.subtitle ? Math.max(pxToHeightPct(6, rules), rules.gutter * 0.55) : 0
  const copyStackH = titleH + supportGap + subH
  const copyY = clamp((100 - copyStackH) / 2, sz.top, 100 - sz.bottom - copyStackH)
  const ctaH = readableCtaHeight(46, rules)
  const ctaY = clamp((100 - ctaH) / 2, sz.top, 100 - sz.bottom - ctaH)

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: copyY,
        w: titleW,
        fontSize: actualTitleFont,
        maxLines: 1,
      },
      TITLE_TOKENS,
    )
  }

  if (enabled.subtitle && scene.subtitle) {
    out.subtitle = apply(
      {
        ...scene.subtitle,
        x: left,
        y: copyY + titleH + supportGap,
        w: subW,
        fontSize: subFont,
        maxLines: 1,
      },
      { ...SUBTITLE_TOKENS, opacity: 0.65 },
    )
  }

  if (enabled.cta && scene.cta) {
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left + titleW + gap,
      y: ctaY,
      w: ctaW,
      h: ctaH,
      fontSize: readableCtaFont(scene.cta, 1.78, rules),
      maxLines: 1,
    }
  }

  if (enabled.image && scene.image) {
    out.image = {
      ...scene.image,
      x: 100 - sz.right - imageW,
      y: 8,
      w: imageW,
      h: 84,
      rx: scene.image.rx ?? 12,
      fit: scene.image.fit ?? 'cover',
    }
  }

  if (enabled.logo && scene.logo && !out.image) {
    out.logo = {
      ...scene.logo,
      x: 100 - sz.right - 5,
      y: 22,
      w: 5,
      h: 40,
    }
  }

  return out
}

const layoutCompactBanner: Layout = (scene, rules, enabled) => {
  const sz = rules.safeZone
  const left = sz.left
  const out: Scene = { background: scene.background, accent: scene.accent }
  const imageW = enabled.image && scene.image ? 34 : 0
  const gap = 4
  const textW = 100 - sz.left - sz.right - imageW - gap
  const titleTarget = maxLinesFor(scene.title, 2, 2)
  const titleFont = scene.title
    ? fitFontSize(scene.title.text, textW, titleTarget, 5.9, rules.minTitleSize)
    : 5.9
  const actualTitleFont = capFontSize(scene.title, titleFont)
  const titleLines = scene.title ? measuredLines(scene.title.text, actualTitleFont, textW, titleTarget, rules, TITLE_TOKENS.weight) : 0
  const titleH = titleLines ? textBlockHeight(actualTitleFont, titleLines, 1.02, rules) : 0
  const subW = textW * 0.92
  const subFont = readableSubtitleFont(scene.subtitle, 2.35, rules)
  const subLines = scene.subtitle ? measuredLines(scene.subtitle.text, subFont, subW, 1, rules, SUBTITLE_TOKENS.weight) : 0
  const subH = subLines ? textBlockHeight(subFont, subLines, 1.35, rules) : 0
  const ctaH = readableCtaHeight(11, rules)
  const stackGap = Math.max(2.5, rules.gutter * 0.8)
  const stackH = titleH + stackGap + subH + stackGap + ctaH
  const titleY = clamp((100 - stackH) / 2, sz.top + rules.gutter, 100 - sz.bottom - stackH)

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: titleY,
        w: textW,
        fontSize: actualTitleFont,
        maxLines: titleTarget,
      },
      TITLE_TOKENS,
    )
  }

  if (enabled.subtitle && scene.subtitle) {
    out.subtitle = apply(
      {
        ...scene.subtitle,
        x: left,
        y: titleY + titleH + stackGap,
        w: subW,
        fontSize: subFont,
        maxLines: 1,
      },
      SUBTITLE_TOKENS,
    )
  }

  if (enabled.cta && scene.cta) {
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: titleY + titleH + stackGap + subH + stackGap,
      w: Math.min(42, textW * 0.84),
      h: ctaH,
      fontSize: readableCtaFont(scene.cta, 2.55, rules),
      maxLines: 1,
    }
  }

  if (enabled.image && scene.image) {
    out.image = {
      ...scene.image,
      x: 100 - sz.right - imageW,
      y: 10,
      w: imageW,
      h: 80,
      rx: scene.image.rx ?? 12,
      fit: scene.image.fit ?? 'cover',
    }
  }

  if (enabled.logo && scene.logo) {
    out.logo = {
      ...scene.logo,
      x: 100 - sz.right - imageW - 7,
      y: 10,
      w: 6,
      h: 6,
    }
  }

  return out
}

const layoutSmallVerticalAd: Layout = (scene, rules, enabled) => {
  const sz = rules.safeZone
  const left = sz.left
  const innerW = 100 - sz.left - sz.right
  const g = rules.gutter
  const out: Scene = { background: scene.background, accent: scene.accent }

  const imageH = enabled.image && scene.image ? 42 : 0
  if (enabled.image && scene.image) {
    out.image = {
      ...scene.image,
      x: left,
      y: sz.top,
      w: innerW,
      h: imageH - sz.top,
      rx: scene.image.rx ?? 14,
      fit: scene.image.fit ?? 'cover',
    }
  }

  const titleMaxLines = maxLinesFor(scene.title, 2, 2)
  const titleFont = scene.title
    ? fitFontSize(scene.title.text, innerW, titleMaxLines, 6.4, rules.minTitleSize)
    : 6.4
  const actualTitleFont = capFontSize(scene.title, titleFont)
  const subFont = readableSubtitleFont(scene.subtitle, 2.45, rules)
  const titleLines = scene.title
    ? measuredLines(scene.title.text, actualTitleFont, innerW, titleMaxLines, rules, TITLE_TOKENS.weight)
    : 0
  const subLines = scene.subtitle
    ? measuredLines(scene.subtitle.text, subFont, innerW * 0.92, 1, rules, SUBTITLE_TOKENS.weight)
    : 0
  const titleH = titleLines ? textBlockHeight(actualTitleFont, titleLines, 1.02, rules) : 0
  const subH = subLines ? textBlockHeight(subFont, subLines, 1.35, rules) : 0
  const ctaH = readableCtaHeight(8.2, rules)
  const hasBadge = enabled.badge && !!scene.badge
  const badgeH = hasBadge ? 3 : 0
  const badgeGap = hasBadge ? g * 0.8 : 0
  const textGap = titleH && subH ? Math.max(g * 0.65, pxToHeightPct(10, rules)) : 0
  const ctaGap = enabled.cta && scene.cta ? Math.max(g * 1.1, pxToHeightPct(16, rules)) : 0
  const stackH = badgeH + badgeGap + titleH + textGap + subH + ctaGap + (enabled.cta && scene.cta ? ctaH : 0)
  const panelTop = (imageH || sz.top) + g * 1.2
  const panelBottom = 100 - sz.bottom
  // Pin the copy stack against the photo edge — that's where it reads as a
  // real product listing instead of a balanced poster. Any leftover space
  // lives below the CTA as breathing room.
  const stackTop = clamp(panelTop, panelTop, Math.max(panelTop, panelBottom - stackH))
  const badgeY = stackTop
  const titleY = badgeY + badgeH + badgeGap
  const subY = titleY + titleH + textGap
  const ctaY = subY + subH + ctaGap

  if (hasBadge && scene.badge) {
    out.badge = apply(
      { ...scene.badge, x: left, y: badgeY, w: 34, h: badgeH, fontSize: 1.75 },
      BADGE_TOKENS,
    )
  }

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: titleY,
        w: innerW,
        fontSize: actualTitleFont,
        maxLines: Math.max(1, titleLines),
      },
      TITLE_TOKENS,
    )
  }

  if (enabled.subtitle && scene.subtitle) {
    out.subtitle = apply(
      {
        ...scene.subtitle,
        x: left,
        y: subY,
        w: innerW * 0.92,
        fontSize: subFont,
        maxLines: Math.max(1, subLines),
      },
      { ...SUBTITLE_TOKENS, opacity: 0.76 },
    )
  }

  if (enabled.cta && scene.cta) {
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: ctaY,
      w: Math.min(64, innerW),
      h: ctaH,
      fontSize: readableCtaFont(scene.cta, 2.65, rules),
      maxLines: 1,
    }
  }

  if (enabled.logo && scene.logo) {
    out.logo = {
      ...scene.logo,
      x: 100 - sz.right - 8,
      y: sz.top,
      w: 8,
      h: 5,
    }
  }

  return out
}

// Image fills the canvas; text stacks over a gradient scrim. Default anchor
// is the canvas bottom — but when the image hint shows that the bottom band
// is busy with subjects (faces, products, animals), we either flip the whole
// stack to the top safe-zone or, for story formats, split it: title +
// subtitle at the top, CTA at the platform's thumb-zone. The text block
// always lands against an image edge — never the floating middle.
const layoutHeroOverlay: Layout = (scene, rules, enabled, hint) => {
  const sz = rules.safeZone
  const left = sz.left
  const g = rules.gutter
  const innerW = 100 - sz.left - sz.right

  const out: Scene = { background: scene.background, accent: scene.accent }

  if (enabled.image && scene.image) {
    out.image = {
      ...scene.image,
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      rx: 0,
      fit: scene.image.fit ?? 'cover',
    }
  }

  // --- Sizing (anchor-independent) ------------------------------------------
  const ts = tscale(rules)
  const ctaH = readableCtaHeight(7, rules)
  const baseHeroTitle = 6.5 * ts
  const titleMaxLines = maxLinesFor(scene.title, 2, 2)
  const titleFont = scene.title
    ? fitFontSize(scene.title.text, innerW, titleMaxLines, baseHeroTitle, rules.minTitleSize)
    : baseHeroTitle
  const subFont = scene.subtitle
    ? fitFontSize(scene.subtitle.text, innerW * 0.9, 2, 2.6 * ts, MIN_SUBTITLE_SIZE)
    : 2.6 * ts
  const actualTitleFont = capFontSize(scene.title, titleFont)
  const actualSubFont = capFontSize(scene.subtitle, subFont)
  const titleLines = scene.title
    ? measuredLines(scene.title.text, actualTitleFont, innerW, titleMaxLines, rules, TITLE_TOKENS.weight)
    : 0
  const subLines = scene.subtitle
    ? measuredLines(scene.subtitle.text, actualSubFont, innerW * 0.9, 2, rules, SUBTITLE_TOKENS.weight)
    : 0
  const titleH = textBlockHeight(actualTitleFont, titleLines || 1, 1.02, rules)
  const subH = textBlockHeight(actualSubFont, subLines || 1, 1.35, rules)

  const hasTitle = enabled.title && !!scene.title
  const hasSubtitle = enabled.subtitle && !!scene.subtitle
  const hasCta = enabled.cta && !!scene.cta

  // --- Anchor decision -------------------------------------------------------
  //
  // Three modes:
  //   bottom (default) — title+subtitle+CTA stacked from the canvas bottom up
  //   top              — title+subtitle+CTA stacked from the canvas top down
  //   split            — title+subtitle from the top, CTA at thumb-zone
  //
  // We flip away from 'bottom' only when:
  //   (a) we have a real image hint (no flips for image-less drafts),
  //   (b) the bottom band has clear subject mass (regionContrast > 0.34),
  //   (c) the alternative band is meaningfully calmer (Δ ≥ 0.10),
  //   (d) the alternative still leaves the text inside a safe corridor.
  //
  // Hysteresis (Δ ≥ 0.10) keeps us from oscillating when the user swaps in a
  // visually similar image.
  const storyCtaBottom = STORY_CTA_BOTTOM[rules.key as keyof typeof STORY_CTA_BOTTOM]
  const isStory = storyCtaBottom !== undefined
  const safeBottom = 100 - sz.bottom
  const ctaBottomEdge = isStory ? Math.min(storyCtaBottom!, safeBottom) : safeBottom

  // Estimated full text-stack height — used to size the lookup window.
  const stackH = (hasTitle ? titleH : 0)
    + (hasSubtitle ? subH + g * 0.5 : 0)
    + (hasCta ? ctaH + g * 1.2 : 0)
  // Where the bottom-anchored stack would start — that's the band we
  // measure for subjects. Default scrim guard rail is `28%`, so don't go
  // higher than that when probing.
  const probedBottomTop = Math.max(28, ctaBottomEdge - stackH - g)
  const bottomBusy = regionContrast(
    hint?.brightnessGrid,
    left,
    probedBottomTop,
    innerW,
    Math.max(g, ctaBottomEdge - probedBottomTop),
    0,
  )
  // Where the top-anchored stack would end — same window size, mirrored.
  const probedTopBottom = Math.min(72, sz.top + stackH + g)
  const topBusy = regionContrast(
    hint?.brightnessGrid,
    left,
    sz.top,
    innerW,
    Math.max(g, probedTopBottom - sz.top),
    0,
  )

  type AnchorMode = 'bottom' | 'top' | 'split'
  let mode: AnchorMode = isStory ? 'split' : 'bottom'
  if (
    !isStory
    && mode === 'bottom'
    &&
    hint?.brightnessGrid
    && bottomBusy > 0.34
    && topBusy < bottomBusy - 0.10
    && probedTopBottom < 60
  ) {
    mode = 'top'
  }

  // Tall-portrait floor: even when the bottom band is calm enough to keep
  // bottom-mode active, a long title + subtitle + CTA stack can still grow
  // past the lower 40% of the canvas and crash into the upper-middle band
  // where photo subjects live (heads, products, hero shots typically sit
  // between 30% and 60% on a 9:16 photo). Compute the projected titleY for
  // bottom-mode and, if it would breach the floor, force split (story) or
  // top (non-story portrait) so the middle of the canvas stays clear of
  // any text. The check only fires on portrait formats — on 1:1 and wider
  // aspect ratios there's no "middle band" to worry about.
  if (mode === 'bottom' && hasTitle && rules.aspectRatio < 0.9) {
    const projectedSubAndCtaH = (hasCta ? ctaH + g * 1.2 : 0) + (hasSubtitle ? subH + g * 0.5 : 0)
    const projectedTitleY = ctaBottomEdge - projectedSubAndCtaH - titleH
    // Story-class portraits get a tighter floor (subjects in 9:16 frames
    // almost always reach below 60% of the canvas); 4:5 portraits get a
    // softer one because their subjects rarely reach below ~55%.
    const titleFloor = rules.aspectRatio < 0.7 ? 65 : 55
    if (projectedTitleY < titleFloor) {
      mode = isStory ? 'split' : 'top'
    }
  }

  // Lift the stack a little when the bottom is bright (legacy behaviour) —
  // applies only in 'bottom' mode where the text stays against the bottom.
  const brightBottomLift = mode === 'bottom'
    && hint?.bottomBandBrightness !== undefined
    && hint.bottomBandBrightness > 0.72
    ? g * 2.4
    : 0
  const bottom = ctaBottomEdge - brightBottomLift

  // --- Position the blocks ---------------------------------------------------
  let titleY = 0
  let subY = 0
  let ctaY = 0

  if (mode === 'bottom') {
    let cursorY = bottom
    if (hasCta) {
      ctaY = cursorY - ctaH
      cursorY = ctaY - g * 1.2
    }
    if (hasSubtitle) {
      subY = cursorY - subH
      cursorY = subY - g * 0.5
    }
    if (hasTitle) {
      titleY = cursorY - titleH
    }
  } else if (mode === 'top') {
    let cursorY = sz.top + g
    if (hasTitle) {
      titleY = cursorY
      cursorY = titleY + titleH + g * 0.5
    }
    if (hasSubtitle) {
      subY = cursorY
      cursorY = subY + subH + g * 1.2
    }
    if (hasCta) {
      ctaY = cursorY
    }
  } else {
    // split: title + subtitle at top, CTA pinned to thumb-zone bottom.
    let cursorY = sz.top + g
    if (hasTitle) {
      titleY = cursorY
      cursorY = titleY + titleH + g * 0.5
    }
    if (hasSubtitle) {
      subY = cursorY
    }
    if (hasCta) {
      ctaY = bottom - ctaH
    }
  }

  // --- Scrim tuned to actually cover the text stack -------------------------
  // Single Scrim entity per Scene; in 'split' mode we cover the top band
  // (title + subtitle) and rely on CTA's solid fill for legibility at the
  // bottom — no second gradient needed.
  //
  // Bottom-mode scrim has a guard rail at y=28 (so a tiny stack doesn't
  // produce a sliver of gradient floating in mid-frame) and a 7% lead-in
  // above the topmost block — that lead-in keeps the gradient soft enough
  // to fade in rather than start abruptly under the title.
  const stackTopY = Math.max(0, Math.min(titleY || 100, subY || 100, ctaY || 100) - g)
  const stackBottomY = mode === 'split'
    ? Math.max(titleY + titleH, subY + subH) + g
    : Math.max(titleY + titleH, subY + subH, ctaY + (hasCta ? ctaH : 0)) + g
  const localTextBrightness = Math.max(
    regionBrightness(hint?.brightnessGrid, left, titleY, innerW, titleH, hint ? 0.5 : 0.72),
    regionBrightness(hint?.brightnessGrid, left, subY, innerW * 0.9, subH, hint ? 0.5 : 0.72),
  )
  const opacity = hint?.bottomBandBrightness !== undefined
    ? clamp(Math.max(0.5 + hint.bottomBandBrightness * 0.55, 0.52 + localTextBrightness * 0.42), 0.58, 0.92)
    : 0.74
  out.scrim = mode === 'bottom'
    ? {
      y: Math.max(28, stackTopY - 7),
      h: 100 - Math.max(28, stackTopY - 7),
      color: '#000000',
      opacity,
      direction: 'down',
    }
    : {
      y: 0,
      h: clamp(stackBottomY, 18, mode === 'split' ? 50 : 72),
      color: '#000000',
      opacity,
      direction: 'up',
    }

  if (enabled.badge && scene.badge) {
    // In top/split modes the title now lives where the badge used to sit —
    // push the badge to the opposite edge instead.
    const badgeY = mode === 'bottom' ? sz.top : Math.min(94, bottom + g)
    out.badge = apply(
      { ...scene.badge, x: left, y: badgeY, w: 26, fontSize: 2.4, fill: '#FFFFFF' },
      BADGE_TOKENS,
    )
  }

  // Halo is tuned to the brightness of each block's own bbox — text over a
  // bright sky gets a heavier halo than text over the dark foreground below it.
  const titleHalo = haloForBrightness(
    regionBrightness(hint?.brightnessGrid, left, titleY, innerW, titleH, hint ? 0.5 : 0.82),
  )
  // Subtitles fade into the gradient scrim faster than titles do (they sit
  // closer to the transparent edge), so in top/split modes we always give
  // the subtitle at least a light halo even when the local brightness alone
  // wouldn't justify one. This keeps the body copy readable against snow,
  // skies and other mid-luminance noisy patches.
  const subBrightnessAtBlock = regionBrightness(
    hint?.brightnessGrid,
    left,
    subY,
    innerW * 0.9,
    subH,
    hint ? 0.5 : 0.82,
  )
  const subHalo = mode === 'bottom'
    ? haloForBrightness(subBrightnessAtBlock)
    : (haloForBrightness(subBrightnessAtBlock) ?? { color: '#000000', opacity: 0.32, blurPx: 1.2 })

  if (hasTitle) {
    out.title = apply(
      {
        ...scene.title!,
        x: left,
        y: titleY,
        w: innerW,
        fontSize: actualTitleFont,
        maxLines: titleMaxLines,
        fill: '#FFFFFF',
        ...(titleHalo ? { halo: titleHalo } : {}),
      },
      TITLE_TOKENS,
    )
  }

  if (hasSubtitle) {
    out.subtitle = apply(
      {
        ...scene.subtitle!,
        x: left,
        y: subY,
        w: innerW * 0.9,
        fontSize: actualSubFont,
        fill: '#FFFFFF',
        maxLines: 2,
        ...(subHalo ? { halo: subHalo } : {}),
      },
      { ...SUBTITLE_TOKENS, opacity: 0.9 },
    )
  }

  if (hasCta) {
    const ctaFont = readableCtaFont(scene.cta!, 2.6, rules)
    const ctaW = 32
    // Smart CTA X-position: when we have a real image hint, score each
    // candidate slot by both its *internal* variance (busy patches with
    // high-contrast subjects) and its *deviation from the row mean*
    // (uniformly dark patches against a bright row, e.g. a dark
    // silhouette on snow, are still subjects even though their internal
    // variance is low). Pick the slot with the lowest combined score.
    // Hysteresis (Δ ≥ 0.10) keeps the default `left` slot when no
    // alternative is meaningfully better — small image fluctuations
    // never flip the CTA away from the designer-intuitive default.
    const xLeft = left
    const xRight = Math.max(xLeft, 100 - sz.right - ctaW)
    const xCenter = (100 - ctaW) / 2
    let ctaX = xLeft
    if (!isStory && hint?.brightnessGrid) {
      // Score a CTA slot by:
      //   (a) ambient deviation — how far the slot's mean brightness sits
      //       from the row mean (subjects show up as dark silhouettes on a
      //       bright background or vice versa, regardless of internal
      //       texture); the dominant signal,
      //   (b) internal contrast — gritty patches with high-frequency
      //       detail (e.g. a printed pattern, the textured belly of a
      //       penguin) are bad CTA hosts even when their mean matches the
      //       row; used as a softer tiebreaker.
      // Without (a), a uniformly dark silhouette (cat in red parka against
      // white snow) registers as "calm" because its internal variance is
      // zero — exactly the failure mode the user pointed out.
      const rowMean = regionBrightness(hint.brightnessGrid, 0, ctaY, 100, ctaH, 0.5)
      function slotMass(x: number): number {
        const meanLocal = regionBrightness(hint!.brightnessGrid!, x, ctaY, ctaW, ctaH, 0.5)
        const internal = regionContrast(hint!.brightnessGrid!, x, ctaY, ctaW, ctaH, 0)
        return Math.abs(meanLocal - rowMean) * 1.5 + internal * 0.15
      }
      const mLeft = slotMass(xLeft)
      const mCenter = slotMass(xCenter)
      const mRight = slotMass(xRight)
      // Prefer center over right when both qualify — split-mode stories
      // typically have a "gap" between subjects in the middle (e.g.
      // between the cat and the penguin on snow), which is where a
      // designer would drop a CTA by hand. Right edges still win when
      // they're decisively cleaner than the centre.
      const bestAlt = mCenter <= mRight ? { m: mCenter, x: xCenter } : { m: mRight, x: xRight }
      if (bestAlt.m < mLeft - 0.10) ctaX = bestAlt.x
    }
    out.cta = {
      ...scene.cta!,
      ...CTA_TOKENS,
      x: ctaX,
      y: ctaY,
      w: ctaW,
      h: ctaH,
      fontSize: ctaFont,
    }
  }

  if (enabled.logo && scene.logo) {
    // Mirror the logo to the opposite corner from the title in top/split
    // modes so it doesn't collide with the new text block at the top.
    const logoY = mode === 'bottom' ? sz.top : Math.min(100 - sz.bottom - 6, 92)
    out.logo = {
      ...scene.logo,
      x: 100 - sz.right - 6,
      y: logoY,
      w: 6,
      h: 6,
    }
  }

  return out
}

const layoutAvitoSkyscraper: Layout = (scene, rules, enabled) => {
  const sz = rules.safeZone
  const left = sz.left
  const innerW = 100 - sz.left - sz.right
  const g = rules.gutter
  const out: Scene = { background: scene.background, accent: scene.accent }

  const imageH = 45
  if (enabled.image && scene.image) {
    out.image = {
      ...scene.image,
      x: left,
      y: sz.top,
      w: innerW,
      h: imageH - sz.top,
      rx: scene.image.rx ?? 18,
      fit: 'contain',
    }
  }

  const titleMaxLines = maxLinesFor(scene.title, 2, 2)
  const titleFont = scene.title
    ? fitFontSize(scene.title.text, innerW, titleMaxLines, 7.4, rules.minTitleSize)
    : 7.4
  const actualTitleFont = capFontSize(scene.title, titleFont)
  const subFont = readableSubtitleFont(scene.subtitle, 2.45, rules)
  const ctaH = readableCtaHeight(7.6, rules)
  const titleLines = scene.title
    ? measuredLines(scene.title.text, actualTitleFont, innerW, titleMaxLines, rules, TITLE_TOKENS.weight)
    : 0
  const subLines = scene.subtitle
    ? measuredLines(scene.subtitle.text, subFont, innerW * 0.92, 1, rules, SUBTITLE_TOKENS.weight)
    : 0
  const titleH = titleLines ? textBlockHeight(actualTitleFont, titleLines, 1.02, rules) : 0
  const subH = subLines ? textBlockHeight(subFont, subLines, 1.35, rules) : 0
  const hasBadge = enabled.badge && !!scene.badge
  const badgeH = hasBadge ? 3 : 0
  const badgeGap = hasBadge ? g * 0.85 : 0
  const textGap = titleH && subH ? Math.max(g * 0.75, pxToHeightPct(12, rules)) : 0
  const ctaGap = enabled.cta && scene.cta ? Math.max(g * 1.1, pxToHeightPct(20, rules)) : 0
  const stackH = badgeH + badgeGap + titleH + textGap + subH + ctaGap + (enabled.cta && scene.cta ? ctaH : 0)
  const panelTop = imageH + g * 1.2
  const panelBottom = 100 - sz.bottom
  // Skyscraper reads as a tall listing card, not a poster — pin the copy
  // stack to the photo edge so the column has a clear "image / details /
  // CTA" rhythm instead of a free-floating text block in the middle.
  const stackTop = clamp(panelTop, panelTop, Math.max(panelTop, panelBottom - stackH))
  const badgeY = stackTop
  const titleY = badgeY + badgeH + badgeGap
  const subY = titleY + titleH + textGap
  const ctaY = subY + subH + ctaGap

  if (hasBadge && scene.badge) {
    out.badge = apply(
      { ...scene.badge, x: left, y: badgeY, w: 32, h: badgeH, fontSize: 1.8 },
      BADGE_TOKENS,
    )
  }

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: titleY,
        w: innerW,
        fontSize: actualTitleFont,
        maxLines: Math.max(1, titleLines),
      },
      TITLE_TOKENS,
    )
  }

  if (enabled.subtitle && scene.subtitle) {
    out.subtitle = apply(
      {
        ...scene.subtitle,
        x: left,
        y: subY,
        w: innerW * 0.92,
        fontSize: subFont,
        maxLines: Math.max(1, subLines),
      },
      { ...SUBTITLE_TOKENS, opacity: 0.78 },
    )
  }

  if (enabled.cta && scene.cta) {
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: ctaY,
      w: Math.min(76, innerW),
      h: ctaH,
      fontSize: readableCtaFont(scene.cta, 2.8, rules),
      maxLines: 1,
    }
  }

  if (enabled.logo && scene.logo) {
    out.logo = {
      ...scene.logo,
      x: 100 - sz.right - 8,
      y: sz.top,
      w: 8,
      h: 5,
    }
  }

  return out
}

// Image on top, [title + subtitle + CTA] on the bottom. Text block is always
// vertically centered in its area — no empty voids at short content, no
// overflow at long content. Image height adapts to format aspect ratio.
const layoutImageTopTextBottom: Layout = (scene, rules, enabled) => {
  if (rules.key === 'avito-skyscraper') return layoutAvitoSkyscraper(scene, rules, enabled)
  if (rules.key === 'yandex-rsy-240x400') return layoutSmallVerticalAd(scene, rules, enabled)

  const sz = rules.safeZone
  const left = sz.left
  const innerW = 100 - sz.left - sz.right
  const g = rules.gutter

  // Story-ish (very tall) → smaller image to leave room for a proper text area.
  // Product-highlight-ish (4:5) → larger image because text has less room below.
  const isStoryish = rules.aspectRatio < 0.7
  const imageH = isStoryish ? 50 : 58
  const textAreaTop = imageH
  const textAreaBottom = 100 - sz.bottom

  const ts = tscale(rules)
  const baseTitleSize = (isStoryish ? 6.5 : 6) * ts
  const titleMaxLines = maxLinesFor(scene.title, Math.min(2, rules.maxTitleLines), rules.maxTitleLines)
  const titleFontSize = scene.title
    ? fitFontSize(scene.title.text, innerW, titleMaxLines, baseTitleSize, rules.minTitleSize)
    : baseTitleSize
  const baseSubSize = (isStoryish ? 3 : 2.8) * ts
  const subFontSize = scene.subtitle
    ? fitFontSize(scene.subtitle.text, innerW * 0.95, 2, baseSubSize, MIN_SUBTITLE_SIZE)
    : baseSubSize
  const actualTitleFontSize = capFontSize(scene.title, titleFontSize)
  const actualSubFontSize = capFontSize(scene.subtitle, subFontSize)
  const ctaH = readableCtaHeight(isStoryish ? 6 : 6.2, rules)

  const out: Scene = { background: scene.background, accent: scene.accent }

  if (enabled.image && scene.image) {
    out.image = {
      ...scene.image,
      x: 0,
      y: 0,
      w: 100,
      h: imageH,
      rx: 0,
      fit: scene.image.fit ?? 'cover',
    }
  }

  // Measure actual heights ---------------------------------------------------
  const titleLines = scene.title
    ? measuredLines(scene.title.text, actualTitleFontSize, innerW, titleMaxLines, rules, TITLE_TOKENS.weight)
    : 0
  const subLines = scene.subtitle
    ? measuredLines(scene.subtitle.text, actualSubFontSize, innerW * 0.95, 2, rules, SUBTITLE_TOKENS.weight)
    : 0
  const titleH = titleLines ? textBlockHeight(actualTitleFontSize, titleLines, 1.02, rules) : 0
  const subH = subLines ? textBlockHeight(actualSubFontSize, subLines, 1.35, rules) : 0

  // Text stack rides directly under the photo edge — that's the canonical
  // marketplace product-card silhouette. Anchoring at the panel top with a
  // small gutter eliminates the dead void between image and copy that used
  // to make the cards feel like a "resized post" rather than a commercial
  // listing. Bottom of the stack still respects the safe-zone, so when the
  // copy is short, the void lives below the CTA where it reads as
  // breathing room rather than a layout glitch.
  const hasBadge = enabled.badge && !!scene.badge
  const hasCta = enabled.cta && !!scene.cta
  const badgeH = hasBadge ? 2.8 : 0
  const badgeGap = hasBadge ? g * 0.85 : 0
  const textGap = titleH && subH ? Math.max(g * 0.55, pxToHeightPct(10, rules)) : 0
  const ctaGap = hasCta ? Math.max(g * 1.2, pxToHeightPct(20, rules)) : 0
  const stackH = badgeH + badgeGap + titleH + textGap + subH + ctaGap + (hasCta ? ctaH : 0)
  const stackTop = clamp(
    textAreaTop + Math.max(g * 1.1, pxToHeightPct(18, rules)),
    textAreaTop + g * 0.8,
    Math.max(textAreaTop + g * 0.8, textAreaBottom - stackH),
  )
  const badgeY = stackTop
  const titleY = stackTop + badgeH + badgeGap
  const subY = titleY + titleH + textGap
  const ctaY = subY + subH + ctaGap

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: titleY,
        w: innerW,
        fontSize: actualTitleFontSize,
        maxLines: Math.max(1, titleLines),
      },
      TITLE_TOKENS,
    )
  }

  if (enabled.subtitle && scene.subtitle) {
    out.subtitle = apply(
      {
        ...scene.subtitle,
        x: left,
        y: subY,
        w: innerW * 0.95,
        fontSize: actualSubFontSize,
        maxLines: Math.max(1, subLines),
      },
      SUBTITLE_TOKENS,
    )
  }

  if (hasBadge && scene.badge) {
    out.badge = apply(
      { ...scene.badge, x: left, y: badgeY, w: 24, h: badgeH, fontSize: 2.2 },
      BADGE_TOKENS,
    )
  }

  if (hasCta && scene.cta) {
    const ctaFont = 2.4
    // Card-class formats (3:4 wb/ozon, 4:5 vk-vertical, ya-market vertical)
    // read as marketplace listings. A wide CTA bar (≈50% of canvas width)
    // anchors the lower panel and matches what shoppers see on real
    // product cards. On 1:1 / square fallbacks we still keep a tighter
    // pill so it doesn't dwarf the rest of the layout.
    const ctaW = rules.aspectRatio < 0.95 ? Math.min(56, 100 - sz.left - sz.right) : 34
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: ctaY,
      w: ctaW,
      h: ctaH,
      fontSize: readableCtaFont(scene.cta, ctaFont, rules),
    }
  }

  if (enabled.logo && scene.logo) {
    out.logo = {
      ...scene.logo,
      x: 100 - sz.right - 6,
      y: sz.top,
      w: 6,
      h: 6,
    }
  }

  return out
}

export const LAYOUTS: Record<CompositionModel, Layout> = {
  'text-dominant': layoutTextDominant,
  'split-right-image': layoutSplitRightImage,
  'hero-overlay': layoutHeroOverlay,
  'image-top-text-bottom': layoutImageTopTextBottom,
}
