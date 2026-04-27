// Minimal canvas-based image analysis for MVP. No ML.
// Loads an image, samples pixels, returns dominant colors and dark/light flag.
//
// Dominance uses HSV bucketing weighted by saturation so that vivid,
// visually-dominant hues beat background noise (sky haze, skin tones,
// phone screens, etc.) that tend to cluster in a single desaturated cell
// in a pure-RGB bucketing.

import type { AssetHint } from './types'

const HUE_BINS = 12
const SAT_BINS = 4
const VAL_BINS = 4

export async function analyzeImage(src: string): Promise<AssetHint> {
  const img = await loadImage(src)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const sample = sampleCanvas(img, 64)
  const dominant = dominantColors(sample, 8)
  const isDark = edgeBrightness(sample, 64) < 0.5
  // Brightness of the bottom 35% band — where hero-overlay drops its text
  // stack. Drives scrim opacity: bright band needs a stronger darken to keep
  // white text readable; already-dark band can get away with a light veil.
  const bottomBand = bandBrightness(sample, 64, 0.65, 1.0)
  // 4×4 luminance grid — coarse enough to be cheap and stable under image
  // replacement, fine enough to tell "bright sky top-right + dark foreground
  // bottom-left" apart. Used by composition to decide per-block halos.
  const grid = brightnessGrid(sample, 64, 4)

  return {
    width: w,
    height: h,
    aspectRatio: w / h,
    dominantColors: dominant,
    isDarkBackground: isDark,
    bottomBandBrightness: bottomBand,
    brightnessGrid: grid,
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

function sampleCanvas(img: HTMLImageElement, size: number): Uint8ClampedArray {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size).data
}

type Bucket = {
  r: number
  g: number
  b: number
  s: number // cumulative saturation 0..1
  v: number // cumulative value 0..1
  n: number
}

function dominantColors(data: Uint8ClampedArray, k: number): string[] {
  // HSV bucket grid: separates hue families first so greens don't fragment.
  const buckets = new Map<number, Bucket>()
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    const a = data[i + 3] ?? 0
    if (a < 16) continue
    const { h, s, v } = rgbToHsv(r, g, b)
    const hi = Math.min(HUE_BINS - 1, Math.floor((h / 360) * HUE_BINS))
    const si = Math.min(SAT_BINS - 1, Math.floor(s * SAT_BINS))
    const vi = Math.min(VAL_BINS - 1, Math.floor(v * VAL_BINS))
    const key = (hi * SAT_BINS + si) * VAL_BINS + vi
    const cur = buckets.get(key)
    if (cur) {
      cur.r += r; cur.g += g; cur.b += b
      cur.s += s; cur.v += v; cur.n += 1
    } else {
      buckets.set(key, { r, g, b, s, v, n: 1 })
    }
  }
  // Score: weight by (saturation + baseline) so desaturated backdrops don't win
  // purely on count. Near-black / near-white bins get a further discount because
  // they are almost always noise pixels for palette purposes.
  const scored = [...buckets.values()].map((c) => {
    const avgS = c.s / c.n
    const avgV = c.v / c.n
    const extremeV = avgV < 0.08 || avgV > 0.96 ? 0.4 : 1
    return {
      c,
      score: (avgS * 1.6 + 0.15) * c.n * extremeV,
      avgS,
      avgV,
    }
  })
  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, k).map(({ c }) =>
    rgbToHex(c.r / c.n, c.g / c.n, c.b / c.n),
  )
}

// Average luminance of a horizontal band of the sample image, where the band
// is `[yFrom..yTo]` expressed as fractions of height (0 = top, 1 = bottom).
// Returns 0..1. Used to auto-tune scrim opacity for hero-overlay text.
function bandBrightness(
  data: Uint8ClampedArray,
  size: number,
  yFrom: number,
  yTo: number,
): number {
  const y0 = Math.max(0, Math.floor(yFrom * size))
  const y1 = Math.min(size, Math.ceil(yTo * size))
  let sum = 0
  let n = 0
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      n += 1
    }
  }
  return n === 0 ? 0.5 : sum / n
}

// N×N luminance grid over the sampled image. Each cell is the mean of the
// corresponding sub-rectangle's luminance. Row 0 = top strip, col 0 = left
// strip. Deterministic in pixel order — same image → identical grid.
function brightnessGrid(
  data: Uint8ClampedArray,
  size: number,
  n: number,
): number[][] {
  const cellSize = size / n
  const grid: number[][] = []
  for (let row = 0; row < n; row++) {
    const y0 = Math.floor(row * cellSize)
    const y1 = Math.floor((row + 1) * cellSize)
    const line: number[] = []
    for (let col = 0; col < n; col++) {
      const x0 = Math.floor(col * cellSize)
      const x1 = Math.floor((col + 1) * cellSize)
      let sum = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * size + x) * 4
          const r = data[i] ?? 0
          const g = data[i + 1] ?? 0
          const b = data[i + 2] ?? 0
          sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
          count += 1
        }
      }
      line.push(count === 0 ? 0.5 : sum / count)
    }
    grid.push(line)
  }
  return grid
}

function edgeBrightness(data: Uint8ClampedArray, size: number): number {
  let sum = 0
  let n = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const onEdge = x < 4 || y < 4 || x >= size - 4 || y >= size - 4
      if (!onEdge) continue
      const i = (y * size + x) * 4
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      n += 1
    }
  }
  return n === 0 ? 0.5 : sum / n
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60
        break
      case gn:
        h = ((bn - rn) / d + 2) * 60
        break
      case bn:
        h = ((rn - gn) / d + 4) * 60
        break
    }
  }
  const s = max === 0 ? 0 : d / max
  const v = max
  return { h, s, v }
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase()
}
