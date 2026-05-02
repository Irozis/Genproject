// Local-only optimizer for a single positioned Scene.
// Does NOT change composition model. Only nudges sizes/colors to fix readability.

import { luminance } from './color'
import { isBannerCopyFormat } from './formatCopy'
import { fitFontSize, wrapText } from './textMeasure'
import type { Background, BlockKind, FormatRuleSet, Scene, TextBlock } from './types'

export type LayoutIssue = {
  /** Which block the issue relates to. `null` when not tied to a specific one. */
  block: BlockKind | null
  /** Short human-readable message for the tooltip list. */
  message: string
  /** Severity used to pick a color / icon in the UI. */
  level: 'warn' | 'info'
}

export function fixLayout(scene: Scene, rules: FormatRuleSet): Scene {
  const sz = rules.safeZone
  const out: Scene = { background: scene.background, accent: scene.accent }
  if (scene.scrim) out.scrim = scene.scrim
  if (scene.decor) out.decor = scene.decor

  // Same 0.5% tolerance as checkOverflow so the two never disagree on edge
  // cases (a freshly clamped block must not flag a "crosses safe area" warning).
  const SAFE_TOLERANCE = 0.5
  for (const k of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const b = scene[k]
    if (!b) continue
    const x = clamp(b.x, sz.left, 100 - sz.right - SAFE_TOLERANCE)
    const w = clamp(Math.min(b.w, 100 - sz.right - x), SAFE_TOLERANCE, 100)
    // Keep the full block (including implicit text height) inside the safe zone.
    const h = b.h ?? estimateTextHeight(b as TextBlock, rules)
    const maxY = Math.max(sz.top, 100 - sz.bottom - h)
    const y = clamp(b.y, sz.top, maxY)
    const clamped = { ...b, x, y, w }
    ;(out as Record<string, unknown>)[k] = maybeShrinkTextToBounds(k, clamped, rules)
  }

  // text contrast against approximate background color
  const bgApprox = approxBackgroundColor(scene.background)
  if (out.title && isLowContrast(out.title.fill, bgApprox)) {
    out.title = { ...out.title, fill: invertReadable(bgApprox) }
  }
  if (out.subtitle && isLowContrast(out.subtitle.fill, bgApprox)) {
    out.subtitle = { ...out.subtitle, fill: invertReadable(bgApprox) }
  }
  return out
}

function maybeShrinkTextToBounds(
  kind: BlockKind,
  block: Scene[BlockKind],
  rules: FormatRuleSet,
): Scene[BlockKind] {
  if (!block || !isTextNode(kind, block)) return block
  const t = block as TextBlock & { type?: string }
  if (!t.text?.trim()) return t
  if (!t.h || t.h <= 0) return t

  const widthPx = (t.w / 100) * rules.width
  const heightPx = (t.h / 100) * rules.height
  if (widthPx <= 0 || heightPx <= 0) return t

  const basePx = (t.fontSize / 100) * rules.width
  const minPx = 12
  if (basePx <= minPx) return t

  const lineHeight = t.lineHeight ?? 1.2
  const doesFit = (fontSizePx: number): boolean => {
    const lines = wrapText({
      text: t.text,
      fontSizePx,
      fontWeight: t.weight,
      fontFamily: 'Inter, Arial, sans-serif',
      maxWidthPx: widthPx,
      maxLines: t.maxLines,
    })
    if (lines.length === 0) return true
    const hasEllipsis = (lines[lines.length - 1] ?? '').endsWith('…')
    if (hasEllipsis) return false
    const textHeightPx = fontSizePx * lineHeight * lines.length
    return textHeightPx <= heightPx
  }

  const fittedPx = fitFontSize({
    baseFontSizePx: basePx,
    minFontSizePx: minPx,
    fits: doesFit,
  })
  const fittedPct = (fittedPx / rules.width) * 100
  return fittedPct < t.fontSize ? { ...t, fontSize: Math.max((minPx / rules.width) * 100, fittedPct) } : t
}

