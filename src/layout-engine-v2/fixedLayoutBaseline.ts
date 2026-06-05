import {
  getBaseFontSizes,
  getCompactZones,
  getGap,
  getImageTopZones,
  getLogoOnlyZones,
  getSafeRect,
  getSplitZones,
} from './rules'
import type {
  FormatGroup,
  FormatSpecV2,
  LayoutCandidate,
  LayoutElement,
  LayoutElementRole,
  LayoutRect,
  SourceMaterialV2,
} from './types'

type FixedTemplateName = 'split' | 'imageTop' | 'hero' | 'compact' | 'logoOnly'

interface ElementPlacement {
  rect: LayoutRect
  visible: boolean
  fontSize?: number
}

interface TextStack {
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
  if (element.priority === 'required' && !placement.visible) {
    throw new Error(`Cannot hide required element: ${element.id}`)
  }

  if (element.priority === 'required' && (placement.rect.width <= 0 || placement.rect.height <= 0)) {
    throw new Error(`Cannot place required element with a positive rect: ${element.id}`)
  }

  return {
    ...element,
    rect: cloneRect(placement.rect),
    visible: placement.visible,
    fontSize: placement.fontSize ?? element.fontSize,
  }
}

function hiddenElement(element: LayoutElement): LayoutElement {
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
    subtitleVisible?: boolean
    ctaVisible?: boolean
  } = {},
): TextStack {
  const safeZone = positiveRectInside(zone, format)
  const gap = getGap(format)
  const fontSizes = getBaseFontSizes(format)

  const headline = findElementByRole(source, 'headline')
  const subtitle = findElementByRole(source, 'subtitle')
  const cta = findElementByRole(source, 'cta')

  const headlineMinHeight = minVisibleHeight(headline, 48)
  const subtitleMinHeight = minVisibleHeight(subtitle, 40)
  const ctaMinHeight = minVisibleHeight(cta, 32)

  const headlineHeight = Math.min(
    safeZone.height,
    Math.max(Math.min(headlineMinHeight, safeZone.height), fontSizes.headline * 1.25),
  )

  let cursorY = safeZone.y + headlineHeight + gap
  let remainingHeight = Math.max(0, safeZone.y + safeZone.height - cursorY)

  const canShowSubtitle = options.subtitleVisible !== false && remainingHeight >= subtitleMinHeight
  const subtitleHeight = canShowSubtitle ? Math.min(remainingHeight, Math.max(subtitleMinHeight, fontSizes.subtitle * 1.35)) : 0

  if (canShowSubtitle) {
    cursorY += subtitleHeight + gap
    remainingHeight = Math.max(0, safeZone.y + safeZone.height - cursorY)
  }

  const canShowCta = options.ctaVisible !== false && remainingHeight >= ctaMinHeight
  const ctaHeight = canShowCta ? Math.min(remainingHeight, Math.max(ctaMinHeight, fontSizes.cta * 1.55)) : 0

  return {
    headline: {
      rect: {
        x: safeZone.x,
        y: safeZone.y,
        width: safeZone.width,
        height: headlineHeight,
      },
      visible: true,
      fontSize: fontSizes.headline,
    },
    subtitle: {
      rect: canShowSubtitle
        ? {
            x: safeZone.x,
            y: safeZone.y + headlineHeight + gap,
            width: safeZone.width,
            height: subtitleHeight,
          }
        : ZERO_RECT,
      visible: canShowSubtitle,
      fontSize: fontSizes.subtitle,
    },
    cta: {
      rect: canShowCta
        ? {
            x: safeZone.x,
            y: cursorY,
            width: safeZone.width,
            height: ctaHeight,
          }
        : ZERO_RECT,
      visible: canShowCta,
      fontSize: fontSizes.cta,
    },
  }
}

function selectedTemplateForGroup(group: FormatGroup): FixedTemplateName {
  if (group === 'horizontal') {
    return 'split'
  }

  if (group === 'vertical' || group === 'narrow') {
    return 'imageTop'
  }

  if (group === 'square') {
    return 'hero'
  }

  if (group === 'logo') {
    return 'logoOnly'
  }

  return 'compact'
}

function buildCandidate(
  source: SourceMaterialV2,
  format: FormatSpecV2,
  templateName: FixedTemplateName,
  note: string,
  placeElement: (element: LayoutElement) => ElementPlacement,
): LayoutCandidate {
  return {
    id: `${format.id}:fixedLayout:${templateName}`,
    name: 'fixedLayout',
    formatId: format.id,
    elements: source.elements.map((element) => copyElement(element, placeElement(element))),
    metadata: {
      methodFamily: 'fixedLayout',
      candidateCount: 1,
      decisionMode: 'predefined-template',
      notes: [note],
      templateName,
      sourceCandidateName: templateName,
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

  return buildCandidate(source, format, 'split', `Fixed-layout baseline: predefined "split" template for group "${format.group}".`, (element) => {
    if (element.role === 'background') {
      return backgroundPlacement(format)
    }

    if (element.role === 'image') {
      return { rect: zones.imageZone, visible: true }
    }

    if (element.role === 'headline') {
      return textStack.headline
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
    `Fixed-layout baseline: predefined "imageTop" template for group "${format.group}".`,
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

  return buildCandidate(
    source,
    format,
    'compact',
    `Fixed-layout baseline: predefined "compact" template for group "${format.group}".`,
    (element) => {
      if (element.role === 'background') {
        return backgroundPlacement(format)
      }

      if (element.role === 'logo') {
        return { rect: zones.logoZone, visible: true }
      }

      if (element.role === 'headline') {
        return { rect: zones.headlineZone, visible: true, fontSize: fontSizes.headline }
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
    `Fixed-layout baseline: predefined "logoOnly" template for group "${format.group}".`,
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
    `Fixed-layout baseline: predefined "hero" template for group "${format.group}".`,
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

export function buildFixedLayoutCandidate(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate {
  const templateName = selectedTemplateForGroup(format.group)
  const builders: Record<FixedTemplateName, (source: SourceMaterialV2, format: FormatSpecV2) => LayoutCandidate> = {
    split: buildSplitCandidate,
    imageTop: buildImageTopCandidate,
    hero: buildHeroCandidate,
    compact: buildCompactCandidate,
    logoOnly: buildLogoOnlyCandidate,
  }

  return builders[templateName](source, format)
}
