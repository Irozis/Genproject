import { computeCtaButtonSize } from './ctaSizing'
import { safeAreaToPercentEdges, visibleAreaToPercentRect } from './formatGeometry'
import { fitFontSize, wrapText } from './textMeasure'
import type { CtaBlock, EnabledMap, FormatRuleSet, Scene, TextBlock } from './types'

type RectPct = { x: number; y: number; w: number; h: number }

type LayoutMode =
  | 'micro-banner'
  | 'horizontal-strip-compact'
  | 'ultra-wide-strip'
  | 'horizontal-split'
  | 'vertical-story-compact'
  | 'image-top-card'
  | 'balanced-card'
  | 'text-only'

type LayoutRegions = {
  mode: LayoutMode
  canvasRect: RectPct
  safeRect: RectPct
  contentRect: RectPct
  imageRegion: RectPct
  textRegion: RectPct
  ctaRegion: RectPct
  logoRegion: RectPct
}

export function normalizeGroupLayout(scene: Scene, rules: FormatRuleSet, enabled: EnabledMap): Scene {
  const hasImage = Boolean(enabled.image && scene.image?.src)
  const hasLogo = Boolean(enabled.logo && scene.logo)
  const regions = computeLayoutRegions(rules, hasImage, hasLogo)
  const out: Scene = { background: scene.background, accent: scene.accent }
  if (scene.decor) out.decor = scene.decor

  const overlayAllowed = scene.scrim && regions.mode === 'text-only'
  if (overlayAllowed) out.scrim = scene.scrim

  if (hasImage && scene.image) {
    out.image = {
      ...scene.image,
      x: regions.imageRegion.x,
      y: regions.imageRegion.y,
      w: regions.imageRegion.w,
      h: regions.imageRegion.h,
      rx: regions.mode === 'ultra-wide-strip' || regions.mode === 'micro-banner' ? Math.min(scene.image.rx ?? 10, 10) : scene.image.rx,
      fit: regions.mode === 'image-top-card' || regions.mode === 'vertical-story-compact' ? (scene.image.fit ?? 'cover') : 'contain',
    }
  }

  if (hasLogo && scene.logo) {
    out.logo = {
      ...scene.logo,
      x: regions.logoRegion.x,
      y: regions.logoRegion.y,
      w: regions.logoRegion.w,
      h: regions.logoRegion.h,
    }
  }

  placeTextGroup(out, scene, rules, enabled, regions)
  return resolveCollisions(out, regions, rules)
}

