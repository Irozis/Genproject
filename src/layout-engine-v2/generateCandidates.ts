import type {
  FormatSpecV2,
  LayoutCandidate,
  LayoutCandidateName,
  LayoutElement,
  LayoutElementRole,
  LayoutRect,
  SourceMaterialV2,
} from './types'
import {
  canUseCompact,
  canUseHero,
  canUseImagePriority,
  canUseImageTop,
  canUseLogoOnly,
  canUseSplit,
  canUseTextPriority,
  getBaseFontSizes,
  getCompactZones,
  getGap,
  getImageTopZones,
  getLogoOnlyZones,
  getMinElementGap,
  getSafeRect,
  getSplitZones,
} from './rules'

interface ElementPlacement {
  rect: LayoutRect
  visible: boolean
  fontSize?: number
}

interface TextStack {
  badge: ElementPlacement
  headline: ElementPlacement
  subtitle: ElementPlacement
  cta: ElementPlacement
}

const ZERO_RECT: LayoutRect = { x: 0, y: 0, width: 0, height: 0 }

function cloneRect(rect: LayoutRect): LayoutRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }
}

function findElementByRole(source: SourceMaterialV2, role: LayoutElementRole): LayoutElement | undefined {
  return source.elements.find((element) => element.role === role)
}

function fullFormatRect(format: FormatSpecV2): LayoutRect {
  return {
    x: 0,
    y: 0,
    width: format.width,
    height: format.height,
  }
}

function minVisibleHeight(element: LayoutElement | undefined, fallback: number): number {
  return element?.minHeight ?? fallback
}

function copyElement(element: LayoutElement, placement: ElementPlacement): LayoutElement {
  return {
    ...element,
    rect: cloneRect(placement.rect),
    visible: placement.visible,
    fontSize: placement.fontSize ?? element.fontSize,
  }
}

function hiddenElement(element: LayoutElement): LayoutElement {
  if (element.priority === 'required') {
    throw new Error(`Cannot hide required element: ${element.id}`)
  }

  return copyElement(element, {
    rect: ZERO_RECT,
    visible: false,
  })
}

function defaultPlacement(element: LayoutElement): ElementPlacement {
  if (element.priority === 'required') {
    throw new Error(`Required element was not explicitly placed: ${element.id}`)
  }

  return {
    rect: ZERO_RECT,
    visible: false,
  }
}

function positiveRectInside(rect: LayoutRect, format: FormatSpecV2): LayoutRect {
  const x = Math.max(0, Math.min(rect.x, format.width))
  const y = Math.max(0, Math.min(rect.y, format.height))
  const maxWidth = Math.max(0, format.width - x)
  const maxHeight = Math.max(0, format.height - y)

  return {
    x,
    y,
    width: Math.max(0, Math.min(rect.width, maxWidth)),
    height: Math.max(0, Math.min(rect.height, maxHeight)),
  }
}

