import { fitFontSize, measureTextWidth } from './textMeasure'

export type CtaSizingInput = {
  text: string
  fontSize: number
  fontFamily?: string
  fontWeight?: number
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight?: number
  paddingX: number
  paddingY: number
  lineHeight: number
  formatWidth: number
  formatHeight: number
  density?: 'compact' | 'balanced' | 'spacious'
  letterSpacing?: number
}

export type CtaSizingResult = {
  width: number
  height: number
  fontSize: number
  fits: boolean
  warning?: string
}

export function measureTextApprox(
  text: string,
  fontSize: number,
  fontFamily = 'Inter, Arial, sans-serif',
  fontWeight = 700,
  letterSpacing = 0,
): number {
  const label = text.trim()
  if (!label || fontSize <= 0) return 0
  const glyphs = measureTextWidth(label, fontSize, fontWeight, fontFamily)
  const tracking = Math.max(0, label.length - 1) * fontSize * letterSpacing
  return (glyphs + tracking) * 1.04
}

export function computeCtaButtonSize(input: CtaSizingInput): CtaSizingResult {
  const fontFamily = input.fontFamily ?? 'Inter, Arial, sans-serif'
  const fontWeight = input.fontWeight ?? 700
  const letterSpacing = input.letterSpacing ?? 0
  const maxWidth = Math.max(input.minWidth, input.maxWidth)
  const baseFontSize = Math.max(1, input.fontSize)
  const naturalTextWidth = measureTextApprox(input.text, baseFontSize, fontFamily, fontWeight, letterSpacing)
  const naturalWidth = naturalTextWidth + input.paddingX * 2
  const width = clamp(naturalWidth, input.minWidth, maxWidth)
  const fit = fitTextIntoButton({ ...input, fontFamily, fontWeight, letterSpacing, maxWidth: width })
  const height = clamp(
    fit.fontSize * input.lineHeight + input.paddingY * 2,
    input.minHeight,
    input.maxHeight ?? Number.POSITIVE_INFINITY,
  )
  return {
    width,
    height,
    fontSize: fit.fontSize,
    fits: fit.fits,
    warning: fit.fits ? undefined : 'CTA text does not fit the available button width',
  }
}

export function fitTextIntoButton(input: CtaSizingInput): Pick<CtaSizingResult, 'fontSize' | 'fits'> {
  const fontFamily = input.fontFamily ?? 'Inter, Arial, sans-serif'
  const fontWeight = input.fontWeight ?? 700
  const letterSpacing = input.letterSpacing ?? 0
  const availableTextWidth = Math.max(0, input.maxWidth - input.paddingX * 2)
  const minFontSize = minReadableFontSize(input)
  const baseFontSize = Math.max(minFontSize, input.fontSize)
  const fitsAt = (size: number) =>
    measureTextApprox(input.text, size, fontFamily, fontWeight, letterSpacing) <= availableTextWidth
  const fontSize = fitFontSize({
    baseFontSizePx: baseFontSize,
    minFontSizePx: minFontSize,
    precisionPx: 0.25,
    fits: fitsAt,
  })
  return { fontSize, fits: fitsAt(fontSize) }
}

function minReadableFontSize(input: CtaSizingInput): number {
  const shortSide = Math.min(input.formatWidth, input.formatHeight)
  const absoluteFloor = input.density === 'compact' || shortSide <= 320 ? 10 : 12
  const proportionalFloor = input.fontSize * (input.density === 'compact' ? 0.72 : 0.78)
  return Math.max(absoluteFloor, Math.min(input.fontSize, proportionalFloor))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