export function computeLayoutRegions(rules: FormatRuleSet, hasImage: boolean, hasLogo: boolean): LayoutRegions {
  const safe = effectiveSafeZone(rules)
  const safeRect = rectFromEdges(safe)
  const contentRect = inset(safeRect, Math.max(0, rules.gutter * 0.2))
  const mode = chooseMode(rules, hasImage)
  const gap = Math.max(rules.gutter, pxToWidthPct(8, rules))
  const logoSize = hasLogo ? clamp(Math.min(contentRect.h * 0.55, contentRect.w * 0.12), 4, mode === 'micro-banner' ? 12 : 8) : 0
  const logoRegion: RectPct = hasLogo
    ? { x: contentRect.x, y: contentRect.y + (contentRect.h - logoSize) / 2, w: logoSize, h: logoSize }
    : { x: contentRect.x, y: contentRect.y, w: 0, h: 0 }

  if (!hasImage) {
    const x = hasLogo ? logoRegion.x + logoRegion.w + gap : contentRect.x
    const textRegion = { x, y: contentRect.y, w: contentRect.x + contentRect.w - x, h: contentRect.h }
    return withCtaRegion(mode, safeRect, contentRect, emptyRect(), textRegion, logoRegion)
  }

  if (mode === 'micro-banner') {
    const mediaW = clamp(contentRect.h * rules.height / rules.width * 1.15, 10, 18)
    const imageRegion = hasLogo
      ? logoRegion
      : { x: contentRect.x, y: contentRect.y, w: mediaW, h: contentRect.h }
    const ctaW = clamp(20, 16, 24)
    const textX = imageRegion.x + imageRegion.w + gap
    const textRegion = {
      x: textX,
      y: contentRect.y,
      w: Math.max(10, contentRect.x + contentRect.w - textX - ctaW - gap),
      h: contentRect.h,
    }
    const ctaRegion = { x: contentRect.x + contentRect.w - ctaW, y: contentRect.y, w: ctaW, h: contentRect.h }
    return { mode, canvasRect: fullRect(), safeRect, contentRect, imageRegion, textRegion, ctaRegion, logoRegion }
  }

  if (mode === 'ultra-wide-strip' || mode === 'horizontal-strip-compact') {
    const imageW = mode === 'ultra-wide-strip' ? clamp(contentRect.h * rules.height / rules.width * 1.6, 11, 20) : 24
    const ctaW = mode === 'ultra-wide-strip' ? 18 : 22
    const mediaX = contentRect.x
    const imageRegion = { x: mediaX, y: contentRect.y, w: imageW, h: contentRect.h }
    const stripLogoRegion = hasLogo
      ? { x: imageRegion.x + imageRegion.w + gap * 0.45, y: logoRegion.y, w: logoRegion.w, h: logoRegion.h }
      : logoRegion
    const textX = (hasLogo ? stripLogoRegion.x + stripLogoRegion.w : imageRegion.x + imageRegion.w) + gap
    const textRegion = {
      x: textX,
      y: contentRect.y,
      w: Math.max(16, contentRect.x + contentRect.w - textX - ctaW - gap),
      h: contentRect.h,
    }
    const ctaRegion = { x: contentRect.x + contentRect.w - ctaW, y: contentRect.y, w: ctaW, h: contentRect.h }
    return { mode, canvasRect: fullRect(), safeRect, contentRect, imageRegion, textRegion, ctaRegion, logoRegion: stripLogoRegion }
  }

  if (mode === 'horizontal-split') {
    const imageW = clamp(rules.aspectRatio >= 3 ? 30 : 36, 25, 40)
    const imageRegion = { x: contentRect.x + contentRect.w - imageW, y: contentRect.y, w: imageW, h: contentRect.h }
    const textRegion = { x: contentRect.x, y: contentRect.y, w: Math.max(35, contentRect.w - imageW - gap), h: contentRect.h }
    return withCtaRegion(mode, safeRect, contentRect, imageRegion, textRegion, logoRegion)
  }

  const story = mode === 'vertical-story-compact'
  const imageInset = mode === 'balanced-card' ? 8 : 0
  const imageH = story ? 52 : rules.aspectRatio < 0.9 ? 50 : 46
  const imageRegion = { x: contentRect.x + imageInset, y: contentRect.y, w: Math.max(10, contentRect.w - imageInset * 2), h: imageH }
  const textRegion = {
    x: contentRect.x,
    y: imageRegion.y + imageRegion.h + Math.max(gap * 0.35, pxToHeightPct(10, rules)),
    w: contentRect.w,
    h: Math.max(20, contentRect.y + contentRect.h - (imageRegion.y + imageRegion.h) - Math.max(gap * 0.35, pxToHeightPct(10, rules))),
  }
  return withCtaRegion(mode, safeRect, contentRect, imageRegion, textRegion, logoRegion)
}

