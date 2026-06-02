import { contrastRatioFromLuminance, luminance } from './color'
import { checkOverflow } from './fixLayout'
import type { AssetHint, BlockKind, CompositionModel, FormatRuleSet, RuleSource, Scene } from './types'

export type LayoutPolicyFormatKind = 'tinySmall' | 'horizontal' | 'ultraWideHorizontal' | 'vertical' | 'square' | 'landscape' | 'tallVertical'

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
  if (rules.aspectRatio >= 2.2) return 'ultraWideHorizontal'
  if (rules.aspectRatio >= 1.6) return 'horizontal'
  if (rules.aspectRatio < 0.55) return 'tallVertical'
  if (rules.width < 400 || rules.height < 180 || area < 90000) return 'tinySmall'
  if (rules.aspectRatio <= 0.75) return 'vertical'
  if (rules.aspectRatio >= 0.85 && rules.aspectRatio <= 1.2) return 'square'
  if (rules.aspectRatio < 0.85) return 'vertical'
  return 'landscape'
}

export function getLayoutPolicy(rules: FormatRuleSet, hasImage: boolean): LayoutPolicy {
  const formatKind = classifyPolicyFormat(rules)
  if (isHorizontalKind(formatKind)) {
    return {
      formatKind,
      preferredComposition: hasImage ? 'split-right-image' : 'text-dominant',
      allowedCompositions: ['split-right-image', 'split-left-image', 'product-card-safe', 'centered-card', 'text-dominant'],
      allowGradient: false,
      source: POLICY_SOURCE,
      hiddenByDefault: formatKind === 'ultraWideHorizontal' || rules.height <= 300 ? ['subtitle', 'badge'] : [],
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
  if (policy.formatKind === 'tinySmall') {
    delete out.decor
    delete out.subtitle
    delete out.badge
    if (rules.width <= 200 || rules.height <= 90) delete out.cta
    if (out.title) {
      const minReadablePct = Math.min(9, (11 / rules.width) * 100)
      out.title = {
        ...out.title,
        text: compactHeadlineText(out.title.text, tinyTitleCharLimit(rules)),
        maxLines: 1,
        fontSize: Math.max(out.title.fontSize, minReadablePct),
        w: Math.min(out.title.w, rules.aspectRatio >= 1.6 ? 48 : 72),
      }
    }
  }
  for (const kind of policy.hiddenByDefault) delete (out as Record<string, unknown>)[kind]
  return out
}

function applyGeometryPolicy(scene: Scene, rules: FormatRuleSet, policy: LayoutPolicy, model: CompositionModel): Scene {
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
  const ultra = rules.aspectRatio >= 2.2
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
  const ctaInline = ultra && ctaPresent
  const ctaGap = ctaInline ? gap : 0
  const textW = Math.max(22, textRight - textLeft - (ctaInline ? ctaW + ctaGap : 0))
  const titleLines = ultra ? 1 : Math.min(out.title?.maxLines ?? 2, 2)
  const subtitleVisible = Boolean(out.subtitle && !ultra && rules.height >= 360)
  if (out.subtitle && !subtitleVisible) delete out.subtitle

  const subtitleFont = out.subtitle ? fitFontToHeight(out.subtitle.fontSize, rules, innerH * 0.18, 1, 1.18) : 0
  if (out.subtitle) out.subtitle = { ...out.subtitle, x: textLeft, w: textW, fontSize: subtitleFont, maxLines: 1 }

  const subtitleH = out.subtitle ? textHeight(out.subtitle, rules) : 0
  const titleBudget = ctaInline
    ? innerH * 0.72
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
  const stackH = titleH + (out.subtitle ? gap + subtitleH : 0) + (!ctaInline && ctaPresent ? gap + ctaH : 0)
  let cursorY = clamp(top + (innerH - stackH) / 2, top, Math.max(top, bottom - stackH))
  if (out.title) {
    out.title = { ...out.title, y: cursorY }
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
      x: ctaInline ? textRight - ctaW : textLeft,
      y: ctaInline ? clamp(top + (innerH - ctaH) / 2, top, bottom - ctaH) : Math.min(bottom - ctaH, cursorY + gap),
      w: ctaW,
      h: ctaH,
      fontSize: fitFontToHeight(out.cta.fontSize, rules, ctaH * 0.55, 1, 1),
      maxLines: 1,
    }
  }
  if (out.logo) out.logo = { ...out.logo, x: right - Math.min(out.logo.w, 8), y: top, w: Math.min(out.logo.w, 8), h: Math.min(out.logo.h ?? 8, 8) }
  return out
}

function enforceVertical(scene: Scene, rules: FormatRuleSet): Scene {
  const out: Scene = { ...scene }
  const safe = rules.safeZone
  const textW = 100 - safe.left - safe.right
  if (out.image && out.image.y > 18 && out.image.h && out.image.h < 45) {
    out.image = { ...out.image, x: 0, y: 0, w: 100, h: Math.max(48, out.image.h), fit: out.image.fit ?? 'cover' }
  }
  if (out.title) out.title = { ...out.title, x: safe.left, w: textW, maxLines: Math.min(out.title.maxLines, 3) }
  if (out.subtitle) out.subtitle = { ...out.subtitle, x: safe.left, w: textW, maxLines: Math.min(out.subtitle.maxLines, 2) }
  if (out.cta && out.title) {
    const titleBottom = out.title.y + textHeight(out.title, rules)
    out.cta = { ...out.cta, x: safe.left, y: Math.max(out.cta.y, titleBottom + Math.max(1.4, rules.gutter * 0.45)), w: Math.min(out.cta.w, textW * 0.62) }
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
  const ratio = rules.aspectRatio >= 6 ? 0.28 : rules.aspectRatio >= 4 ? 0.34 : 0.45
  const minW = rules.aspectRatio >= 6 ? 24 : rules.aspectRatio >= 4 ? 30 : 40
  const maxW = rules.aspectRatio >= 6 ? 36 : 55
  return Math.min(maxW, Math.max(minW, innerW * ratio))
}

function isHorizontalKind(kind: LayoutPolicyFormatKind): boolean {
  return kind === 'horizontal' || kind === 'ultraWideHorizontal'
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
  if (rules.aspectRatio >= 2.2) return Math.min(22, Math.max(14, textZoneW * 0.28))
  return Math.min(34, Math.max(18, textZoneW * 0.48))
}

function horizontalCtaHeight(rules: FormatRuleSet): number {
  const maxPx = rules.aspectRatio >= 2.2
    ? (rules.height <= 120 ? Math.min(34, rules.height * 0.45) : Math.min(44, rules.height * 0.44))
    : Math.min(52, rules.height * 0.28)
  const minPx = Math.min(maxPx, rules.height < 140 ? 24 : 30)
  return (Math.max(minPx, maxPx) / rules.height) * 100
}

function fitFontToHeight(fontSize: number, rules: FormatRuleSet, heightPct: number, lines: number, lineHeight: number): number {
  const minPct = ((rules.minFontSize ?? 11) / rules.width) * 100
  const maxByHeight = heightPct / Math.max(0.1, lineHeight * Math.max(1, lines) * rules.aspectRatio)
  return Math.max(minPct, Math.min(fontSize, maxByHeight, rules.aspectRatio >= 2.2 ? 5.2 : 5.8))
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
  const missingRequired = rules.requiredElements.filter((kind) => kind !== 'subtitle' && kind !== 'badge' && !scene[kind])
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
