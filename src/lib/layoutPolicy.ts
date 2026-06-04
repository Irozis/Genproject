import { contrastRatioFromLuminance, luminance } from './color'
import { checkOverflow } from './fixLayout'
import { measureTextWidth } from './textMeasure'
import type { AssetHint, BlockKind, CompositionModel, FormatRuleSet, RuleSource, Scene } from './types'

export type LayoutPolicyFormatKind =
  | 'logoOnly'
  | 'tinySmall'
  | 'horizontal'
  | 'lowHorizontal'
  | 'ultraWideHorizontal'
  | 'vertical'
  | 'square'
  | 'landscape'
  | 'tallVertical'

export type LayoutPolicy = {
  formatKind: LayoutPolicyFormatKind
  preferredComposition: CompositionModel
  allowedCompositions: CompositionModel[]
  allowGradient: boolean
  source: RuleSource
  hiddenByDefault: BlockKind[]
}

export type LayoutPolicyResult = {
  scene: Scene
  policy: LayoutPolicy
}

const POLICY_SOURCE: RuleSource = {
  type: 'heuristic',
  name: 'Demo-safe layout policy',
  note: 'Internal policy derived from geometry and readability to avoid visibly broken demo layouts. This is not an official platform requirement.',
}

export const GRADIENT_POLICY_SOURCE: RuleSource = {
  type: 'heuristic',
  name: 'Demo-safe gradient policy',
  note: 'Градиент отключён по умолчанию для предотвращения случайного визуального шума. Это не официальный запрет площадки.',
}

export function classifyPolicyFormat(rules: FormatRuleSet): LayoutPolicyFormatKind {
  const area = rules.width * rules.height
  if (isLogoFormat(rules)) return 'logoOnly'
  if (rules.aspectRatio < 0.55) return 'tallVertical'
  if (rules.width <= 200 && rules.height <= 200 && rules.aspectRatio < 2.2) return 'tinySmall'
  if (rules.aspectRatio >= 4) return 'ultraWideHorizontal'
  if (rules.height <= 300 || rules.aspectRatio >= 3) return 'lowHorizontal'
  if (rules.width <= 340 || rules.height <= 120 || area <= 50000) return 'tinySmall'
  if (rules.aspectRatio >= 1.45) return 'horizontal'
  if (rules.aspectRatio <= 0.75) return 'vertical'
  if (rules.aspectRatio >= 0.85 && rules.aspectRatio <= 1.2) return 'square'
  if (rules.aspectRatio < 0.85) return 'vertical'
  return 'landscape'
}

export function getLayoutPolicy(rules: FormatRuleSet, hasImage: boolean): LayoutPolicy {
  const formatKind = classifyPolicyFormat(rules)
  if (formatKind === 'logoOnly') {
    return {
      formatKind,
      preferredComposition: 'centered-card',
      allowedCompositions: ['centered-card', 'text-dominant'],
      allowGradient: false,
      source: POLICY_SOURCE,
      hiddenByDefault: ['subtitle', 'cta', 'badge', 'image'],
    }
  }
  if (isHorizontalKind(formatKind)) {
    return {
      formatKind,
      preferredComposition: hasImage ? 'split-right-image' : 'text-dominant',
      allowedCompositions: ['split-right-image', 'split-left-image', 'product-card-safe', 'centered-card', 'text-dominant'],
      allowGradient: false,
      source: POLICY_SOURCE,
      hiddenByDefault: ['badge'],
    }
  }
  if (formatKind === 'tinySmall') {
    const preferredComposition = rules.aspectRatio >= 1.6 ? 'split-right-image' : hasImage ? 'product-card-safe' : 'text-dominant'
    return {
      formatKind,
      preferredComposition,
      allowedCompositions: ['split-right-image', 'product-card-safe', 'text-dominant'],
      allowGradient: false,
      source: POLICY_SOURCE,
      hiddenByDefault: ['subtitle', 'badge'],
    }
  }
  if (formatKind === 'vertical' || formatKind === 'tallVertical') {
    return {
      formatKind,
      preferredComposition: hasImage ? 'image-top-stack' : 'text-dominant',
      allowedCompositions: ['image-top-stack', 'hero-overlay', 'product-card-safe', 'text-dominant'],
      allowGradient: false,
      source: POLICY_SOURCE,
      hiddenByDefault: [],
    }
  }
  return {
    formatKind,
    preferredComposition: hasImage ? 'product-card-safe' : 'centered-card',
    allowedCompositions: ['product-card-safe', 'split-right-image', 'hero-overlay', 'centered-card', 'text-dominant'],
    allowGradient: false,
    source: POLICY_SOURCE,
    hiddenByDefault: [],
  }
}

