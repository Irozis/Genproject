// Deterministic text wrapping via an offscreen canvas measureText.
// No randomness. No DOM layout. Same inputs → same lines.
//
// Falls back to a cheap character-count heuristic only when canvas is not
// available (e.g., SSR / node tests). That fallback is itself deterministic —
// it's a pure function of text + width.

let cached: CanvasRenderingContext2D | null | undefined
const measureCache = new Map<string, number>()
const MEASURE_CACHE_MAX = 400

function getCtx(): CanvasRenderingContext2D | null {
  if (cached !== undefined) return cached
  if (typeof document === 'undefined') {
    cached = null
    return cached
  }
  try {
    const canvas = document.createElement('canvas')
    cached = canvas.getContext('2d')
  } catch {
    cached = null
  }
  return cached ?? null
}

export type WrapInput = {
  text: string
  fontSizePx: number
  fontWeight: number
  fontFamily: string
  maxWidthPx: number
  maxLines: number
  overflow?: 'ellipsis' | 'clip'
  /**
   * When true (default), avoid orphans — a last line that is a single short
   * word. Rebalances by pulling the last word of the previous line down so
   * the final line gets ≥2 words, which reads much better in headlines.
   * Only applies when lines.length ≥ 2 and the fit hasn't triggered ellipsis.
   */
  avoidOrphans?: boolean
  /**
   * When true (default), balance 2-line wraps so both lines have similar
   * width — emulates CSS `text-wrap: balance`. Greedy wrap packs line 1 to
   * max width, leaving a short line 2; this re-splits to minimize the wider
   * of the two lines. Deterministic (exhaustive over split indices) and
   * a no-op when wrap already produced a single line, a 3+ line block, or
   * hit ellipsis. Only applied to lines.length === 2 — optimal for N ≥ 3
   * needs DP and isn't worth the code for the rare case.
   */
  balance?: boolean
}

export type FontFitInput = {
  baseFontSizePx: number
  minFontSizePx: number
  fits: (fontSizePx: number) => boolean
  precisionPx?: number
}

export function wrapText(input: WrapInput): string[] {
  const { text, fontSizePx, fontWeight, fontFamily, maxWidthPx, maxLines } = input
  const overflow = input.overflow ?? 'ellipsis'
  const avoidOrphans = input.avoidOrphans !== false
  const balance = input.balance !== false
  if (!text || maxLines <= 0 || maxWidthPx <= 0) return []
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const ctx = getCtx()
  const fontSpec = `${fontWeight} ${fontSizePx}px ${fontFamily}`
  const measure = (s: string) => memoMeasure(s, fontSpec, ctx)

  const lines: string[] = []
  let current = ''
  let ellipsisApplied = false

  for (let i = 0; i < words.length; i++) {
    const word = words[i] ?? ''
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate) <= maxWidthPx) {
      current = candidate
      continue
    }

    // candidate overflows — flush current, start new
    if (current) {
      lines.push(current)
      current = word
      if (lines.length === maxLines) {
        if (overflow === 'clip') return lines
        // no room for `current` — fold remaining words into ellipsis on last line
        const lastIdx = lines.length - 1
        const remaining = [word, ...words.slice(i + 1)].join(' ')
        lines[lastIdx] = fitWithEllipsis(lines[lastIdx] ?? '', remaining, measure, maxWidthPx)
        ellipsisApplied = true
        return lines
      }
    } else {
      if (overflow === 'clip') {
        lines.push(word)
        current = ''
      } else {
        // single word too wide — truncate it with ellipsis
        lines.push(fitSingleWord(word, measure, maxWidthPx))
        current = ''
        ellipsisApplied = true
      }
      if (lines.length === maxLines) return lines
    }
  }

  if (current && lines.length < maxLines) lines.push(current)
  let result = lines.slice(0, maxLines)
  if (balance && !ellipsisApplied && result.length === 2) {
    result = balanceTwoLines(result, words, measure, maxWidthPx)
  }
  if (avoidOrphans && !ellipsisApplied) return rebalanceOrphan(result, measure, maxWidthPx)
  return result
}

/**
 * Measure the rendered width of a single line of text in pixels using the
 * same canvas backend that drives `wrapText`. Falls back to a deterministic
 * heuristic in environments without a DOM (SSR, vitest by default).
 *
 * Note: this does NOT account for SVG `letter-spacing` — that's a tracking
 * value applied on top of glyph metrics. Add it explicitly at call sites
 * that use letter-spacing (e.g. `width + letterSpacingPx * text.length`).
 */
export function measureTextWidth(
  text: string,
  fontSizePx: number,
  fontWeight: number,
  fontFamily: string,
): number {
  if (!text || fontSizePx <= 0) return 0
  const ctx = getCtx()
  const fontSpec = `${fontWeight} ${fontSizePx}px ${fontFamily}`
  return memoMeasure(text, fontSpec, ctx)
}

