import { getMinElementGap, getSafeRect } from './rules'
import { ISSUE_PENALTIES } from './penalties'
import type {
  FormatSpecV2,
  LayoutCandidate,
  LayoutElement,
  LayoutElementRole,
  LayoutRect,
  ValidationIssue,
  ValidationSeverity,
} from './types'

function isVisible(element: LayoutElement): boolean {
  return element.visible && element.rect.width > 0 && element.rect.height > 0
}

function isTextRole(role: LayoutElementRole): boolean {
  return role === 'headline' || role === 'subtitle' || role === 'cta' || role === 'badge'
}

function isOverlapCheckedRole(role: LayoutElementRole): boolean {
  return role === 'headline' || role === 'subtitle' || role === 'cta' || role === 'logo' || role === 'badge'
}

function defaultMinFontSize(role: LayoutElementRole): number | undefined {
  if (role === 'headline') {
    return 14
  }

  if (role === 'subtitle') {
    return 10
  }

  if (role === 'cta') {
    return 10
  }

  if (role === 'badge') {
    return 9
  }

  return undefined
}

function createIssue(params: {
  type: ValidationIssue['type']
  severity: ValidationSeverity
  elementId?: string
  relatedElementId?: string
  message: string
}): ValidationIssue {
  return {
    type: params.type,
    severity: params.severity,
    elementId: params.elementId,
    relatedElementId: params.relatedElementId,
    message: params.message,
    penalty: ISSUE_PENALTIES[params.type],
  }
}

function rectInsideCanvas(rect: LayoutRect, format: FormatSpecV2): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= format.width && rect.y + rect.height <= format.height
}

function rectInsideRect(rect: LayoutRect, container: LayoutRect): boolean {
  return (
    rect.x >= container.x &&
    rect.y >= container.y &&
    rect.x + rect.width <= container.x + container.width &&
    rect.y + rect.height <= container.y + container.height
  )
}

function intersectionArea(a: LayoutRect, b: LayoutRect): number {
  const left = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)

  if (right <= left || bottom <= top) {
    return 0
  }

  return (right - left) * (bottom - top)
}

function rectDistance(a: LayoutRect, b: LayoutRect): number {
  if (intersectionArea(a, b) > 0) {
    return 0
  }

  const horizontalGap = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0)
  const verticalGap = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0)

  if (horizontalGap === 0) {
    return verticalGap
  }

  if (verticalGap === 0) {
    return horizontalGap
  }

  return Math.sqrt(horizontalGap ** 2 + verticalGap ** 2)
}

function rectArea(rect: LayoutRect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height)
}

function overlapRatio(a: LayoutRect, b: LayoutRect): number {
  const intersection = intersectionArea(a, b)

  if (intersection <= 0) {
    return 0
  }

  const smallerArea = Math.min(rectArea(a), rectArea(b))

  if (smallerArea <= 0) {
    return 0
  }

  return intersection / smallerArea
}

function issueSeverityForElement(element: LayoutElement): ValidationSeverity {
  return element.priority === 'optional' ? 'warning' : 'critical'
}

function issueSeverityForPair(first: LayoutElement, second: LayoutElement): ValidationSeverity {
  return first.priority === 'required' || second.priority === 'required' ? 'critical' : 'warning'
}

function validateMissingRequired(candidate: LayoutCandidate): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const element of candidate.elements) {
    if (element.priority !== 'required') {
      continue
    }

    if (!element.visible || element.rect.width <= 0 || element.rect.height <= 0) {
      issues.push(
        createIssue({
          type: 'missing_required',
          severity: 'critical',
          elementId: element.id,
          message: `Required element "${element.id}" is not visible or has zero size.`,
        }),
      )
    }
  }

  return issues
}