export function applyPolicyToComposition(
  selected: CompositionModel,
  policy: LayoutPolicy,
  manualOverride: boolean,
): CompositionModel {
  if (!manualOverride && !policy.allowedCompositions.includes(selected)) return policy.preferredComposition
  if (policy.formatKind === 'logoOnly') return policy.preferredComposition
  if (isHorizontalKind(policy.formatKind) && (selected === 'image-top-stack' || selected === 'image-top-text-bottom' || selected === 'hero-overlay')) return policy.preferredComposition
  if (policy.formatKind === 'tinySmall' && selected === 'hero-overlay') return policy.preferredComposition
  return selected
}

export function applyLayoutPolicy(
  scene: Scene,
  rules: FormatRuleSet,
  policy: LayoutPolicy,
  options: { gradientEnabled?: boolean; compositionModel: CompositionModel; manualOverride?: boolean; assetHint?: AssetHint | null },
): LayoutPolicyResult {
  let out = stripGradient(scene, policy, options.gradientEnabled)
  out = stripUnexpectedOverlay(out, options.compositionModel, options.gradientEnabled, options.assetHint)
  out = stripUnexpectedDecor(out, options.gradientEnabled)
  out = applyReducedContentPolicy(out, rules, policy)
  if (!options.manualOverride || isHorizontalKind(policy.formatKind)) out = applyGeometryPolicy(out, rules, policy, options.compositionModel)
  out = markManualReview(out, rules, policy)
  return { scene: out, policy }
}

function stripGradient(scene: Scene, policy: LayoutPolicy, gradientEnabled: boolean | undefined): Scene {
  if (gradientEnabled !== false && (gradientEnabled === true || policy.allowGradient)) return scene
  if (scene.background.kind !== 'gradient') return scene
  return {
    ...scene,
    background: { kind: 'solid', color: scene.background.stops[1] },
  }
}

function stripUnexpectedOverlay(
  scene: Scene,
  model: CompositionModel,
  gradientEnabled: boolean | undefined,
  assetHint: AssetHint | null | undefined,
): Scene {
  if (!scene.scrim) return scene
  if (shouldKeepOverlay(scene, model, gradientEnabled, assetHint)) return scene
  const { scrim: _scrim, ...rest } = scene
  return rest
}

function stripUnexpectedDecor(scene: Scene, gradientEnabled: boolean | undefined): Scene {
  if (!scene.decor || gradientEnabled === true) return scene
  const { decor: _decor, ...rest } = scene
  return rest
}

function shouldKeepOverlay(
  scene: Scene,
  model: CompositionModel,
  gradientEnabled: boolean | undefined,
  assetHint: AssetHint | null | undefined,
): boolean {
  if (model !== 'hero-overlay' || !scene.image) return false
  const textBlocks = [scene.title, scene.subtitle].filter(Boolean) as Array<NonNullable<Scene['title']>>
  const textActuallyOverlapsImage = textBlocks.some((block) => rectsOverlap(block, scene.image!))
  if (!textActuallyOverlapsImage) return false
  if (gradientEnabled === true) return true
  return requiresReadabilityOverlay(textBlocks, assetHint)
}

function requiresReadabilityOverlay(
  textBlocks: Array<NonNullable<Scene['title']>>,
  assetHint: AssetHint | null | undefined,
): boolean {
  if (!assetHint) return false
  const backgroundLum = assetHint.bottomBandBrightness ?? 0.5
  return textBlocks.some((block) => contrastRatioFromLuminance(luminance(block.fill), backgroundLum) < 4.5)
}

