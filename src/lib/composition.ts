// Four deterministic composition models. No randomization.
// Each function takes (master scene, format rules) and returns positioned blocks
// in % units. The chooser is also deterministic — same inputs → same output.

import type {
  AssetHint,
  CompositionModel,
  EnabledMap,
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
    const ctaFont = 2.6
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: r.ctaY - 6,
      w: 32,
      h: 7,
        fontSize: capFontSize(scene.cta, ctaFont),
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
  const r = rhythm(rules)
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
  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: r.titleY,
        w: textW,
        fontSize: actualTitleFontSize,
        maxLines: splitTarget,
      },
      TITLE_TOKENS,
    )
  }

  if (enabled.subtitle && scene.subtitle) {
    const titleLines = scene.title
      ? measuredLines(scene.title.text, actualTitleFontSize, textW, splitTarget, rules, TITLE_TOKENS.weight)
      : 1
    const titleH = textBlockHeight(actualTitleFontSize, titleLines, 1.02, rules)
    const titleSubtitleGap = Math.max(pxToHeightPct(12, rules), rules.gutter)
    const subW = textW * 0.95
    const subFont = fitFontSize(scene.subtitle.text, subW, 3, 2.8 * ts, MIN_SUBTITLE_SIZE)
    const actualSubFont = capFontSize(scene.subtitle, subFont)
    const subtitleLines = measuredLines(scene.subtitle.text, actualSubFont, subW, 3, rules, SUBTITLE_TOKENS.weight)
    const subtitleH = textBlockHeight(actualSubFont, subtitleLines, 1.35, rules)
    out.subtitle = apply(
      {
        ...scene.subtitle,
        x: left,
        y: r.titleY + titleH + titleSubtitleGap,
        w: subW,
        fontSize: actualSubFont,
      },
      SUBTITLE_TOKENS,
    )

    if (enabled.cta && scene.cta) {
      const subtitleCtaGap = Math.max(pxToHeightPct(16, rules), rules.gutter)
      const ctaFont = 2.6
      const ctaTextW = Math.max(24, textW * 0.62)
      const actualCtaFont = capFontSize(scene.cta, ctaFont)
      const ctaLines = measuredLines(scene.cta.text, actualCtaFont, ctaTextW, 2, rules, CTA_TOKENS.weight)
      const ctaTextH = textBlockHeight(actualCtaFont, ctaLines, 1.0, rules)
      const ctaPadV = Math.max(pxToHeightPct(20, rules), rules.gutter * 0.9)
      out.cta = {
        ...scene.cta,
        ...CTA_TOKENS,
        x: left,
        y: r.titleY + titleH + titleSubtitleGap + subtitleH + subtitleCtaGap,
        w: ctaTextW,
        h: ctaTextH + ctaPadV,
        fontSize: actualCtaFont,
      }
    }
  }

  if (enabled.cta && scene.cta && !out.cta) {
    const ctaFont = 2.6
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: r.titleY + pxToHeightPct(16, rules),
      w: 30,
      h: pxToHeightPct(48, rules),
      fontSize: capFontSize(scene.cta, ctaFont),
    }
  }

  if (enabled.logo && scene.logo) {
    out.logo = {
      ...scene.logo,
      x: imageX - 7,
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

  const imageW = enabled.image && scene.image ? 20 : 0
  const ctaW = enabled.cta && scene.cta ? 17 : 0
  const gap = rules.gutter
  const titleW = 100 - sz.left - sz.right - imageW - ctaW - gap * 2
  const titleFont = scene.title
    ? fitFontSize(scene.title.text, titleW, 1, 3.2, rules.minTitleSize)
    : 3.2
  const actualTitleFont = capFontSize(scene.title, titleFont)

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: 18,
        w: titleW,
        fontSize: actualTitleFont,
        maxLines: 1,
      },
      TITLE_TOKENS,
    )
  }

  if (enabled.subtitle && scene.subtitle) {
    const subW = Math.max(18, titleW * 0.75)
    out.subtitle = apply(
      {
        ...scene.subtitle,
        x: left,
        y: 57,
        w: subW,
        fontSize: capFontSize(scene.subtitle, 1.35),
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
      y: 30,
      w: ctaW,
      h: 38,
      fontSize: capFontSize(scene.cta, 1.45),
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
  const imageW = enabled.image && scene.image ? 36 : 0
  const gap = 4
  const textW = 100 - sz.left - sz.right - imageW - gap
  const titleTarget = maxLinesFor(scene.title, 3, 3)
  const titleFont = scene.title
    ? fitFontSize(scene.title.text, textW, titleTarget, 5.4, rules.minTitleSize)
    : 5.4
  const actualTitleFont = capFontSize(scene.title, titleFont)

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: 24,
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
        y: 56,
        w: textW * 0.92,
        fontSize: capFontSize(scene.subtitle, 2.25),
        maxLines: 2,
      },
      SUBTITLE_TOKENS,
    )
  }

  if (enabled.cta && scene.cta) {
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: 76,
      w: Math.min(34, textW * 0.7),
      h: 9,
      fontSize: capFontSize(scene.cta, 2.3),
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

// Image fills the canvas; text stacks from the bottom over a gradient scrim.
// Positions are computed from the bottom up so there is never overlap regardless
// of title/subtitle length.
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

  // --- Stack from bottom up -------------------------------------------------
  const ts = tscale(rules)
  const ctaH = 7
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

  const bottom = 100 - sz.bottom
  let cursorY = bottom
  let ctaY = 0
  if (enabled.cta && scene.cta) {
    ctaY = cursorY - ctaH
    cursorY = ctaY - g * 1.2
  }
  let subY = 0
  if (enabled.subtitle && scene.subtitle) {
    subY = cursorY - subH
    cursorY = subY - g * 0.5
  }
  let titleY = 0
  if (enabled.title && scene.title) {
    titleY = cursorY - titleH
  }

  // --- Scrim tuned to actually cover the text stack -------------------------
  const stackTop = Math.max(0, Math.min(titleY, subY || titleY, ctaY || titleY) - g)
  // Opacity scales with how bright the band under the text actually is: a
  // sunlit sky needs a heavy veil to keep white text readable, while an
  // already-dark photo gets a softer scrim so it stays visually open. Falls
  // back to 0.68 when we haven't analysed the image yet.
  const opacity = hint?.bottomBandBrightness !== undefined
    ? clamp(0.42 + hint.bottomBandBrightness * 0.55, 0.45, 0.85)
    : 0.68
  out.scrim = {
    y: Math.max(40, stackTop - 5),
    h: 100 - Math.max(40, stackTop - 5),
    color: '#000000',
    opacity,
  }

  if (enabled.badge && scene.badge) {
    out.badge = apply(
      { ...scene.badge, x: left, y: sz.top, w: 26, fontSize: 2.4, fill: '#FFFFFF' },
      BADGE_TOKENS,
    )
  }

  // Halo is tuned to the brightness of each block's own bbox — text over a
  // bright sky gets a heavier halo than text over the dark foreground below it.
  const titleHalo = haloForBrightness(
    regionBrightness(hint?.brightnessGrid, left, titleY, innerW, titleH, 0.5),
  )
  const subHalo = haloForBrightness(
    regionBrightness(hint?.brightnessGrid, left, subY, innerW * 0.9, subH, 0.5),
  )

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
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

  if (enabled.subtitle && scene.subtitle) {
    out.subtitle = apply(
      {
        ...scene.subtitle,
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

  if (enabled.cta && scene.cta) {
    const ctaFont = 2.6
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: ctaY,
      w: 32,
      h: ctaH,
      fontSize: capFontSize(scene.cta, ctaFont),
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

// Image on top, [title + subtitle + CTA] on the bottom. Text block is always
// vertically centered in its area — no empty voids at short content, no
// overflow at long content. Image height adapts to format aspect ratio.
const layoutImageTopTextBottom: Layout = (scene, rules, enabled) => {
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
  const ctaH = 6

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

  // Text stack: top-align under the image. Flow CTA right after the subtitle
  // so the bottom doesn't grow a vertical void on tall formats (story). On
  // short formats where subtitle+CTA would overflow the text area, clamp CTA
  // to the bottom of the text area as a hard floor.
  const textStackTop = textAreaTop + g * 1.2
  const textGap = titleH && subH ? g * 0.6 : 0
  const titleY = textStackTop
  const subY = titleY + titleH + textGap
  const hasCta = enabled.cta && !!scene.cta
  const afterTextY = (subLines ? subY + subH : titleY + titleH) + g * 1.5
  const ctaY = Math.min(afterTextY, textAreaBottom - ctaH)

  if (enabled.title && scene.title) {
    out.title = apply(
      {
        ...scene.title,
        x: left,
        y: titleY,
        w: innerW,
        fontSize: actualTitleFontSize,
        maxLines: titleMaxLines,
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
        maxLines: 2,
      },
      SUBTITLE_TOKENS,
    )
  }

  if (enabled.badge && scene.badge) {
    out.badge = apply(
      { ...scene.badge, x: left, y: textAreaTop + g * 0.4, w: 24, fontSize: 2.2 },
      BADGE_TOKENS,
    )
  }

  if (hasCta && scene.cta) {
    const ctaFont = 2.4
    out.cta = {
      ...scene.cta,
      ...CTA_TOKENS,
      x: left,
      y: ctaY,
      w: 34,
      h: ctaH,
      fontSize: capFontSize(scene.cta, ctaFont),
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
