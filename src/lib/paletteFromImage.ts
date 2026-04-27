// Deterministic derivation of a semantic Palette + background gradient from an
// image's dominant colors. No randomness. Same hint → same palette.
//
// Strategy:
//   1. Partition candidates into "chromatic" (saturated) and "neutral" buckets.
//   2. Pick accent from chromatic — the most saturated candidate with a
//      readable lightness. Fall back to the default accent if nothing chromatic.
//   3. Pick ink (dark text) from darkest neutral, clamped dark enough for
//      contrast. Pick surface (light text background) from lightest neutral,
//      clamped light enough. Fall back to near-black / near-white when the
//      image is monochromatic.
//   4. inkMuted sits between ink and surface in lightness.
//   5. accentSoft = accent desaturated + lightened.
//   6. Gradient is a tonal ramp built from the accent hue so the composition
//      reads as one color system instead of three unrelated samples.
//
// Contrast guarantees (AA-ish):
//   - luminance(surface) − luminance(ink)  ≥ 0.55
//   - accent visibly different from surface (Δluminance ≥ 0.15) — if not,
//     accent is shifted darker until it is.

import { hexToHsl, hslToHex, luminance } from './color'
import type { AssetHint, Palette } from './types'

const SAT_THRESHOLD = 20 // HSL saturation % above which a color is "chromatic"

export type DerivedBrandColors = {
  palette: Palette
  gradient: [string, string, string]
}

export function paletteFromHint(
  hint: AssetHint,
  fallback: { palette: Palette; gradient: [string, string, string] },
): DerivedBrandColors {
  const colors = hint.dominantColors.map((hex) => ({ hex, hsl: hexToHsl(hex) }))
  if (colors.length === 0) return { palette: fallback.palette, gradient: fallback.gradient }

  const chromatic = colors.filter((c) => c.hsl.s >= SAT_THRESHOLD)
  const neutral = colors.filter((c) => c.hsl.s < SAT_THRESHOLD)

  // ---- accent: the most saturated, with a readable lightness ---------------
  const accentCandidates = chromatic.length > 0 ? chromatic : colors
  const accent = accentCandidates
    .map((c) => ({
      c,
      score: c.hsl.s * readabilityFactor(c.hsl.l),
    }))
    .sort((a, b) => b.score - a.score)[0]?.c ?? colors[0]!
  const accentHsl = clampAccentLightness(accent.hsl)
  const accentHex = hslToHex(accentHsl.h, accentHsl.s, accentHsl.l)

  // ---- ink / surface: mode-aware ------------------------------------------
  // In dark-dominant images, ink is a near-white so text remains readable on
  // the darkened gradient; surface becomes a deep neutral for overlays / CTA
  // text. In light-dominant images we do the opposite (classic dark-on-light).
  const pool = neutral.length > 0 ? neutral : colors
  const darkest = [...pool].sort((a, b) => a.hsl.l - b.hsl.l)[0]!
  const lightest = [...pool].sort((a, b) => b.hsl.l - a.hsl.l)[0]!

  const darkBg = hint.isDarkBackground

  // Slight hue tint so neutrals still feel part of the brand (warm-white,
  // cool-black, etc.) but sat is tiny so the color reads as neutral.
  const neutralHue = (darkBg ? darkest.hsl.h : lightest.hsl.h)

  const inkHex = darkBg
    ? hslToHex(neutralHue, 6, 96)
    : hslToHex(darkest.hsl.h, Math.min(darkest.hsl.s, 18), Math.min(darkest.hsl.l, 12))

  const surfHex = darkBg
    ? hslToHex(darkest.hsl.h, Math.min(darkest.hsl.s, 15), Math.max(Math.min(darkest.hsl.l, 14), 8))
    : hslToHex(neutralHue, Math.min(lightest.hsl.s, 10), Math.max(lightest.hsl.l, 96))

  // inkMuted — subdued secondary text. Sits ~35% of the luminance gap toward
  // surface, using the same hue family as ink.
  const inkL = darkBg ? 96 : Math.min(darkest.hsl.l, 12)
  const surfL = darkBg ? Math.max(Math.min(darkest.hsl.l, 14), 8) : Math.max(lightest.hsl.l, 96)
  const mutedL = inkL + (surfL - inkL) * 0.35
  const inkMutedHex = hslToHex(neutralHue, 10, mutedL)

  // accentSoft — pastel version of accent for decor / hover / tints.
  const accentSoftHex = hslToHex(
    accentHsl.h,
    Math.max(accentHsl.s * 0.5, 15),
    Math.min(accentHsl.l + 30, 90),
  )

  // ---- contrast check ------------------------------------------------------
  let finalAccentHex = accentHex
  if (Math.abs(luminance(finalAccentHex) - luminance(surfHex)) < 0.15) {
    // darken accent until it clearly separates from surface
    let lPush = accentHsl.l
    for (let step = 0; step < 8 && lPush > 20; step++) {
      lPush -= 6
      const tryHex = hslToHex(accentHsl.h, accentHsl.s, lPush)
      if (Math.abs(luminance(tryHex) - luminance(surfHex)) >= 0.18) {
        finalAccentHex = tryHex
        break
      }
    }
  }

  const palette: Palette = {
    ink: inkHex,
    inkMuted: inkMutedHex,
    surface: surfHex,
    accent: finalAccentHex,
    accentSoft: accentSoftHex,
  }

  const gradient = gradientFromAccent(finalAccentHex, hint.isDarkBackground)
  return { palette, gradient }
}