function applyReducedContentPolicy(scene: Scene, rules: FormatRuleSet, policy: LayoutPolicy): Scene {
  const out: Scene = { ...scene }
  if (policy.formatKind === 'logoOnly') {
    delete out.decor
    delete out.scrim
    delete out.subtitle
    delete out.cta
    delete out.badge
    delete out.image
  }
  if (policy.formatKind === 'tinySmall') {
    delete out.decor
    delete out.subtitle
    delete out.badge
    const area = rules.width * rules.height
    const micro = rules.width <= 200 || rules.height <= 90 || area <= 30000
    const crowded = Boolean(out.title && out.cta && out.image)
    if (micro || (crowded && !rules.requiredElements.includes('cta'))) delete out.cta
    if (out.image && !out.cta && !rules.requiredElements.includes('image') && rules.aspectRatio < 1.6 && area <= 50000) delete out.image
    if (out.title) {
      const minReadablePct = Math.min(9, (11 / rules.width) * 100)
      out.title = {
        ...out.title,
        text: compactHeadlineText(out.title.text, tinyTitleCharLimit(rules)),
        maxLines: rules.width >= 300 && rules.height >= 240 ? 2 : 1,
        fontSize: Math.max(out.title.fontSize, minReadablePct),
        w: Math.min(out.title.w, rules.aspectRatio >= 1.6 ? 48 : out.image ? 58 : 72),
      }
    }
  }
  for (const kind of policy.hiddenByDefault) delete (out as Record<string, unknown>)[kind]
  return out
}

function applyGeometryPolicy(scene: Scene, rules: FormatRuleSet, policy: LayoutPolicy, model: CompositionModel): Scene {
  if (policy.formatKind === 'logoOnly') return enforceLogoOnly(scene, rules)
  if (isHorizontalKind(policy.formatKind)) return enforceHorizontal(scene, rules, model)
  if (policy.formatKind === 'vertical' || policy.formatKind === 'tallVertical') return enforceVertical(scene, rules)
  if (policy.formatKind === 'square') return enforceSquare(scene, model)
  const compact = enforceTinySmall(scene, rules)
  return rules.aspectRatio >= 1.6 ? enforceHorizontal(compact, rules, model) : compact
}

function enforceHorizontal(scene: Scene, rules: FormatRuleSet, model: CompositionModel): Scene {
  const out: Scene = { ...scene }
  const safe = rules.safeZone
  const left = safe.left
  const right = 100 - safe.right
  const top = safe.top
  const bottom = 100 - safe.bottom
  const innerW = right - left
  const innerH = bottom - top
  const compactActionRow = rules.height <= 300 || rules.aspectRatio >= 3
  const gap = Math.max(2, rules.gutter * 0.7)
  const splitLeft = model === 'split-left-image'
  const hasImageZone = Boolean(out.image && model !== 'text-dominant' && model !== 'centered-card')

  let textLeft = left
  let textRight = right
  if (out.image) {
    if (hasImageZone) {
      const slotW = splitImageSlotWidth(innerW, rules)
      const imageX = splitLeft ? left : right - slotW
      out.image = { ...out.image, x: imageX, y: top, w: slotW, h: innerH, fit: out.image.fit ?? 'cover' }
      if (splitLeft) {
        textLeft = imageX + slotW + gap
      } else {
        textRight = imageX - gap
      }
    } else {
      delete out.image
    }
  }

  const ctaPresent = Boolean(out.cta)
  const ctaW = ctaPresent ? horizontalCtaWidth(textRight - textLeft, rules) : 0
  const ctaH = ctaPresent ? horizontalCtaHeight(rules) : 0
  const actionRow = compactActionRow && ctaPresent
  const ctaGap = actionRow ? gap : 0
  const textW = Math.max(22, textRight - textLeft - (actionRow ? ctaW + ctaGap : 0))
  const titleLines = compactActionRow ? 1 : Math.min(out.title?.maxLines ?? 2, 2)
  const subtitleVisible = Boolean(out.subtitle && !compactActionRow && rules.height >= 340)
  if (out.subtitle && !subtitleVisible) delete out.subtitle

  const subtitleFont = out.subtitle ? fitFontToHeight(out.subtitle.fontSize, rules, innerH * 0.18, 1, 1.18) : 0
  if (out.subtitle) out.subtitle = { ...out.subtitle, x: textLeft, w: textW, fontSize: subtitleFont, maxLines: 1 }

  const subtitleH = out.subtitle ? textHeight(out.subtitle, rules) : 0
  const titleBudget = actionRow
    ? innerH * 0.72
      : compactActionRow
      ? innerH * 0.62
      : Math.max(innerH * 0.28, innerH - subtitleH - (out.subtitle ? gap : 0) - (ctaPresent ? ctaH + gap : 0))
  if (out.title) {
    out.title = {
      ...out.title,
      x: textLeft,
      w: textW,
      maxLines: titleLines,
      fontSize: fitFontToHeight(out.title.fontSize, rules, titleBudget, titleLines, out.title.lineHeight ?? 1.08),
    }
  }

  const titleH = out.title ? textHeight(out.title, rules) : 0
  const stackH = titleH + (out.subtitle ? gap + subtitleH : 0) + (!actionRow && ctaPresent ? gap + ctaH : 0)
  let cursorY = clamp(top + (innerH - stackH) / 2, top, Math.max(top, bottom - stackH))
  const naturalTitleW = actionRow && out.title
    ? (measureTextWidth(
        out.title.text,
        (out.title.fontSize / 100) * rules.width,
        out.title.weight,
        out.title.fontFamily ?? 'Inter, system-ui, sans-serif',
      ) /
        rules.width) *
      100
    : textW
  const actionTitleW = actionRow ? Math.min(textW, Math.max(12, naturalTitleW + gap * 0.55)) : textW
  const ctaX = actionRow ? Math.min(textLeft + actionTitleW + ctaGap, textRight - ctaW) : textLeft
  const titleW = actionRow ? Math.max(12, ctaX - textLeft - ctaGap) : textW
  if (out.title) {
    out.title = { ...out.title, y: cursorY, w: titleW }
    cursorY += titleH
  }
  if (out.subtitle) {
    cursorY += gap
    out.subtitle = { ...out.subtitle, y: cursorY }
    cursorY += subtitleH
  }
  if (out.cta) {
    out.cta = {
      ...out.cta,
      x: actionRow ? ctaX : textLeft,
      y: actionRow ? clamp(top + (innerH - ctaH) / 2, top, bottom - ctaH) : Math.min(bottom - ctaH, cursorY + gap),
      w: ctaW,
      h: ctaH,
      fontSize: fitFontToHeight(out.cta.fontSize, rules, ctaH * 0.55, 1, 1),
      maxLines: 1,
    }
  }
  resolveTitleCtaCollision(out, rules, {
    textLeft,
    textRight,
    top,
    bottom,
    gap,
    actionRow,
    tiny: rules.width <= 340 || rules.height <= 120,
  })
  if (out.logo) out.logo = { ...out.logo, x: right - Math.min(out.logo.w, 8), y: top, w: Math.min(out.logo.w, 8), h: Math.min(out.logo.h ?? 8, 8) }
  return out
}

