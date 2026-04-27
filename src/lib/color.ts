// Deterministic color utilities. No randomness.
// Used by the renderer to derive tonal stops from a single base hex.

export type HSL = { h: number; s: number; l: number } // h: 0..360, s: 0..100, l: 0..100

export function hexToHsl(hex: string): HSL {
  const c = hex.replace('#', '').trim()
  if (c.length !== 3 && c.length !== 6) return { h: 0, s: 0, l: 50 }
  const full =
    c.length === 3
      ? c
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : c
  const r = parseInt(full.slice(0, 2), 16) / 255
  const g = parseInt(full.slice(2, 4), 16) / 255
  const b = parseInt(full.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360 / 360
  const ss = clamp(s, 0, 100) / 100
  const ll = clamp(l, 0, 100) / 100

  let r: number
  let g: number
  let b: number

  if (ss === 0) {
    r = g = b = ll
  } else {
    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
    const p = 2 * ll - q
    r = hue2rgb(p, q, hh + 1 / 3)
    g = hue2rgb(p, q, hh)
    b = hue2rgb(p, q, hh - 1 / 3)
  }
  return '#' + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase()
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Generate 3 tonal stops (lighter → base → darker) from one base color. */
export function tonalStops(base: string): [string, string, string] {
  const { h, s, l } = hexToHsl(base)
  const top = hslToHex(h, s, clamp(l + 10, 0, 96))
  const mid = hslToHex(h, s, l)
  const bot = hslToHex(h, s, clamp(l - 10, 4, 100))
  return [top, mid, bot]
}

/** Relative luminance (for contrast checks). */
export function luminance(hex: string): number {
  const c = hex.replace('#', '')
  if (c.length !== 6) return 0.5
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
