// "Apply this format's layout to other formats" — rule of thumb:
// preserve which edge each block is anchored to, not the literal x/y%.
// A title sitting 6% from the left edge in a 1080×1080 square should still
// sit 6% from the *target* safe-zone left edge in a 1080×1920 story, not at
// the same absolute %, which would land it in a different visual relation
// to the canvas.
//
// Algorithm per block:
//   1. Decide the X anchor from the source: 'left' if closer to source's
//      left safe edge, 'right' if closer to right, otherwise 'center'.
//   2. Same for Y: 'top' / 'bottom' / 'middle'.
//   3. In the target, place the block so the same edge offsets are preserved:
//      'left' → x = targetSafeLeft + sourceLeftOffset, etc.
//      'center' / 'middle' → keep block centered on the target axis.
//   4. Width/height are already canvas-relative %, so they carry over as-is,
//      but get clamped to fit inside the target safe zone (so a 70%-wide
//      title from a square doesn't overflow a narrow 240×400 vertical ad).
//   5. Final safety clamp keeps everything inside the target safe zone.
//
// Pure function — no side effects, deterministic. Easy to unit-test.

import type { BlockKind, BlockOverride, FormatRuleSet } from './types'

type Box = { x: number; y: number; w: number; h: number }
type Anchor = 'left' | 'right' | 'center' | 'top' | 'bottom' | 'middle'

const TOLERANCE = 1.5 // % — within 1.5% of an edge counts as "anchored to it"

/**
 * Translate a single block override from the source format's coordinate
 * space into the target format's coordinate space, preserving edge anchors
 * and clamping into the target safe zone.
 */
export function projectBlockOverride(
  source: BlockOverride,
  sourceRules: FormatRuleSet,
  targetRules: FormatRuleSet,
  defaultH: number,
): BlockOverride {
  const box = sourceBox(source, defaultH)
  if (!box) return { ...source }

  const xAnchor = pickXAnchor(box, sourceRules)
  const yAnchor = pickYAnchor(box, sourceRules)

  // Width/height are %-of-canvas in the same axis — they translate directly,
  // but get capped to the target inner area so they don't blow past the safe
  // zone. We never *grow* dimensions when transferring; only shrink.
  const targetInnerW = 100 - targetRules.safeZone.left - targetRules.safeZone.right
  const targetInnerH = 100 - targetRules.safeZone.top - targetRules.safeZone.bottom
  const w = Math.min(box.w, targetInnerW)
  const h = Math.min(box.h, targetInnerH)

  const x = placeOnAxis(
    xAnchor,
    box.x,
    box.w,
    sourceRules.safeZone.left,
    100 - sourceRules.safeZone.right,
    targetRules.safeZone.left,
    100 - targetRules.safeZone.right,
    w,
  )
  const y = placeOnAxis(
    yAnchor,
    box.y,
    box.h,
    sourceRules.safeZone.top,
    100 - sourceRules.safeZone.bottom,
    targetRules.safeZone.top,
    100 - targetRules.safeZone.bottom,
    h,
  )

  // Final safety clamp — the placement above already aims for inside-safe,
  // but rounding + an oversized w can still nudge things over.
  const xClamped = clamp(x, targetRules.safeZone.left, 100 - targetRules.safeZone.right - w)
  const yClamped = clamp(y, targetRules.safeZone.top, 100 - targetRules.safeZone.bottom - h)

  const out: BlockOverride = {
    ...source,
    x: round(xClamped),
    y: round(yClamped),
    w: round(w),
  }
  // Only emit `h` if the source actually had one — text blocks usually don't,
  // and forcing one would freeze their auto-grow behaviour.
  if (source.h !== undefined) out.h = round(h)
  return out
}

/**
 * Project a whole per-format overrides record from source format to target.
 * Use this when the user clicks "apply this layout to other formats".
 */
export function projectOverrides(
  source: Partial<Record<BlockKind, BlockOverride>>,
  sourceRules: FormatRuleSet,
  targetRules: FormatRuleSet,
): Partial<Record<BlockKind, BlockOverride>> {
  const out: Partial<Record<BlockKind, BlockOverride>> = {}
  for (const k of Object.keys(source) as BlockKind[]) {
    const block = source[k]
    if (!block) continue
    out[k] = projectBlockOverride(block, sourceRules, targetRules, defaultH(k))
  }
  return out
}

function sourceBox(source: BlockOverride, defaultBlockH: number): Box | null {
  const x = typeof source.x === 'number' ? source.x : null
  const y = typeof source.y === 'number' ? source.y : null
  const w = typeof source.w === 'number' ? source.w : null
  if (x === null || y === null || w === null) return null
  const h = typeof source.h === 'number' ? source.h : defaultBlockH
  return { x, y, w, h }
}

function pickXAnchor(box: Box, rules: FormatRuleSet): Anchor {
  const safeLeft = rules.safeZone.left
  const safeRight = 100 - rules.safeZone.right
  const dLeft = Math.max(0, box.x - safeLeft)
  const dRight = Math.max(0, safeRight - (box.x + box.w))
  // Centered if both edges have similar offsets (within tolerance) AND the
  // block is comfortably away from both edges — otherwise call the closer edge.
  if (Math.abs(dLeft - dRight) <= TOLERANCE && dLeft > TOLERANCE) return 'center'
  return dLeft <= dRight ? 'left' : 'right'
}

function pickYAnchor(box: Box, rules: FormatRuleSet): Anchor {
  const safeTop = rules.safeZone.top
  const safeBottom = 100 - rules.safeZone.bottom
  const dTop = Math.max(0, box.y - safeTop)
  const dBottom = Math.max(0, safeBottom - (box.y + box.h))
  if (Math.abs(dTop - dBottom) <= TOLERANCE && dTop > TOLERANCE) return 'middle'
  return dTop <= dBottom ? 'top' : 'bottom'
}

function placeOnAxis(
  anchor: Anchor,
  sourcePos: number,
  _sourceSize: number,
  sourceSafeStart: number,
  sourceSafeEnd: number,
  targetSafeStart: number,
  targetSafeEnd: number,
  targetSize: number,
): number {
  if (anchor === 'left' || anchor === 'top') {
    const offset = sourcePos - sourceSafeStart
    return targetSafeStart + Math.max(0, offset)
  }
  if (anchor === 'right' || anchor === 'bottom') {
    // Source: how far the block's far edge sits from the source's far safe edge.
    const offsetFromFar = sourceSafeEnd - (sourcePos + _sourceSize)
    return targetSafeEnd - targetSize - Math.max(0, offsetFromFar)
  }
  // center / middle
  return (targetSafeStart + targetSafeEnd) / 2 - targetSize / 2
}

function defaultH(kind: BlockKind): number {
  if (kind === 'image') return 50
  if (kind === 'logo') return 6
  if (kind === 'cta') return 7
  return 12
}

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return lo
  return Math.max(lo, Math.min(hi, v))
}

function round(v: number): number {
  return Math.round(v * 100) / 100
}
