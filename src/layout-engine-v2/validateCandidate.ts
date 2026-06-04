import { getSafeRect } from './rules'
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
          severity: first.priority === 'required' || second.priority === 'required' ? 'critical' : 'warning',
          elementId: first.id,
          relatedElementId: second.id,
          message: `Elements "${first.id}" and "${second.id}" overlap by ${(ratio * 100).toFixed(1)}%.`,
        }),
      )
    }
  }

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

  if (occupiedRatio >= 0.08) {
    return []
  }

  return [
    createIssue({
      type: 'empty_space',
      severity: 'warning',
      message: `Candidate "${candidate.name}" uses only ${(occupiedRatio * 100).toFixed(1)}% of the canvas area.`,
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
    ...validateHiddenOptional(candidate),
    ...validateExcessiveCrop(candidate),
    ...validateEmptySpace(candidate, format),
  ]
}