function placeTextGroup(out: Scene, source: Scene, rules: FormatRuleSet, enabled: EnabledMap, regions: LayoutRegions): void {
  const mode = regions.mode
  const compact = mode === 'micro-banner' || mode === 'ultra-wide-strip' || mode === 'horizontal-strip-compact'
  const hasTitle = Boolean(enabled.title && source.title?.text.trim())
  const hasSubtitle = Boolean(enabled.subtitle && source.subtitle?.text.trim())
  const hasCta = Boolean(enabled.cta && source.cta?.text.trim())
  const text = regions.textRegion
  const titleLineCap = mode === 'micro-banner' || mode === 'ultra-wide-strip' ? 1 : mode === 'horizontal-strip-compact' || mode === 'horizontal-split' ? 2 : Math.min(3, rules.maxTitleLines)
  const titleLines = Math.max(1, Math.min(source.title?.maxLines ?? titleLineCap, titleLineCap))
  const subLines = mode === 'horizontal-split' ? 1 : 2

  let titleFontPx = hasTitle && source.title
    ? fittedTextPx(source.title, text, rules, 'title', titleLines)
    : 0
  const titleH = hasTitle ? textHeightPct(titleFontPx, titleLines, source.title?.lineHeight ?? 1.02, rules) : 0
  const hideSubtitleForMode = mode === 'micro-banner'
  const shouldPlaceSubtitle = hasSubtitle && !hideSubtitleForMode
  let subtitleFontPx = shouldPlaceSubtitle && source.subtitle
    ? fittedTextPx(source.subtitle, text, rules, 'subtitle', subLines)
    : 0
  let subtitleH = shouldPlaceSubtitle ? textHeightPct(subtitleFontPx, subLines, source.subtitle?.lineHeight ?? 1.3, rules) : 0
  const ctaSize = hasCta && source.cta ? computeFittedCta(source.cta, regions, rules) : null
  const titleSubGap = hasTitle && shouldPlaceSubtitle ? gapPct(rules, compact ? 4 : 10) : 0
  const ctaGap = hasCta ? gapPct(rules, compact ? 0 : 14) : 0
  const ctaH = ctaSize ? (ctaSize.height / rules.height) * 100 : 0
  const stackH = titleH + titleSubGap + subtitleH + ctaGap + ctaH
  const ySlack = Math.max(0, text.h - stackH)
  const stackY = compact ? text.y + ySlack / 2 : text.y + Math.min(ySlack * 0.28, gapPct(rules, 28))
  let cursor = stackY

  if (hasTitle && source.title) {
    out.title = {
      ...source.title,
      x: text.x,
      y: cursor,
      w: text.w,
      h: titleH,
      fontSize: (titleFontPx / rules.width) * 100,
      maxLines: titleLines,
    }
    cursor += titleH + titleSubGap
  }

  if (shouldPlaceSubtitle && subtitleFontPx > 0 && source.subtitle) {
    out.subtitle = {
      ...source.subtitle,
      x: text.x,
      y: cursor,
      w: text.w * 0.96,
      h: subtitleH,
      fontSize: (subtitleFontPx / rules.width) * 100,
      maxLines: subLines,
    }
    cursor += subtitleH + ctaGap
  } else if (hasCta) {
    cursor += ctaGap
  }

  if (hasCta && source.cta && ctaSize) {
    const ctaW = (ctaSize.width / rules.width) * 100
    const ctaHPct = (ctaSize.height / rules.height) * 100
    const ctaX = compact ? regions.ctaRegion.x + Math.max(0, regions.ctaRegion.w - ctaW) / 2 : text.x
    const ctaY = compact
      ? regions.ctaRegion.y + Math.max(0, regions.ctaRegion.h - ctaHPct) / 2
      : clamp(cursor, regions.ctaRegion.y, Math.max(regions.ctaRegion.y, regions.ctaRegion.y + regions.ctaRegion.h - ctaHPct))
    out.cta = {
      ...source.cta,
      x: ctaX,
      y: ctaY,
      w: Math.min(ctaW, regions.ctaRegion.w),
      h: ctaHPct,
      fontSize: (ctaSize.fontSize / rules.width) * 100,
      maxLines: 1,
      rx: source.cta.rx,
    }
  }
}

function resolveCollisions(scene: Scene, regions: LayoutRegions, rules: FormatRuleSet): Scene {
  const out: Scene = { ...scene }
  if (out.title && out.subtitle && overlaps(out.title, out.subtitle, rules)) {
    out.subtitle = { ...out.subtitle, y: out.title.y + blockH(out.title, rules) + gapPct(rules, 6) }
  }
  if (out.subtitle && out.cta && overlaps(out.subtitle, out.cta, rules)) {
    out.cta = { ...out.cta, y: out.subtitle.y + blockH(out.subtitle, rules) + gapPct(rules, 6) }
  }
  if (out.title && out.cta && overlaps(out.title, out.cta, rules)) {
    out.cta = { ...out.cta, y: out.title.y + blockH(out.title, rules) + gapPct(rules, 6) }
  }
  if (out.cta) {
    out.cta = clampBlockToRect(out.cta, regions.ctaRegion)
  }
  for (const kind of ['title', 'subtitle', 'badge'] as const) {
    const block = out[kind]
    if (!block) continue
    out[kind] = clampBlockToRect(block, regions.textRegion)
  }
  if (out.image) out.image = clampBlockToRect(out.image, regions.imageRegion)
  return out
}