function enforceVertical(scene: Scene, rules: FormatRuleSet): Scene {
  const out: Scene = { ...scene }
  const safe = rules.safeZone
  const fullTextW = 100 - safe.left - safe.right
  const textW = Math.min(fullTextW, rules.aspectRatio < 0.55 ? 82 : 80)
  const textX = safe.left + Math.max(0, fullTextW - textW) / 2
  const narrow = rules.aspectRatio < 0.55
  const top = safe.top
  const bottom = 100 - safe.bottom
  const imageH = out.image ? clamp(narrow ? 48 : 52, 45, 55) : 0
  const gap = Math.max(1.4, rules.gutter * 0.55)
  const textTop = out.image ? top + imageH + gap : top
  const textBottom = bottom
  const textZoneH = Math.max(1, textBottom - textTop)
  if (out.image) {
    out.image = { ...out.image, x: 0, y: top, w: 100, h: imageH, fit: out.image.fit ?? 'cover' }
  }
  const titleMinPx = clamp(rules.width * (narrow ? 0.06 : 0.052), narrow ? 16 : 18, narrow ? 30 : 34)
  const titleMaxPx = clamp(rules.width * (narrow ? 0.075 : 0.065), narrow ? 24 : 28, narrow ? 42 : 56)
  const subtitleMinPx = clamp(rules.width * 0.033, 13, 20)
  const subtitleMaxPx = clamp(rules.width * 0.04, 16, 24)
  const ctaFontMinPx = clamp(rules.width * 0.035, 12, 18)
  const ctaFontMaxPx = clamp(rules.width * 0.044, 15, 22)
  const ctaHeightPx = clamp(rules.height * (narrow ? 0.055 : 0.048), 34, 52)
  const titleFont = out.title
    ? pxToWidthPct(clamp((out.title.fontSize / 100) * rules.width, titleMinPx, titleMaxPx), rules)
    : 0
  const subtitleFont = out.subtitle
    ? pxToWidthPct(clamp((out.subtitle.fontSize / 100) * rules.width, subtitleMinPx, subtitleMaxPx), rules)
    : 0
  const ctaFont = out.cta
    ? pxToWidthPct(clamp((out.cta.fontSize / 100) * rules.width, ctaFontMinPx, ctaFontMaxPx), rules)
    : 0
  const ctaH = out.cta ? Math.max(out.cta.h ?? 0, pxToHeightPct(ctaHeightPx, rules)) : 0

  let title = out.title
    ? {
        ...out.title,
        x: textX,
        w: textW,
        fontSize: titleFont,
        maxLines: Math.min(out.title.maxLines, narrow ? 2 : 3),
      }
    : undefined
  let subtitle = out.subtitle
    ? {
        ...out.subtitle,
        x: textX,
        w: textW * 0.96,
        fontSize: subtitleFont,
        maxLines: 1,
      }
    : undefined
  let cta = out.cta
    ? {
        ...out.cta,
        x: narrow ? textX + textW * 0.08 : textX,
        w: Math.min(Math.max(out.cta.w, textW * (narrow ? 0.54 : 0.46)), textW * (narrow ? 0.84 : 0.68)),
        h: ctaH,
        fontSize: ctaFont,
        maxLines: 1,
      }
    : undefined

  let stackGap = Math.max(1.2, rules.gutter * 0.45)
  if (stackHeightForBlocks(title, subtitle, cta, rules, stackGap) > textZoneH && subtitle) {
    subtitle = undefined
    stackGap = Math.max(0.9, rules.gutter * 0.35)
  }

  const stackH = stackHeightForBlocks(title, subtitle, cta, rules, stackGap)
  let cursor = clamp(textTop + Math.max(0, textZoneH - stackH) * 0.42, textTop, Math.max(textTop, textBottom - stackH))
  if (title) {
    const titleH = textHeight(title, rules)
    title = { ...title, y: cursor, h: titleH }
    cursor += titleH
  }
  if (subtitle) {
    cursor += stackGap
    const subtitleH = textHeight(subtitle, rules)
    subtitle = { ...subtitle, y: cursor, h: subtitleH }
    cursor += subtitleH
  }
  if (cta) {
    cursor += title || subtitle ? stackGap : 0
    cta = { ...cta, y: cursor }
  }

  if (title) out.title = title
  else delete out.title
  if (subtitle) out.subtitle = subtitle
  else delete out.subtitle
  if (cta) out.cta = cta
  else delete out.cta
  if (out.cta && out.title) {
    const titleBottom = out.title.y + (out.title.h ?? textHeight(out.title, rules))
    out.cta = {
      ...out.cta,
      y: Math.max(out.cta.y, titleBottom + Math.max(1.4, rules.gutter * 0.45)),
    }
  }
  return out
}