function placeTextStack(
  source: SourceMaterialV2,
  format: FormatSpecV2,
  zone: LayoutRect,
  options: {
    badgeVisible?: boolean
    subtitleVisible?: boolean
    ctaVisible?: boolean
  } = {},
): TextStack {
  const safeZone = positiveRectInside(zone, format)
  const badgeTextGap = getMinElementGap(format, 'badgeText')
  const textTextGap = getMinElementGap(format, 'textText')
  const textCtaGap = getMinElementGap(format, 'textCta')
  const headlineCtaGap = getMinElementGap(format, 'headlineCta')
  const fontSizes = getBaseFontSizes(format)

  const badge = findElementByRole(source, 'badge')
  const headline = findElementByRole(source, 'headline')
  const subtitle = findElementByRole(source, 'subtitle')
  const cta = findElementByRole(source, 'cta')

  const badgeMinHeight = minVisibleHeight(badge, 24)
  const headlineMinHeight = minVisibleHeight(headline, 48)
  const subtitleMinHeight = minVisibleHeight(subtitle, 40)
  const ctaMinHeight = minVisibleHeight(cta, 32)

  const badgeHeight = Math.max(badgeMinHeight, fontSizes.badge * 1.5)
  const headlineHeight = Math.max(headlineMinHeight, fontSizes.headline * 1.25)
  const subtitleHeight = Math.max(subtitleMinHeight, fontSizes.subtitle * 1.35)
  const ctaHeight = Math.max(ctaMinHeight, fontSizes.cta * 1.55)

  const canAttemptBadge = options.badgeVisible !== false && badge !== undefined
  const canAttemptSubtitle = options.subtitleVisible !== false && subtitle !== undefined
  const canAttemptCta = options.ctaVisible !== false && cta !== undefined

  const stackHeight = (state: { badge: boolean; subtitle: boolean; cta: boolean }) => {
    let height = headlineHeight

    if (state.badge) {
      height += badgeHeight + badgeTextGap
    }

    if (state.subtitle) {
      height += textTextGap + subtitleHeight
    }

    if (state.cta) {
      height += (state.subtitle ? textCtaGap : headlineCtaGap) + ctaHeight
    }

    return height
  }

  const ctaMayBeHidden = cta?.priority !== 'required'
  const fallbackState = { badge: false, subtitle: false, cta: false }
  const states = [
    { badge: canAttemptBadge, subtitle: canAttemptSubtitle, cta: canAttemptCta },
    { badge: canAttemptBadge, subtitle: false, cta: canAttemptCta },
    { badge: false, subtitle: false, cta: canAttemptCta },
    { badge: false, subtitle: false, cta: canAttemptCta && !ctaMayBeHidden },
    fallbackState,
  ]
  const selectedState = states.find((state) => stackHeight(state) <= safeZone.height) ?? fallbackState

  let cursorY = safeZone.y

  const badgeRect = selectedState.badge
    ? {
        x: safeZone.x,
        y: cursorY,
        width: safeZone.width,
        height: Math.min(badgeHeight, safeZone.height),
      }
    : ZERO_RECT

  if (selectedState.badge) {
    cursorY += badgeRect.height + badgeTextGap
  }

  const headlineRect = {
    x: safeZone.x,
    y: cursorY,
    width: safeZone.width,
    height: Math.min(headlineHeight, Math.max(1, safeZone.y + safeZone.height - cursorY)),
  }

  cursorY += headlineRect.height

  const subtitleRect = selectedState.subtitle
    ? {
        x: safeZone.x,
        y: cursorY + textTextGap,
        width: safeZone.width,
        height: Math.min(subtitleHeight, Math.max(1, safeZone.y + safeZone.height - cursorY - textTextGap)),
      }
    : ZERO_RECT

  if (selectedState.subtitle) {
    cursorY = subtitleRect.y + subtitleRect.height
  }

  const ctaGap = selectedState.subtitle ? textCtaGap : headlineCtaGap
  const ctaRect = selectedState.cta
    ? {
        x: safeZone.x,
        y: cursorY + ctaGap,
        width: safeZone.width,
        height: Math.min(ctaHeight, Math.max(1, safeZone.y + safeZone.height - cursorY - ctaGap)),
      }
    : ZERO_RECT

  return {
    badge: {
      rect: badgeRect,
      visible: selectedState.badge,
      fontSize: fontSizes.badge,
    },
    headline: {
      rect: headlineRect,
      visible: true,
      fontSize: fontSizes.headline,
    },
    subtitle: {
      rect: subtitleRect,
      visible: selectedState.subtitle,
      fontSize: fontSizes.subtitle,
    },
    cta: {
      rect: ctaRect,
      visible: selectedState.cta,
      fontSize: fontSizes.cta,
    },
  }
}

function buildCandidate(
  source: SourceMaterialV2,
  format: FormatSpecV2,
  name: LayoutCandidateName,
  note: string,
  placeElement: (element: LayoutElement) => ElementPlacement,
): LayoutCandidate {
  return {
    id: `${format.id}:${name}`,
    name,
    formatId: format.id,
    elements: source.elements.map((element) => copyElement(element, placeElement(element))),
    metadata: {
      notes: [note],
    },
  }
}

