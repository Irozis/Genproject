import type { FormatSpecV2, LayoutRect } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function getSafeRect(format: FormatSpecV2): LayoutRect {
  return {
    x: format.safeArea.left,
    y: format.safeArea.top,
    width: format.width - format.safeArea.left - format.safeArea.right,
    height: format.height - format.safeArea.top - format.safeArea.bottom,
  }
}

export function getGap(format: FormatSpecV2): number {
  const base = Math.min(format.width, format.height) * 0.04

  if (format.group === 'small' || format.group === 'wide') {
    return clamp(base, 4, 20)
  }

  return clamp(base, 8, 48)
}

export function getMinTextWidth(format: FormatSpecV2): number {
  if (format.group === 'small' || format.group === 'wide') {
    return Math.max(80, format.width * 0.18)
  }

  return Math.max(120, format.width * 0.25)
}

export function getMinImageWidth(format: FormatSpecV2): number {
  if (format.group === 'small' || format.group === 'wide') {
    return Math.max(48, format.width * 0.12)
  }

  return Math.max(120, format.width * 0.25)
}

export function getBaseFontSizes(format: FormatSpecV2): {
  headline: number
  subtitle: number
  cta: number
} {
  if (format.group === 'small' || format.group === 'wide') {
    return {
      headline: clamp(format.height * 0.38, 12, 24),
      subtitle: clamp(format.height * 0.24, 8, 16),
      cta: clamp(format.height * 0.24, 8, 16),
    }
  }

  return {
    headline:
      format.group === 'vertical'
        ? clamp(format.width * 0.065, 18, 76)
        : clamp(format.width * 0.055, 14, 72),
    subtitle: clamp(format.width * 0.028, 10, 34),
    cta: clamp(format.width * 0.026, 10, 30),
  }
}

export function canUseSplit(format: FormatSpecV2): boolean {
  const safeRect = getSafeRect(format)
  const canUseGroup = format.group === 'horizontal' || format.group === 'square' || format.group === 'wide'

  return (
    canUseGroup &&
    safeRect.width >= getMinTextWidth(format) + getGap(format) + getMinImageWidth(format) &&
    safeRect.height >= 80
  )
}

export function canUseHero(format: FormatSpecV2): boolean {
  const safeRect = getSafeRect(format)

  return format.group !== 'small' && safeRect.width >= 160 && safeRect.height >= 160
}

export function canUseImageTop(format: FormatSpecV2): boolean {
  const safeRect = getSafeRect(format)
  const canUseGroup = format.group === 'vertical' || format.group === 'square' || format.group === 'narrow'

  return canUseGroup && safeRect.height >= 300 && safeRect.width >= 160
}

export function canUseCompact(format: FormatSpecV2): boolean {
  const safeRect = getSafeRect(format)
  const canUseGroup =
    format.group === 'small' || format.group === 'wide' || format.group === 'logo' || format.group === 'horizontal'

  return canUseGroup && safeRect.width >= 120 && safeRect.height >= 40
}

export function canUseLogoOnly(format: FormatSpecV2): boolean {
  const safeRect = getSafeRect(format)

  return safeRect.width >= 48 && safeRect.height >= 32
}

export function canUseTextPriority(format: FormatSpecV2): boolean {
  const safeRect = getSafeRect(format)
  const canUseGroup = format.group === 'vertical' || format.group === 'square' || format.group === 'horizontal'

  return canUseGroup && safeRect.width >= 220 && safeRect.height >= 220
}

export function canUseImagePriority(format: FormatSpecV2): boolean {
  const safeRect = getSafeRect(format)
  const canUseGroup = format.group === 'horizontal' || format.group === 'square' || format.group === 'vertical'

  return canUseGroup && safeRect.width >= 220 && safeRect.height >= 180
}