function enforceLogoOnly(scene: Scene, rules: FormatRuleSet): Scene {
  const out: Scene = { background: scene.background, accent: scene.accent }
  if (scene.logo?.src) {
    const pad = Math.max(10, Math.min(15, rules.safeZone.left, rules.safeZone.top))
    const maxW = 100 - pad * 2
    const maxH = 100 - pad * 2
    const size = Math.min(maxW, maxH)
    out.logo = {
      ...scene.logo,
      x: (100 - size) / 2,
      y: (100 - size) / 2,
      w: size,
      h: size,
      bgOpacity: scene.logo.bgOpacity ?? 0.92,
    }
  } else if (scene.title?.text.trim()) {
    const label = compactHeadlineText(scene.title.text.replace(/\*\*/g, ''), 18)
    const fontPx = clamp(rules.width * 0.16, 22, 34)
    out.title = {
      ...scene.title,
      text: label,
      x: 12,
      y: 50 - pxToHeightPct(fontPx * 1.15, rules) / 2,
      w: 76,
      h: pxToHeightPct(fontPx * 1.15, rules),
      fontSize: pxToWidthPct(fontPx, rules),
      charsPerLine: 12,
      maxLines: 1,
      align: 'center',
    }
  }
  return out
}

function enforceSquare(scene: Scene, model: CompositionModel): Scene {
  const out: Scene = { ...scene }
  if (out.image && (out.image.w < 32 || (out.image.h ?? 0) < 32)) {
    out.image = { ...out.image, w: Math.max(out.image.w, 38), h: Math.max(out.image.h ?? 38, 38) }
  }
  if (out.title && out.title.w > 78 && model !== 'text-dominant') out.title = { ...out.title, w: 72 }
  if (out.subtitle && out.subtitle.w > 74 && model !== 'text-dominant') out.subtitle = { ...out.subtitle, w: 68 }
  if (out.cta && out.title) out.cta = { ...out.cta, x: out.title.x, w: Math.min(out.cta.w, out.title.w * 0.72) }
  return out
}