export function fitFontSize(input: FontFitInput): number {
  const precision = input.precisionPx ?? 0.25
  const min = Math.max(0, input.minFontSizePx)
  const base = Math.max(min, input.baseFontSizePx)
  if (input.fits(base)) return base
  if (!input.fits(min)) return min

  let lo = min
  let hi = base
  while (hi - lo > precision) {
    const mid = (lo + hi) / 2
    if (input.fits(mid)) {
      lo = mid
    } else {
      hi = mid
    }
  }
  return lo
}

function rawMeasure(s: string, fontSpec: string, ctx: CanvasRenderingContext2D | null): number {
  if (ctx) {
    ctx.font = fontSpec
    return ctx.measureText(s).width
  }
  return s.length * Number(fontSpec.split('px')[0]?.split(' ').pop() ?? 16) * 0.52
}

function memoMeasure(s: string, fontSpec: string, ctx: CanvasRenderingContext2D | null): number {
  const key = `${fontSpec}|${s}`
  const hit = measureCache.get(key)
  if (hit !== undefined) {
    measureCache.delete(key)
    measureCache.set(key, hit)
    return hit
  }
  const w = rawMeasure(s, fontSpec, ctx)
  measureCache.set(key, w)
  if (measureCache.size > MEASURE_CACHE_MAX) {
    const first = measureCache.keys().next().value
    if (first !== undefined) measureCache.delete(first)
  }
  return w
}

export function __resetMeasureCacheForTests(): void {
  measureCache.clear()
}

export function __measureCacheSizeForTests(): number {
  return measureCache.size
}

// Balance a 2-line wrap: exhaustively try every split index and keep the one
// that minimizes the wider line. Deterministic O(N) — N = word count, typical
// ≤ 8. Preserves word order. Falls back to the greedy split when no alternative
// fits within maxWidthPx (e.g. one very long word forces a specific split).
function balanceTwoLines(
  lines: string[],
  words: string[],
  measure: (s: string) => number,
  maxWidthPx: number,
): string[] {
  if (lines.length !== 2 || words.length < 2) return lines
  // Guard: balance only when the original wrap used all words (no ellipsis,
  // no truncation). If `lines.join(' ')` has a word count other than words.length,
  // the greedy pass lost something — don't override.
  const used = (lines[0] + ' ' + lines[1]).split(/\s+/).filter(Boolean).length
  if (used !== words.length) return lines

  let bestLines = lines
  let bestMax = Math.max(measure(lines[0]!), measure(lines[1]!))
  for (let k = 1; k < words.length; k++) {
    const l1 = words.slice(0, k).join(' ')
    const l2 = words.slice(k).join(' ')
    const w1 = measure(l1)
    const w2 = measure(l2)
    if (w1 > maxWidthPx || w2 > maxWidthPx) continue
    const m = Math.max(w1, w2)
    if (m < bestMax) {
      bestMax = m
      bestLines = [l1, l2]
    }
  }
  return bestLines
}

// Pull the last word of the second-to-last line down to the final line when
// the final line is a single short word. Read like: the last line becomes
// "prev-last last" if (a) the current last line has exactly one word,
// (b) that word is short (< 6 chars), (c) the previous line has ≥ 2 words,
// (d) the donating line still fits the new width. No-ops otherwise.
function rebalanceOrphan(
  lines: string[],
  measure: (s: string) => number,
  maxWidthPx: number,
): string[] {
  if (lines.length < 2) return lines
  const lastIdx = lines.length - 1
  const last = lines[lastIdx] ?? ''
  const prev = lines[lastIdx - 1] ?? ''
  const lastWords = last.split(/\s+/).filter(Boolean)
  if (lastWords.length !== 1) return lines
  if ((lastWords[0]?.length ?? 0) >= 6) return lines
  const prevWords = prev.split(/\s+/).filter(Boolean)
  if (prevWords.length < 2) return lines
  const donated = prevWords[prevWords.length - 1] ?? ''
  const newPrev = prevWords.slice(0, -1).join(' ')
  const newLast = `${donated} ${last}`
  // Guard: the donated line still must fit, and the new last line must fit.
  if (measure(newPrev) > maxWidthPx) return lines
  if (measure(newLast) > maxWidthPx) return lines
  const out = lines.slice()
  out[lastIdx - 1] = newPrev
  out[lastIdx] = newLast
  return out
}

function fitWithEllipsis(
  line: string,
  overflow: string,
  measure: (s: string) => number,
  maxWidthPx: number,
): string {
  // Try to fit `line + " " + overflow` with an ellipsis; walk back until it fits.
  const target = `${line} ${overflow}`.trim()
  if (measure(`${target}…`) <= maxWidthPx) return `${target}…`
  // Walk back one char at a time from target end
  let s = target
  while (s.length > 0 && measure(`${s}…`) > maxWidthPx) {
    s = s.slice(0, -1)
  }
  s = s.replace(/\s+$/, '')
  return `${s}…`
}

function fitSingleWord(
  word: string,
  measure: (s: string) => number,
  maxWidthPx: number,
): string {
  if (measure(word) <= maxWidthPx) return word
  let s = word
  while (s.length > 1 && measure(`${s}…`) > maxWidthPx) {
    s = s.slice(0, -1)
  }
  return `${s}…`
}