function chooseMode(rules: FormatRuleSet, hasImage: boolean): LayoutMode {
  if (!hasImage) return 'text-only'
  if (rules.height <= 70) return 'micro-banner'
  if (rules.aspectRatio >= 5) return 'ultra-wide-strip'
  if (rules.height <= 120 && rules.aspectRatio >= 3) return 'horizontal-strip-compact'
  if (rules.width <= 200 || rules.height <= 200) return rules.aspectRatio >= 2.2 ? 'horizontal-strip-compact' : 'balanced-card'
  if (rules.aspectRatio >= 2.2) return 'horizontal-split'
  if (rules.aspectRatio <= 0.45) return 'vertical-story-compact'
  if (rules.aspectRatio < 0.9) return 'image-top-card'
  return 'balanced-card'
}

function withCtaRegion(
  mode: LayoutMode,
  safeRect: RectPct,
  contentRect: RectPct,
  imageRegion: RectPct,
  textRegion: RectPct,
  logoRegion: RectPct,
): LayoutRegions {
  const ctaRegion = {
    x: textRegion.x,
    y: textRegion.y + textRegion.h * (mode === 'horizontal-split' ? 0.62 : 0.66),
    w: textRegion.w,
    h: textRegion.h * (mode === 'horizontal-split' ? 0.38 : 0.34),
  }
  return { mode, canvasRect: fullRect(), safeRect, contentRect, imageRegion, textRegion, ctaRegion, logoRegion }
}

function fittedTextPx(block: TextBlock, region: RectPct, rules: FormatRuleSet, role: 'title' | 'subtitle', maxLines: number): number {
  const regionHPx = (region.h / 100) * rules.height
  const regionWPx = (region.w / 100) * rules.width
  const targetBlockShare = role === 'title' ? 0.28 : 0.14
  const lineHeight = role === 'title' ? 1.02 : 1.3
  const targetPx = role === 'title'
    ? clamp(regionHPx * targetBlockShare / Math.max(1, maxLines) / lineHeight, rules.height <= 70 ? 11 : 18, rules.height <= 70 ? rules.height * 0.42 : 58)
    : clamp(regionHPx * targetBlockShare / Math.max(1, maxLines) / lineHeight, 10, 28)
  const minPx = role === 'title' ? Math.max(rules.minFontSize ?? 12, rules.height <= 70 ? 10 : 14) : Math.max(10, Math.min(14, rules.minFontSize ?? 12))
  const fittedPx = fitFontSize({
    baseFontSizePx: targetPx,
    minFontSizePx: minPx,
    fits: (fontSizePx) => wrapText({
      text: block.text,
      fontSizePx,
      fontWeight: block.weight,
      fontFamily: block.fontFamily ?? 'Inter, system-ui, sans-serif',
      maxWidthPx: regionWPx,
      maxLines,
    }).length <= maxLines,
  })
  return fittedPx
}

function computeFittedCta(cta: CtaBlock, regions: LayoutRegions, rules: FormatRuleSet): { width: number; height: number; fontSize: number } {
  const mode = regions.mode
  const ctaRegion = regions.ctaRegion
  const textRegion = regions.textRegion
  const maxWidthRatio = mode === 'image-top-card' || mode === 'vertical-story-compact' || mode === 'balanced-card' ? 0.6 : 0.45
  const maxWidth = Math.max(40, Math.min((ctaRegion.w / 100) * rules.width, (textRegion.w / 100) * rules.width * maxWidthRatio))
  const heightLimits = ctaHeightLimits(mode, rules)
  const fontSize = clamp(heightLimits.max * 0.42, 10, Math.max(10, heightLimits.max * 0.55))
  return computeCtaButtonSize({
    text: cta.text,
    fontSize,
    fontFamily: cta.fontFamily,
    fontWeight: cta.weight,
    minWidth: Math.min(maxWidth, Math.max(48, heightLimits.min * 2.6)),
    maxWidth,
    minHeight: heightLimits.min,
    maxHeight: heightLimits.max,
    paddingX: Math.max(10, heightLimits.max * 0.45),
    paddingY: Math.max(4, heightLimits.max * 0.18),
    lineHeight: cta.lineHeight ?? 1,
    formatWidth: rules.width,
    formatHeight: rules.height,
    density: 'balanced',
    letterSpacing: cta.letterSpacing,
  })
}