function enforceTinySmall(scene: Scene, rules: FormatRuleSet): Scene {
  const out: Scene = { ...scene }
  if (out.image && rules.aspectRatio >= 1.6) {
    const safe = rules.safeZone
    const innerW = 100 - safe.left - safe.right
    const innerH = 100 - safe.top - safe.bottom
    const imageW = splitImageSlotWidth(innerW, rules)
    out.image = { ...out.image, x: 100 - safe.right - imageW, y: safe.top, w: imageW, h: Math.max(out.image.h ?? 0, innerH), fit: out.image.fit ?? 'cover' }
  }
  if (out.logo) out.logo = { ...out.logo, w: Math.min(out.logo.w, 12), h: Math.min(out.logo.h ?? 12, 12) }
  return out
}

function splitImageSlotWidth(innerW: number, rules: FormatRuleSet): number {
  const ratio = rules.aspectRatio >= 6 ? 0.28 : rules.aspectRatio >= 4 ? 0.32 : rules.aspectRatio >= 2.2 ? 0.34 : 0.5
  const minW = rules.aspectRatio >= 6 ? 24 : rules.aspectRatio >= 4 ? 28 : rules.aspectRatio >= 2.2 ? 33 : 45
  const maxW = rules.aspectRatio >= 6 ? 35 : rules.aspectRatio >= 4 ? 38 : rules.aspectRatio >= 2.2 ? 42 : 55
  return Math.min(maxW, Math.max(minW, innerW * ratio))
}

function isHorizontalKind(kind: LayoutPolicyFormatKind): boolean {
  return kind === 'horizontal' || kind === 'lowHorizontal' || kind === 'ultraWideHorizontal'
}

function isLogoFormat(rules: FormatRuleSet): boolean {
  const searchable = `${String(rules.key)} ${rules.id ?? ''} ${rules.label ?? ''} ${rules.placementName ?? ''} ${rules.placementGroup ?? ''}`.toLowerCase()
  return rules.requiredElements.includes('logo') || searchable.includes('logo')
}

function tinyTitleCharLimit(rules: FormatRuleSet): number {
  if (rules.width <= 160 || rules.height <= 90) return 22
  if (rules.height <= 120) return 22
  return 26
}

function compactHeadlineText(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const suffix = '...'
  const budget = Math.max(1, maxChars - suffix.length)
  const words = clean.split(/\s+/)
  let out = ''
  for (const word of words) {
    const next = out ? `${out} ${word}` : word
    if (next.length > budget) break
    out = next
  }
  return `${(out || clean.slice(0, budget)).trim()}${suffix}`
}

function horizontalCtaWidth(textZoneW: number, rules: FormatRuleSet): number {
  if (rules.aspectRatio >= 3) return Math.min(24, Math.max(16, textZoneW * 0.32))
  return Math.min(34, Math.max(18, textZoneW * 0.48))
}

function horizontalCtaHeight(rules: FormatRuleSet): number {
  const maxPx = rules.aspectRatio >= 3
    ? (rules.height <= 120 ? Math.min(38, rules.height * 0.5) : Math.min(64, Math.max(44, rules.height * 0.2)))
    : Math.min(52, rules.height * 0.28)
  const minPx = Math.min(maxPx, rules.height < 140 ? 24 : 30)
  return (Math.max(minPx, maxPx) / rules.height) * 100
}

function fitFontToHeight(fontSize: number, rules: FormatRuleSet, heightPct: number, lines: number, lineHeight: number): number {
  const minPct = ((rules.minFontSize ?? 11) / rules.width) * 100
  const maxByHeight = heightPct / Math.max(0.1, lineHeight * Math.max(1, lines) * rules.aspectRatio)
  return Math.max(minPct, Math.min(fontSize, maxByHeight, rules.aspectRatio >= 3 ? 5.2 : 5.8))
}