function isTextNode(kind: BlockKind, block: Scene[BlockKind]): boolean {
  const runtimeType = (block as { type?: string } | undefined)?.type
  if (runtimeType !== undefined) return runtimeType === 'text'
  return kind === 'title' || kind === 'subtitle' || kind === 'cta' || kind === 'badge'
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function isLowContrast(fg: string, bg: string): boolean {
  return Math.abs(luminance(fg) - luminance(bg)) < 0.25
}

function invertReadable(bg: string): string {
  return luminance(bg) > 0.5 ? '#111111' : '#FFFFFF'
}

function approxBackgroundColor(bg: Background): string {
  if (bg.kind === 'gradient') return bg.stops[1]
  if (bg.kind === 'solid') return bg.color
  if (bg.kind === 'tonal') return bg.base
  // split: average is ambiguous; pick the a-side as representative
  return bg.a
}

// ---------------------------------------------------------------------------
// checkOverflow — pure diagnostic over a positioned Scene.
// Reports issues the user can fix (or one-click Fix resolves). Renderer side
// stays unchanged; this is read-only.
// ---------------------------------------------------------------------------

export function checkOverflow(scene: Scene, rules: FormatRuleSet): LayoutIssue[] {
  const sz = rules.safeZone
  const issues: LayoutIssue[] = []

  const kinds: BlockKind[] = ['title', 'subtitle', 'cta', 'badge', 'logo', 'image']
  for (const k of kinds) {
    const b = scene[k]
    if (!b) continue
    const imageIsIntentionalBleed = k === 'image' && isIntentionalImageBleed(scene, rules)
    const h = b.h ?? estimateTextHeight(b as TextBlock, rules)
    const right = b.x + b.w
    const bottom = b.y + h

    if (!imageIsIntentionalBleed && b.x < sz.left - 0.5) {
      issues.push({ block: k, message: `${label(k)} crosses left safe area`, level: 'warn' })
    }
    if (!imageIsIntentionalBleed && right > 100 - sz.right + 0.5) {
      issues.push({ block: k, message: `${label(k)} crosses right safe area`, level: 'warn' })
    }
    if (!imageIsIntentionalBleed && b.y < sz.top - 0.5) {
      issues.push({ block: k, message: `${label(k)} crosses top safe area`, level: 'warn' })
    }
    if (!imageIsIntentionalBleed && bottom > 100 - sz.bottom + 0.5) {
      issues.push({ block: k, message: `${label(k)} below fold (safe area)`, level: 'warn' })
    }
  }

  // Text-likely-truncated: rough check — title maxLines=1 but text is very long
  // for the block width at the configured fontSize. Uses the charsPerLine
  // heuristic baked into text blocks (approximate, cheap).
  for (const k of ['title', 'subtitle', 'cta', 'badge'] as const) {
    const t = scene[k] as TextBlock | undefined
    if (!t) continue
    const words = t.text.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    const approxChars = t.text.length
    const capacity = Math.max(1, t.charsPerLine * t.maxLines)
    if (approxChars > capacity * 1.25) {
      issues.push({
        block: k,
        message: `${label(k)} text likely truncated (${approxChars}/${capacity} chars)`,
        level: 'info',
      })
    }
  }

  // Block overlap among text + cta + badge. Image + logo skipped since layouts
  // intentionally overlay these on the background.
  const rectKinds: BlockKind[] = ['title', 'subtitle', 'cta', 'badge']
  for (let i = 0; i < rectKinds.length; i++) {
    for (let j = i + 1; j < rectKinds.length; j++) {
      const ki = rectKinds[i]!
      const kj = rectKinds[j]!
      const a = scene[ki]
      const b = scene[kj]
      if (!a || !b) continue
      const ar = { ...a, h: a.h ?? estimateTextHeight(a as TextBlock, rules) }
      const br = { ...b, h: b.h ?? estimateTextHeight(b as TextBlock, rules) }
      if (rectsOverlap(ar, br)) {
        issues.push({
          block: ki,
          message: `${label(ki)} overlaps ${label(kj)}`,
          level: 'warn',
        })
      }
    }
  }

  // Low text contrast vs approximate background. fixLayout already corrects
  // title; here we flag subtitle + cta too.
  const bgApprox = approxBackgroundColor(scene.background)
  if (!scene.scrim) {
    for (const k of ['title', 'subtitle'] as const) {
      const t = scene[k] as TextBlock | undefined
      if (!t) continue
      if (isLowContrast(t.fill, bgApprox)) {
        issues.push({ block: k, message: `${label(k)} low contrast vs background`, level: 'warn' })
      }
    }
  }
  if (scene.cta && isLowContrast(scene.cta.fill, scene.cta.bg)) {
    issues.push({ block: 'cta', message: 'Cta low contrast vs button fill', level: 'warn' })
  }

  const smallAd = isSmallAdFormat(rules)
  if (smallAd) {
    const cta = scene.cta
    if (cta) {
      const ctaWidthPx = (cta.w / 100) * rules.width
      const ctaHeightPx = ((cta.h ?? estimateTextHeight(cta, rules)) / 100) * rules.height
      const ctaFontPx = (cta.fontSize / 100) * rules.width
      if (ctaWidthPx < 92 || ctaHeightPx < 32 || ctaFontPx < 11) {
        issues.push({ block: 'cta', message: 'Cta too small for ad format', level: 'warn' })
      }
    }

    for (const k of ['title', 'subtitle'] as const) {
      const t = scene[k] as TextBlock | undefined
      if (!t?.text.trim()) continue
      const compactLimit = k === 'title' ? (rules.aspectRatio > 4 ? 32 : 42) : (rules.aspectRatio > 4 ? 34 : 46)
      if (stripMarkup(t.text).length > compactLimit) {
        issues.push({ block: k, message: `${label(k)} too long for small ad format`, level: 'info' })
      }
    }
  }

  if (smallAd && scene.title && scene.cta) {
    const titlePx = scene.title.fontSize * rules.width / 100
    const ctaPx = scene.cta.fontSize * rules.width / 100
    const ctaArea = scene.cta.w * (scene.cta.h ?? estimateTextHeight(scene.cta, rules))
    if (ctaPx < titlePx * 0.42 || ctaArea < scene.title.w * estimateTextHeight(scene.title, rules) * 0.2) {
      issues.push({ block: 'cta', message: 'Cta weak hierarchy vs headline', level: 'info' })
    }
  }

  // Banner family — gentler limits than smallAd, because these formats have
  // more horizontal real estate but still need a poster-style hook.
  if (!smallAd && isBannerCopyFormat(rules.key)) {
    for (const k of ['title', 'subtitle'] as const) {
      const t = scene[k] as TextBlock | undefined
      if (!t?.text.trim()) continue
      const limit = k === 'title' ? 48 : 60
      if (stripMarkup(t.text).length > limit) {
        issues.push({ block: k, message: `${label(k)} too long for banner format`, level: 'info' })
      }
    }
  }

  if (scene.image && !scene.scrim) {
    for (const k of ['title', 'subtitle'] as const) {
      const t = scene[k] as TextBlock | undefined
      if (!t || t.halo) continue
      const textRect = { ...t, h: t.h ?? estimateTextHeight(t, rules) }
      if (rectsOverlap(textRect, scene.image)) {
        issues.push({ block: k, message: `${label(k)} sits on image without scrim`, level: 'info' })
      }
    }
  }

  return issues
}

function isSmallAdFormat(rules: FormatRuleSet): boolean {
  return rules.width <= 320 || rules.height <= 400 || rules.aspectRatio > 4 || rules.key === 'avito-skyscraper'
}

function isIntentionalImageBleed(scene: Scene, rules: FormatRuleSet): boolean {
  const image = scene.image
  if (!image) return false
  const fullBleed = image.x <= 0.5 && image.y <= 0.5 && image.w >= 99 && (image.h ?? 0) >= 99
  const topBleedCard = image.x <= 0.5 && image.y <= 0.5 && image.w >= 99 && (image.h ?? 0) >= 45 && rules.aspectRatio < 1
  return fullBleed || topBleedCard
}

function stripMarkup(text: string): string {
  return text.replace(/\*\*/g, '').trim()
}

function estimateTextHeight(t: TextBlock, rules: FormatRuleSet): number {
  // fontSize is % of format width, while y/h are % of format height.
  // Convert through aspectRatio so portrait formats aren't overestimated and
  // wide banners aren't underestimated.
  const lh = t.lineHeight ?? 1.2
  return t.fontSize * lh * estimateActualLines(t) * rules.aspectRatio
}

function estimateActualLines(t: TextBlock): number {
  const text = t.text.replace(/\*\*/g, '').trim()
  if (!text) return 1
  const capacity = Math.max(1, t.charsPerLine)
  const maxLines = Math.max(1, t.maxLines)
  const words = text.split(/\s+/).filter(Boolean)
  let lines = 1
  let used = 0
  for (const word of words) {
    const next = used === 0 ? word.length : used + 1 + word.length
    if (next > capacity) {
      lines += 1
      used = word.length
      if (lines >= maxLines) return maxLines
    } else {
      used = next
    }
  }
  return Math.min(maxLines, lines)
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h?: number },
  b: { x: number; y: number; w: number; h?: number },
): boolean {
  const ah = a.h ?? 6
  const bh = b.h ?? 6
  const pad = 0.3
  return (
    a.x + a.w - pad > b.x &&
    b.x + b.w - pad > a.x &&
    a.y + ah - pad > b.y &&
    b.y + bh - pad > a.y
  )
}

function label(k: BlockKind): string {
  return k.charAt(0).toUpperCase() + k.slice(1)
}