function ctaHeightLimits(mode: LayoutMode, rules: FormatRuleSet): { min: number; max: number } {
  if (mode === 'micro-banner') return { min: Math.min(16, rules.height * 0.32), max: Math.min(24, rules.height * 0.45) }
  if (mode === 'horizontal-strip-compact' || rules.height <= 120) return { min: 20, max: Math.min(34, rules.height * 0.45) }
  if (mode === 'ultra-wide-strip') return { min: 20, max: Math.min(34, rules.height * 0.42) }
  if (mode === 'horizontal-split') return { min: 28, max: Math.min(48, rules.height * 0.18) }
  return { min: 44, max: Math.min(80, rules.height * 0.14) }
}

function effectiveSafeZone(rules: FormatRuleSet): FormatRuleSet['safeZone'] {
  const safe = rules.safeArea ? safeAreaToPercentEdges(rules.safeArea, rules.width, rules.height) : rules.safeZone
  const visible = visibleAreaToPercentRect(rules)
  const fromVisible = visible
    ? {
        top: Math.max(safe.top, visible.y),
        right: Math.max(safe.right, 100 - (visible.x + visible.w)),
        bottom: Math.max(safe.bottom, 100 - (visible.y + visible.h)),
        left: Math.max(safe.left, visible.x),
      }
    : safe
  const pad = rules.requiredPadding ? (rules.requiredPadding / Math.min(rules.width, rules.height)) * 100 : 0
  return {
    top: fromVisible.top + pad,
    right: fromVisible.right + pad,
    bottom: fromVisible.bottom + pad,
    left: fromVisible.left + pad,
  }
}

function clampBlockToRect<T extends { x: number; y: number; w: number; h?: number }>(block: T, rect: RectPct): T {
  const h = block.h ?? rect.h
  const w = Math.min(block.w, rect.w)
  return {
    ...block,
    x: clamp(block.x, rect.x, Math.max(rect.x, rect.x + rect.w - w)),
    y: clamp(block.y, rect.y, Math.max(rect.y, rect.y + rect.h - h)),
    w,
    h: block.h === undefined ? block.h : Math.min(block.h, rect.h),
  }
}

function overlaps(a: { x: number; y: number; w: number; h?: number }, b: { x: number; y: number; w: number; h?: number }, rules: FormatRuleSet): boolean {
  const ah = blockH(a, rules)
  const bh = blockH(b, rules)
  return a.x + a.w > b.x + 0.2 && b.x + b.w > a.x + 0.2 && a.y + ah > b.y + 0.2 && b.y + bh > a.y + 0.2
}

function blockH(block: { h?: number; fontSize?: number; maxLines?: number; lineHeight?: number }, rules: FormatRuleSet): number {
  return block.h ?? ((block.fontSize ?? 3) * (block.maxLines ?? 1) * (block.lineHeight ?? 1.2) * rules.aspectRatio)
}

function textHeightPct(fontPx: number, lines: number, lineHeight: number, rules: FormatRuleSet): number {
  return (fontPx * lines * lineHeight / rules.height) * 100
}

function gapPct(rules: FormatRuleSet, minPx: number): number {
  return Math.max(rules.gutter * 0.55, pxToHeightPct(minPx, rules))
}

function rectFromEdges(edges: FormatRuleSet['safeZone']): RectPct {
  return { x: edges.left, y: edges.top, w: 100 - edges.left - edges.right, h: 100 - edges.top - edges.bottom }
}

function inset(rect: RectPct, pad: number): RectPct {
  return { x: rect.x + pad, y: rect.y + pad, w: Math.max(0, rect.w - pad * 2), h: Math.max(0, rect.h - pad * 2) }
}

function fullRect(): RectPct {
  return { x: 0, y: 0, w: 100, h: 100 }
}

function emptyRect(): RectPct {
  return { x: 0, y: 0, w: 0, h: 0 }
}

function pxToHeightPct(px: number, rules: FormatRuleSet): number {
  return rules.height > 0 ? (px / rules.height) * 100 : 0
}

function pxToWidthPct(px: number, rules: FormatRuleSet): number {
  return rules.width > 0 ? (px / rules.width) * 100 : 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