function resolveTitleCtaCollision(
  scene: Scene,
  rules: FormatRuleSet,
  options: { textLeft: number; textRight: number; top: number; bottom: number; gap: number; actionRow: boolean; tiny: boolean },
): void {
  if (!scene.title || !scene.cta) return
  const titleRect = { ...scene.title, h: scene.title.h ?? textHeight(scene.title, rules) }
  const ctaRect = { ...scene.cta, h: scene.cta.h ?? textHeight(scene.cta, rules) }
  if (!rectsOverlap(titleRect, ctaRect)) return

  const stackedY = titleRect.y + titleRect.h + options.gap
  const fitsBelow = stackedY + ctaRect.h <= options.bottom
  if (fitsBelow && !options.actionRow) {
    scene.cta = { ...scene.cta, x: options.textLeft, y: stackedY, w: Math.min(scene.cta.w, options.textRight - options.textLeft) }
    return
  }

  if (options.tiny) {
    delete scene.cta
    return
  }

  if (fitsBelow) {
    scene.cta = { ...scene.cta, x: options.textLeft, y: stackedY, w: Math.min(scene.cta.w, options.textRight - options.textLeft) }
  } else {
    scene.layoutPolicy = {
      ...scene.layoutPolicy,
      formatKind: scene.layoutPolicy?.formatKind ?? classifyPolicyFormat(rules),
      source: scene.layoutPolicy?.source ?? POLICY_SOURCE,
      appliedRules: [...(scene.layoutPolicy?.appliedRules ?? ['demo-safe-layout-policy']), 'title-cta-collision-needs-fix'],
      needsManualReview: true,
    }
  }
}

function stackHeightForBlocks(
  title: { fontSize: number; maxLines: number; lineHeight?: number; h?: number } | undefined,
  subtitle: { fontSize: number; maxLines: number; lineHeight?: number; h?: number } | undefined,
  cta: { h?: number } | undefined,
  rules: FormatRuleSet,
  gap: number,
): number {
  const parts = [title ? title.h ?? textHeight(title, rules) : 0, subtitle ? subtitle.h ?? textHeight(subtitle, rules) : 0, cta ? cta.h ?? 0 : 0].filter((h) => h > 0)
  return parts.reduce((sum, h) => sum + h, 0) + Math.max(0, parts.length - 1) * gap
}

function pxToWidthPct(px: number, rules: FormatRuleSet): number {
  return (px / rules.width) * 100
}

function pxToHeightPct(px: number, rules: FormatRuleSet): number {
  return (px / rules.height) * 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h?: number; fontSize?: number; maxLines?: number; lineHeight?: number },
  b: { x: number; y: number; w: number; h?: number },
): boolean {
  const aH = a.h ?? Math.max(4, (a.fontSize ?? 3) * (a.lineHeight ?? 1.15) * Math.max(1, a.maxLines ?? 1))
  const bH = b.h ?? 0
  return a.x + a.w > b.x && b.x + b.w > a.x && a.y + aH > b.y && b.y + bH > a.y
}

function markManualReview(scene: Scene, rules: FormatRuleSet, policy: LayoutPolicy): Scene {
  const warnings = checkOverflow(scene, rules).filter((issue) => issue.level === 'warn')
  const missingRequired = requiredElementsForPolicy(rules, policy).filter((kind) => !scene[kind])
  const needsManualReview = warnings.length > 0 || missingRequired.length > 0
  if (!needsManualReview) {
    return {
      ...scene,
      layoutPolicy: {
        formatKind: policy.formatKind,
        source: policy.source,
        appliedRules: ['demo-safe-layout-policy'],
      },
    }
  }
  return {
    ...scene,
    layoutPolicy: {
      formatKind: policy.formatKind,
      source: policy.source,
      appliedRules: ['demo-safe-layout-policy', 'manual-review-fallback'],
      needsManualReview: true,
      requiresManualCorrection: missingRequired.length > 0,
    },
  }
}

function textHeight(block: { fontSize: number; maxLines: number; lineHeight?: number }, rules: FormatRuleSet): number {
  return block.fontSize * (block.lineHeight ?? 1.15) * Math.max(1, block.maxLines) * rules.aspectRatio
}

function requiredElementsForPolicy(rules: FormatRuleSet, policy: LayoutPolicy): BlockKind[] {
  if (policy.formatKind === 'logoOnly') {
    return rules.requiredElements.includes('logo') ? ['logo'] : []
  }
  return rules.requiredElements.filter((kind) => {
    if (kind === 'subtitle' || kind === 'badge') return false
    if (kind === 'cta' && policy.formatKind === 'tinySmall') return false
    return true
  })
}