function validateOutOfBounds(candidate: LayoutCandidate, format: FormatSpecV2): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const element of candidate.elements) {
    if (!isVisible(element)) {
      continue
    }

    if (!rectInsideCanvas(element.rect, format)) {
      issues.push(
        createIssue({
          type: 'out_of_bounds',
          severity: issueSeverityForElement(element),
          elementId: element.id,
          message: `Element "${element.id}" is outside the ${format.width}x${format.height} canvas.`,
        }),
      )
    }
  }

  return issues
}

function validateUnsafeZone(candidate: LayoutCandidate, format: FormatSpecV2): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const safeRect = getSafeRect(format)

  for (const element of candidate.elements) {
    if (!isVisible(element)) {
      continue
    }

    if (element.role === 'background' || element.role === 'decor' || element.role === 'image') {
      continue
    }

    if (element.priority === 'optional') {
      continue
    }

    if (!rectInsideRect(element.rect, safeRect)) {
      issues.push(
        createIssue({
          type: 'unsafe_zone',
          severity: element.priority === 'required' ? 'critical' : 'warning',
          elementId: element.id,
          message: `Element "${element.id}" is outside the safe area of format "${format.id}".`,
        }),
      )
    }
  }

  return issues
}

function validateTextSize(candidate: LayoutCandidate): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const element of candidate.elements) {
    if (!isVisible(element)) {
      continue
    }

    if (!isTextRole(element.role)) {
      continue
    }

    const minFontSize = element.minFontSize ?? defaultMinFontSize(element.role)

    if (minFontSize === undefined) {
      continue
    }

    const fontSize = element.fontSize ?? 0

    if (fontSize < minFontSize) {
      issues.push(
        createIssue({
          type: 'text_too_small',
          severity: issueSeverityForElement(element),
          elementId: element.id,
          message: `Text element "${element.id}" has fontSize ${fontSize}, below minimum ${minFontSize}.`,
        }),
      )
    }
  }

  return issues
}


function validateOverlap(candidate: LayoutCandidate): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const elements = candidate.elements.filter(
    (element) => isVisible(element) && element.priority !== 'optional' && isOverlapCheckedRole(element.role),
  )

  for (let i = 0; i < elements.length; i += 1) {
    const first = elements[i]

    if (!first) {
      continue
    }

    for (let j = i + 1; j < elements.length; j += 1) {
      const second = elements[j]

      if (!second) {
        continue
      }

      const ratio = overlapRatio(first.rect, second.rect)

      if (ratio <= 0.05) {
        continue
      }

      issues.push(
        createIssue({
          type: 'overlap',
          severity: issueSeverityForPair(first, second),
          elementId: first.id,
          relatedElementId: second.id,
          message: `Elements "${first.id}" and "${second.id}" overlap by ${(ratio * 100).toFixed(1)}%.`,
        }),
      )
    }
  }

  return issues
}

function findVisibleRole(candidate: LayoutCandidate, role: LayoutElementRole): LayoutElement | undefined {
  return candidate.elements.find((element) => element.role === role && isVisible(element))
}