function backgroundPlacement(format: FormatSpecV2): ElementPlacement {
  return {
    rect: fullFormatRect(format),
    visible: true,
  }
}

function buildSplitCandidate(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate {
  const zones = getSplitZones(format)
  const textZoneHeight = Math.max(1, zones.logoZone.y - zones.textZone.y - getGap(format))
  const textStack = placeTextStack(source, format, { ...zones.textZone, height: textZoneHeight })

  return buildCandidate(source, format, 'split', 'Split scheme: text zone on the left and image zone on the right.', (element) => {
    if (element.role === 'background') {
      return backgroundPlacement(format)
    }

    if (element.role === 'image') {
      return { rect: zones.imageZone, visible: true }
    }

    if (element.role === 'headline') {
      return textStack.headline
    }

    if (element.role === 'badge') {
      return textStack.badge
    }

    if (element.role === 'subtitle') {
      return textStack.subtitle
    }

    if (element.role === 'cta') {
      return textStack.cta
    }

    if (element.role === 'logo') {
      return { rect: zones.logoZone, visible: true }
    }

    return defaultPlacement(element)
  })
}

function buildImageTopCandidate(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate {
  const zones = getImageTopZones(format)
  const textStack = placeTextStack(source, format, zones.textZone)

  return buildCandidate(
    source,
    format,
    'imageTop',
    'Image-top scheme: image is placed above a vertical text stack.',
    (element) => {
      if (element.role === 'background') {
        return backgroundPlacement(format)
      }

      if (element.role === 'image') {
        return { rect: zones.imageZone, visible: true }
      }

      if (element.role === 'headline') {
        return textStack.headline
      }

      if (element.role === 'badge') {
        return textStack.badge
      }

      if (element.role === 'subtitle') {
        return textStack.subtitle
      }

      if (element.role === 'cta') {
        return textStack.cta
      }

      if (element.role === 'logo') {
        return { rect: zones.logoZone, visible: true }
      }

      return defaultPlacement(element)
    },
  )
}

function buildCompactCandidate(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate {
  const zones = getCompactZones(format)
  const fontSizes = getBaseFontSizes(format)
  const cta = findElementByRole(source, 'cta')
  const ctaVisible = zones.ctaZone.width >= (cta?.minWidth ?? 54) && zones.ctaZone.height >= (cta?.minHeight ?? 32)
  const imageVisible = zones.imageZone.width > 0 && zones.imageZone.height > 0
  const logoVisible = zones.logoZone.width > 0 && zones.logoZone.height > 0

  return buildCandidate(
    source,
    format,
    'compact',
    'Compact scheme: logo, headline and optional CTA are arranged in one dense row.',
    (element) => {
      if (element.role === 'background') {
        return backgroundPlacement(format)
      }

      if (element.role === 'logo') {
        return { rect: logoVisible ? zones.logoZone : ZERO_RECT, visible: logoVisible }
      }

      if (element.role === 'headline') {
        return { rect: zones.headlineZone, visible: true, fontSize: fontSizes.headline }
      }

      if (element.role === 'badge') {
        return { rect: ZERO_RECT, visible: false, fontSize: fontSizes.badge }
      }

      if (element.role === 'subtitle') {
        return { rect: ZERO_RECT, visible: false, fontSize: fontSizes.subtitle }
      }

      if (element.role === 'cta') {
        return {
          rect: ctaVisible ? zones.ctaZone : ZERO_RECT,
          visible: ctaVisible,
          fontSize: fontSizes.cta,
        }
      }

      if (element.role === 'image') {
        return {
          rect: imageVisible ? zones.imageZone : ZERO_RECT,
          visible: imageVisible,
        }
      }

      return hiddenElement(element)
    },
  )
}

function requiredHeadlineZone(format: FormatSpecV2, logoZone: LayoutRect): LayoutRect {
  const safeRect = getSafeRect(format)
  const gap = Math.min(getGap(format), Math.max(0, safeRect.height * 0.1))
  const maxHeightBelowLogo = Math.max(0, safeRect.y + safeRect.height - (logoZone.y + logoZone.height + gap))
  const height = Math.max(1, Math.min(24, maxHeightBelowLogo || safeRect.height * 0.2))
  const y = Math.min(safeRect.y + safeRect.height - height, logoZone.y + logoZone.height + gap)

  return {
    x: safeRect.x,
    y,
    width: Math.max(1, safeRect.width),
    height,
  }
}

function buildLogoOnlyCandidate(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate {
  const zones = getLogoOnlyZones(format)
  const fontSizes = getBaseFontSizes(format)
  const headline = findElementByRole(source, 'headline')
  const headlineIsRequired = headline?.priority === 'required'
  const regularHeadlineVisible = zones.headlineZone.width > 0 && zones.headlineZone.height >= 24
  const requiredZone = requiredHeadlineZone(format, zones.logoZone)
  const headlineZone = headlineIsRequired ? requiredZone : zones.headlineZone
  const headlineVisible = headlineIsRequired || regularHeadlineVisible

  return buildCandidate(
    source,
    format,
    'logoOnly',
    'Logo-only scheme: brand mark is centered with an optional short headline below.',
    (element) => {
      if (element.role === 'background') {
        return backgroundPlacement(format)
      }

      if (element.role === 'logo') {
        return { rect: zones.logoZone, visible: true }
      }

      if (element.role === 'headline') {
        return {
          rect: headlineVisible ? headlineZone : ZERO_RECT,
          visible: headlineVisible,
          fontSize: fontSizes.headline,
        }
      }

      if (element.role === 'badge') {
        return { rect: ZERO_RECT, visible: false, fontSize: fontSizes.badge }
      }

      if (element.role === 'subtitle') {
        return { rect: ZERO_RECT, visible: false, fontSize: fontSizes.subtitle }
      }

      if (element.role === 'cta') {
        return { rect: ZERO_RECT, visible: false, fontSize: fontSizes.cta }
      }

      if (element.role === 'image') {
        return { rect: ZERO_RECT, visible: false }
      }

      return hiddenElement(element)
    },
  )
}

function buildHeroCandidate(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate {
  const safeRect = getSafeRect(format)
  const gap = getGap(format)
  const logoHeight = Math.min(72, safeRect.height * 0.12)
  const logoZone = {
    x: safeRect.x,
    y: safeRect.y,
    width: Math.min(safeRect.width * 0.24, 180),
    height: logoHeight,
  }
  const textZoneHeight = Math.max(1, safeRect.height * 0.38)
  const textZone = {
    x: safeRect.x,
    y: safeRect.y + safeRect.height - textZoneHeight,
    width: Math.min(safeRect.width, safeRect.width * 0.64),
    height: Math.max(1, textZoneHeight - gap),
  }
  const textStack = placeTextStack(source, format, textZone)

  return buildCandidate(
    source,
    format,
    'hero',
    'Image-background hero scheme: image fills the safe area with text placed over the lower safe zone.',
    (element) => {
      if (element.role === 'background') {
        return backgroundPlacement(format)
      }

      if (element.role === 'image') {
        return { rect: safeRect, visible: true }
      }

      if (element.role === 'headline') {
        return textStack.headline
      }

      if (element.role === 'badge') {
        return textStack.badge
      }

      if (element.role === 'subtitle') {
        return textStack.subtitle
      }

      if (element.role === 'cta') {
        return textStack.cta
      }

      if (element.role === 'logo') {
        return { rect: logoZone, visible: true }
      }

      return defaultPlacement(element)
    },
  )
}

function buildTextPriorityCandidate(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate {
  const safeRect = getSafeRect(format)
  const gap = getGap(format)
  const logoHeight = Math.min(64, safeRect.height * 0.12)
  const logoZone = {
    x: safeRect.x,
    y: safeRect.y,
    width: Math.min(safeRect.width * 0.22, 160),
    height: logoHeight,
  }
  const imageZone = {
    x: safeRect.x + safeRect.width * 0.68 + gap,
    y: safeRect.y,
    width: Math.max(0, safeRect.width * 0.32 - gap),
    height: safeRect.height,
  }
  const textZone = {
    x: safeRect.x,
    y: safeRect.y + logoHeight + gap,
    width: Math.max(1, safeRect.width * 0.68 - gap),
    height: Math.max(1, safeRect.height - logoHeight - gap),
  }
  const textStack = placeTextStack(source, format, textZone, { subtitleVisible: true })

  return buildCandidate(
    source,
    format,
    'textPriority',
    'Text-priority scheme: most safe-area space is reserved for headline, subtitle and CTA.',
    (element) => {
      if (element.role === 'background') {
        return backgroundPlacement(format)
      }

      if (element.role === 'image') {
        return { rect: imageZone, visible: imageZone.width > 0 && imageZone.height > 0 }
      }

      if (element.role === 'logo') {
        return { rect: logoZone, visible: true }
      }

      if (element.role === 'headline') {
        return textStack.headline
      }

      if (element.role === 'badge') {
        return textStack.badge
      }

      if (element.role === 'subtitle') {
        return textStack.subtitle
      }

      if (element.role === 'cta') {
        return textStack.cta
      }

      return defaultPlacement(element)
    },
  )
}

function buildImagePriorityCandidate(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate {
  const safeRect = getSafeRect(format)
  const gap = getGap(format)
  const fontSizes = getBaseFontSizes(format)
  const logoHeight = Math.min(64, safeRect.height * 0.12)
  const logoZone = {
    x: safeRect.x,
    y: safeRect.y,
    width: Math.min(safeRect.width * 0.22, 160),
    height: logoHeight,
  }
  const textHeight = Math.max(1, safeRect.height * 0.26)
  const textZone = {
    x: safeRect.x,
    y: safeRect.y + safeRect.height - textHeight,
    width: safeRect.width,
    height: textHeight,
  }
  const imageZone = {
    x: safeRect.x,
    y: safeRect.y + logoHeight + gap,
    width: safeRect.width,
    height: Math.max(0, safeRect.height - logoHeight - textHeight - gap * 2),
  }
  const textStack = placeTextStack(source, format, textZone, { subtitleVisible: false })

  return buildCandidate(
    source,
    format,
    'imagePriority',
    'Image-priority scheme: image receives the largest safe-area region while headline and logo stay visible.',
    (element) => {
      if (element.role === 'background') {
        return backgroundPlacement(format)
      }

      if (element.role === 'image') {
        return { rect: imageZone, visible: imageZone.width > 0 && imageZone.height > 0 }
      }

      if (element.role === 'logo') {
        return { rect: logoZone, visible: true }
      }

      if (element.role === 'headline') {
        return textStack.headline
      }

      if (element.role === 'badge') {
        return textStack.badge
      }

      if (element.role === 'subtitle') {
        return { rect: ZERO_RECT, visible: false, fontSize: fontSizes.subtitle }
      }

      if (element.role === 'cta') {
        return textStack.cta
      }

      return defaultPlacement(element)
    },
  )
}

export function generateLayoutCandidates(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate[] {
  const candidates: LayoutCandidate[] = []

  if (canUseSplit(format)) {
    candidates.push(buildSplitCandidate(source, format))
  }

  if (canUseHero(format)) {
    candidates.push(buildHeroCandidate(source, format))
  }

  if (canUseImageTop(format)) {
    candidates.push(buildImageTopCandidate(source, format))
  }

  if (canUseCompact(format)) {
    candidates.push(buildCompactCandidate(source, format))
  }

  if (canUseLogoOnly(format)) {
    candidates.push(buildLogoOnlyCandidate(source, format))
  }

  if (canUseTextPriority(format)) {
    candidates.push(buildTextPriorityCandidate(source, format))
  }

  if (canUseImagePriority(format)) {
    candidates.push(buildImagePriorityCandidate(source, format))
  }

  return candidates
}