// Build up to `n` distinct palette suggestions from the hint by picking
// different accent candidates. Two candidates are considered "distinct" when
// their hues differ by ≥ 30°, so we don't return four shades of the same
// blue. The first entry always matches `paletteFromHint` — subsequent
// entries are alternatives for users who want a different mood from the
// same photo. Deterministic (same hint → same ordered list).
export function paletteAlternatives(
  hint: AssetHint,
  fallback: { palette: Palette; gradient: [string, string, string] },
  n = 4,
): DerivedBrandColors[] {
  if (hint.dominantColors.length === 0) return [{ palette: fallback.palette, gradient: fallback.gradient }]
  const candidates = hint.dominantColors
    .map((hex) => ({ hex, hsl: hexToHsl(hex) }))
    .filter((c) => c.hsl.s >= SAT_THRESHOLD)
  // When there are no saturated colors, fall back to the single primary derivation.
  if (candidates.length === 0) return [paletteFromHint(hint, fallback)]

  const picked: { hex: string; hsl: { h: number; s: number; l: number } }[] = []
  // Greedy: rank by saturation × readability, skip hues within 30° of an already-picked accent.
  const ranked = candidates
    .map((c) => ({ c, score: c.hsl.s * readabilityFactor(c.hsl.l) }))
    .sort((a, b) => b.score - a.score)
  for (const { c } of ranked) {
    if (picked.length >= n) break
    const tooClose = picked.some((p) => hueDistance(p.hsl.h, c.hsl.h) < 30)
    if (tooClose) continue
    picked.push(c)
  }

  return picked.map((c) =>
    paletteFromHint(
      { ...hint, dominantColors: [c.hex, ...hint.dominantColors.filter((h) => h !== c.hex)] },
      fallback,
    ),
  )
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/** Score 0..1 rewarding lightness values in the 35..70 range. */
function readabilityFactor(l: number): number {
  if (l < 15 || l > 85) return 0.4
  const center = 52
  const dist = Math.abs(l - center)
  return 1 - dist / 60 // 1.0 at center, ~0.0 at edges
}

function clampAccentLightness(hsl: { h: number; s: number; l: number }) {
  const s = Math.max(hsl.s, 45) // ensure the accent stays vivid
  const l = Math.max(30, Math.min(hsl.l, 62))
  return { h: hsl.h, s, l }
}

/** Tonal ramp in the accent hue. Very low saturation at the light end so the
 *  gradient reads as "tinted neutral" rather than "pastel wash". The mid and
 *  bottom stops carry slightly more of the hue so the ramp still feels
 *  intentional, but none of them should ever compete with the photo itself. */
function gradientFromAccent(hex: string, dark: boolean): [string, string, string] {
  const { h, s } = hexToHsl(hex)
  if (dark) {
    // Moody backgrounds — deep neutral tinted with the accent hue.
    return [
      hslToHex(h, Math.min(s * 0.25, 12), 10),
      hslToHex(h, Math.min(s * 0.35, 18), 14),
      hslToHex(h, Math.min(s * 0.45, 24), 20),
    ]
  }
  // Light-dominant images — near-white top stop, subtle tint at the bottom.
  return [
    hslToHex(h, Math.min(s * 0.12, 7), 97),
    hslToHex(h, Math.min(s * 0.22, 14), 92),
    hslToHex(h, Math.min(s * 0.32, 22), 84),
  ]
}