function validateImportantSpacing(candidate: LayoutCandidate, format: FormatSpecV2): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const checkedPairs = new Set<string>()

  const addPairIssue = (first: LayoutElement | undefined, second: LayoutElement | undefined, minGap: number) => {
    if (!first || !second) {
      return
    }

    const pairKey = [first.id, second.id].sort().join(':')

    if (checkedPairs.has(pairKey)) {
      return
    }

    checkedPairs.add(pairKey)

    const intersection = intersectionArea(first.rect, second.rect)

    if (intersection > 0) {
      const smallerArea = Math.min(rectArea(first.rect), rectArea(second.rect))
      const ratio = smallerArea > 0 ? intersection / smallerArea : 0

      issues.push(
        createIssue({
          type: 'overlap',
          severity: issueSeverityForPair(first, second),
          elementId: first.id,
          relatedElementId: second.id,
          message: `Important elements "${first.id}" and "${second.id}" intersect by ${(ratio * 100).toFixed(1)}%.`,
        }),
      )
      return
    }

    const distance = rectDistance(first.rect, second.rect)

    if (distance + 0.1 < minGap) {
      issues.push(
        createIssue({
          type: 'overlap',
          severity: 'warning',
          elementId: first.id,
          relatedElementId: second.id,
          message: `Important elements "${first.id}" and "${second.id}" are ${distance.toFixed(1)}px apart, below minimum ${minGap.toFixed(1)}px.`,
        }),
      )
    }
  }

  const headline = findVisibleRole(candidate, 'headline')
  const cta = findVisibleRole(candidate, 'cta')
  const image = findVisibleRole(candidate, 'image')
  const subtitle = findVisibleRole(candidate, 'subtitle')
  const badge = findVisibleRole(candidate, 'badge')

  addPairIssue(badge, headline, getMinElementGap(format, 'badgeText'))
  addPairIssue(badge, subtitle, getMinElementGap(format, 'textText'))
  addPairIssue(badge, cta, getMinElementGap(format, 'textCta'))
  addPairIssue(headline, subtitle, getMinElementGap(format, 'textText'))
  addPairIssue(subtitle, cta, getMinElementGap(format, 'textCta'))
  addPairIssue(headline, cta, getMinElementGap(format, 'headlineCta'))
  addPairIssue(image, headline, getMinElementGap(format, 'imageText'))
  addPairIssue(image, subtitle, getMinElementGap(format, 'imageText'))

  return issues
}

function validateHiddenOptional(candidate: LayoutCandidate): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const element of candidate.elements) {
    if (element.priority !== 'optional') {
      continue
    }

    if (element.visible) {
      continue
    }

    issues.push(
      createIssue({
        type: 'hidden_optional',
        severity: 'warning',
        elementId: element.id,
        message: `Optional element "${element.id}" is hidden in candidate "${candidate.name}".`,
      }),
    )
  }

  return issues
}

function validateExcessiveCrop(candidate: LayoutCandidate): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const element of candidate.elements) {
    if (!isVisible(element) || element.role !== 'image') {
      continue
    }

    const cropRatio = element.metadata?.cropRatio

    if (typeof cropRatio !== 'number') {
      continue
    }

    if (cropRatio > 0.35) {
      issues.push(
        createIssue({
          type: 'excessive_crop',
          severity: cropRatio > 0.5 ? 'critical' : 'warning',
          elementId: element.id,
          message: `Image element "${element.id}" has excessive crop ratio ${cropRatio}.`,
        }),
      )
    }
  }

  return issues
}

function validateEmptySpace(candidate: LayoutCandidate, format: FormatSpecV2): ValidationIssue[] {
  const visibleNonBackground = candidate.elements.filter(
    (element) => isVisible(element) && element.role !== 'background' && element.role !== 'decor',
  )

  const occupiedArea = visibleNonBackground.reduce((sum, element) => sum + rectArea(element.rect), 0)
  const canvasArea = format.width * format.height

  if (canvasArea <= 0) {
    return []
  }

  const occupiedRatio = occupiedArea / canvasArea

  const minUsefulRatio = format.group === 'small' || format.group === 'wide' ? 0.12 : 0.18

  if (occupiedRatio >= minUsefulRatio) {
    return []
  }

  return [
    createIssue({
      type: 'empty_space',
      severity: 'warning',
      message: `Candidate "${candidate.name}" has excessive_empty_space: uses only ${(occupiedRatio * 100).toFixed(1)}% of the canvas area.`,
    }),
  ]
}

export function validateLayoutCandidate(candidate: LayoutCandidate, format: FormatSpecV2): ValidationIssue[] {
  return [
    ...validateMissingRequired(candidate),
    ...validateOutOfBounds(candidate, format),
    ...validateUnsafeZone(candidate, format),
    ...validateTextSize(candidate),
    ...validateOverlap(candidate),
    ...validateImportantSpacing(candidate, format),
    ...validateHiddenOptional(candidate),
    ...validateExcessiveCrop(candidate),
    ...validateEmptySpace(candidate, format),
  ]
}