export function getSplitZones(format: FormatSpecV2): {
  textZone: LayoutRect
  imageZone: LayoutRect
  logoZone: LayoutRect
} {
  const safeRect = getSafeRect(format)
  const gap = getGap(format)
  const textWidth = safeRect.width * 0.44
  const imageWidth = Math.max(0, safeRect.width - textWidth - gap)
  const logoHeight = Math.min(64, safeRect.height * 0.16)

  const textZone = {
    x: safeRect.x,
    y: safeRect.y,
    width: textWidth,
    height: safeRect.height,
  }

  return {
    textZone,
    imageZone: {
      x: safeRect.x + textWidth + gap,
      y: safeRect.y,
      width: imageWidth,
      height: safeRect.height,
    },
    logoZone: {
      x: textZone.x,
      y: textZone.y + textZone.height - logoHeight,
      width: textZone.width,
      height: logoHeight,
    },
  }
}

export function getImageTopZones(format: FormatSpecV2): {
  imageZone: LayoutRect
  textZone: LayoutRect
  logoZone: LayoutRect
} {
  const safeRect = getSafeRect(format)
  const gap = getGap(format)
  const imageHeight = safeRect.height * 0.48
  const textY = safeRect.y + imageHeight + gap
  const textHeight = Math.max(0, safeRect.y + safeRect.height - textY)
  const logoHeight = Math.min(72, safeRect.height * 0.1)
  const logoWidth = Math.min(safeRect.width, Math.max(48, safeRect.width * 0.22))

  return {
    imageZone: {
      x: safeRect.x,
      y: safeRect.y,
      width: safeRect.width,
      height: imageHeight,
    },
    textZone: {
      x: safeRect.x,
      y: textY,
      width: safeRect.width,
      height: textHeight,
    },
    logoZone: {
      x: safeRect.x,
      y: safeRect.y,
      width: logoWidth,
      height: logoHeight,
    },
  }
}

export function getCompactZones(format: FormatSpecV2): {
  logoZone: LayoutRect
  headlineZone: LayoutRect
  ctaZone: LayoutRect
  imageZone: LayoutRect
} {
  const safeRect = getSafeRect(format)
  const gap = getGap(format)
  const logoWidth = clamp(safeRect.width * 0.18, 40, 96)
  const ctaWidth = clamp(safeRect.width * 0.22, 54, 120)
  const imageWidth = safeRect.width >= 520 ? safeRect.width * 0.2 : 0
  const headlineWidth = Math.max(0, safeRect.width - logoWidth - ctaWidth - imageWidth - gap * 3)
  const headlineX = safeRect.x + logoWidth + gap
  const ctaX = headlineX + headlineWidth + gap
  const imageX = imageWidth > 0 ? safeRect.x + safeRect.width - imageWidth : safeRect.x + safeRect.width

  return {
    logoZone: {
      x: safeRect.x,
      y: safeRect.y,
      width: logoWidth,
      height: safeRect.height,
    },
    headlineZone: {
      x: headlineX,
      y: safeRect.y,
      width: headlineWidth,
      height: safeRect.height,
    },
    ctaZone: {
      x: ctaX,
      y: safeRect.y,
      width: ctaWidth,
      height: safeRect.height,
    },
    imageZone: {
      x: imageX,
      y: safeRect.y,
      width: imageWidth,
      height: imageWidth > 0 ? safeRect.height : 0,
    },
  }
}

export function getLogoOnlyZones(format: FormatSpecV2): {
  logoZone: LayoutRect
  headlineZone: LayoutRect
} {
  const safeRect = getSafeRect(format)
  const logoWidth = Math.min(safeRect.width * 0.7, safeRect.height * 1.6)
  const logoHeight = Math.min(safeRect.height * 0.5, logoWidth * 0.45)
  const logoX = safeRect.x + (safeRect.width - logoWidth) / 2
  const logoY = safeRect.y + (safeRect.height - logoHeight) / 2
  const headlineY = logoY + logoHeight
  const remainingHeight = safeRect.y + safeRect.height - headlineY
  const headlineHeight = remainingHeight >= 24 ? remainingHeight : 0

  return {
    logoZone: {
      x: logoX,
      y: logoY,
      width: logoWidth,
      height: logoHeight,
    },
    headlineZone: {
      x: safeRect.x,
      y: headlineY,
      width: headlineHeight > 0 ? safeRect.width : 0,
      height: headlineHeight,
    },
  }
}
