// "Which other formats look most like the one I'm editing?" — used by the
// "Apply layout to other formats" dialog to pre-select sensible targets and
// to mark them visually so the user doesn't have to eyeball every preview.
//
// Heuristic: a format is similar to the source if (a) its aspect ratio is
// close, (b) it lives on the same platform, and (c) its safe-zone is near.
// Aspect ratio is the dominant signal — a story-shaped layout transferred
// onto a square or banner needs heavy rework, while two square formats with
// different safe-zones usually carry over with only minor clipping.
//
// Pure module: takes shapes, returns numbers + labels. Easy to unit-test.

import { getFormat } from './formats'
import { groupOf, type FormatGroupId } from './formatGroups'
import type { FormatKey, FormatRuleSet } from './types'

export type RecommendationLevel = 'high' | 'medium' | 'low'

export type FormatRecommendation = {
  key: FormatKey
  score: number
  level: RecommendationLevel
  /** Human-readable reasons in Russian, used as tooltip / badge tooltip. */
  reasons: string[]
}

/**
 * Score how well a layout copies from `source` to `target` on a 0..1 scale.
 *
 * Weights:
 *   - aspect ratio similarity (40%) — log-symmetric so 1:2 vs 2:1 score the
 *     largest possible distance, which is what we want: propagating a
 *     vertical layout onto a horizontal one almost never preserves intent.
 *   - shape-category bonus (20%) — story↔story / square↔square / etc. carry
 *     over even across platforms, so this nudge keeps cross-platform
 *     "same shape" pairs in the recommended bucket.
 *   - platform match (20%) — same platform usually means same brand
 *     conventions and similar safe-zone treatment.
 *   - safe-zone proximity (20%) — small differences (a few %) are forgiven;
 *     wildly different safe-zones (story vs banner) drop this contribution
 *     to zero.
 */
export function formatSimilarityScore(
  source: FormatRuleSet,
  target: FormatRuleSet,
  sameGroup: boolean,
): number {
  const arDelta = Math.abs(Math.log(source.aspectRatio) - Math.log(target.aspectRatio))
  // log(2) ≈ 0.69 — i.e. a 2× ratio difference (1:1 vs 1:2) drops AR sim
  // to zero. Smaller deltas decay linearly.
  const arSim = Math.max(0, 1 - arDelta / Math.log(2))

  const sameShape = shapeCategory(source.aspectRatio) === shapeCategory(target.aspectRatio)

  const safeDelta =
    Math.abs(source.safeZone.top - target.safeZone.top) +
    Math.abs(source.safeZone.right - target.safeZone.right) +
    Math.abs(source.safeZone.bottom - target.safeZone.bottom) +
    Math.abs(source.safeZone.left - target.safeZone.left)
  // 40% combined delta means safe-zones are basically incomparable (story
  // top: 12% vs banner top: 6% etc. — that's a meaningful but small gap).
  const safeSim = Math.max(0, 1 - safeDelta / 40)

  return (
    0.4 * arSim +
    (sameShape ? 0.2 : 0) +
    (sameGroup ? 0.2 : 0) +
    0.2 * safeSim
  )
}

/**
 * Bucket a similarity score into a recommendation level. Thresholds picked
 * to match real-format behaviour:
 *   - identical formats (different brand)         → 1.0   high
 *   - story ↔ story across platforms              → 0.78+ high
 *   - square ↔ portrait same platform             → 0.6+  medium
 *   - story ↔ banner / square ↔ wide              → < 0.5 low
 */
export function classifyRecommendation(score: number): RecommendationLevel {
  if (score >= 0.75) return 'high'
  if (score >= 0.55) return 'medium'
  return 'low'
}

/**
 * Build a recommendation list for every candidate target. Candidates that are
 * the same as `sourceKey` are skipped — you can't propagate to yourself.
 *
 * The returned list is sorted by descending score so the dialog can render
 * recommended formats first inside each group.
 */
export function recommendTargets(
  sourceKey: FormatKey,
  candidates: FormatKey[],
  customFormats?: FormatRuleSet[],
): FormatRecommendation[] {
  const source = getFormat(sourceKey, customFormats)
  const sourceGroup = groupOf(sourceKey)
  const sourceShape = shapeCategory(source.aspectRatio)
  const out: FormatRecommendation[] = []
  for (const k of candidates) {
    if (k === sourceKey) continue
    const target = getFormat(k, customFormats)
    const targetGroup = groupOf(k)
    const sameGroup = sourceGroup === targetGroup && sourceGroup !== 'other'
    const score = formatSimilarityScore(source, target, sameGroup)
    const level = classifyRecommendation(score)
    const reasons = buildReasons({
      sourceShape,
      targetShape: shapeCategory(target.aspectRatio),
      sourceGroup,
      targetGroup,
      arDelta: Math.abs(Math.log(source.aspectRatio) - Math.log(target.aspectRatio)),
    })
    out.push({ key: k, score, level, reasons })
  }
  out.sort((a, b) => b.score - a.score)
  return out
}

/** Default targets to pre-select in the dialog: high + medium recommendations
 *  only. Users can still flip on the rest manually. If nothing scores above
 *  "low" we fall back to the single best candidate so the action button
 *  doesn't open with an empty selection. */
export function defaultRecommendedTargets(recs: FormatRecommendation[]): FormatKey[] {
  const recommended = recs.filter((r) => r.level !== 'low').map((r) => r.key)
  if (recommended.length > 0) return recommended
  return recs.length > 0 ? [recs[0]!.key] : []
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type ShapeCategory = 'story' | 'portrait' | 'square' | 'landscape' | 'ultrawide'

/** Coarse "shape bucket" so we can write a friendly reason like "та же
 *  ориентация (история)" without dumping raw aspect-ratio numbers at users. */
export function shapeCategory(ar: number): ShapeCategory {
  if (ar < 0.7) return 'story'
  if (ar < 0.95) return 'portrait'
  if (ar < 1.05) return 'square'
  if (ar < 2) return 'landscape'
  return 'ultrawide'
}

const SHAPE_LABEL: Record<ShapeCategory, string> = {
  story: 'история / вертикальный',
  portrait: 'портретный',
  square: 'квадратный',
  landscape: 'горизонтальный',
  ultrawide: 'широкоформатный',
}

const GROUP_LABEL: Record<FormatGroupId, string> = {
  vk: 'VK',
  telegram: 'Telegram',
  instagram: 'Instagram',
  wildberries: 'Wildberries',
  ozon: 'Ozon',
  'yandex-market': 'Яндекс Маркет',
  avito: 'Авито',
  'yandex-rsy': 'РСЯ',
  custom: 'свои форматы',
  other: 'другая платформа',
}

function buildReasons({
  sourceShape,
  targetShape,
  sourceGroup,
  targetGroup,
  arDelta,
}: {
  sourceShape: ShapeCategory
  targetShape: ShapeCategory
  sourceGroup: FormatGroupId
  targetGroup: FormatGroupId
  arDelta: number
}): string[] {
  const out: string[] = []
  if (sourceShape === targetShape) {
    out.push(`Та же ориентация (${SHAPE_LABEL[sourceShape]})`)
  } else if (arDelta < Math.log(1.25)) {
    out.push('Близкие пропорции')
  } else {
    out.push(
      `Разная ориентация (${SHAPE_LABEL[sourceShape]} → ${SHAPE_LABEL[targetShape]})`,
    )
  }
  if (sourceGroup === targetGroup && sourceGroup !== 'other') {
    out.push(`Та же платформа (${GROUP_LABEL[sourceGroup]})`)
  }
  return out
}
