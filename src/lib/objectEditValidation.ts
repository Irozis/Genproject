import { contrastRatio } from './color'
import type { FormatRuleSet, SceneObject } from './types'

export type ValidationIssue = {
  code: 'outside-safe-zone' | 'too-small-text' | 'object-overlap' | 'low-contrast'
  severity: 'warning'
  message: string
}

const TEXT_TYPES = new Set<SceneObject['type']>(['title', 'subtitle', 'cta', 'badge', 'text'])

export function validateObjectEdit(
  object: SceneObject,
  format: FormatRuleSet,
  objects: SceneObject[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (isOutsideSafeZone(object, format)) {
    issues.push({
      code: 'outside-safe-zone',
      severity: 'warning',
      message: 'Объект выходит за safe zone.',
    })
  }

  if (TEXT_TYPES.has(object.type) && typeof object.fontSize === 'number' && object.fontSize < format.minTitleSize * 0.45) {
    issues.push({
      code: 'too-small-text',
      severity: 'warning',
      message: 'Текст может быть слишком мелким.',
    })
  }

  if (objects.some((candidate) => candidate.id !== object.id && candidate.visible && overlaps(object, candidate))) {
    issues.push({
      code: 'object-overlap',
      severity: 'warning',
      message: 'Объект пересекается с другим слоем.',
    })
  }

  const background = objects.find((candidate) => candidate.type === 'background')
  if (TEXT_TYPES.has(object.type) && object.fill && background?.fill && isHex(object.fill) && isHex(background.fill)) {
    const ratio = contrastRatio(object.fill, background.fill)
    if (ratio < 4.5) {
      issues.push({
        code: 'low-contrast',
        severity: 'warning',
        message: 'Контраст текста может быть низким.',
      })
    }
  }

  return issues
}

function isOutsideSafeZone(object: SceneObject, format: FormatRuleSet): boolean {
  const safeLeft = format.safeZone.left
  const safeTop = format.safeZone.top
  const safeRight = 100 - format.safeZone.right
  const safeBottom = 100 - format.safeZone.bottom
  return (
    object.x < safeLeft ||
    object.y < safeTop ||
    object.x + object.width > safeRight ||
    object.y + object.height > safeBottom
  )
}

function overlaps(a: SceneObject, b: SceneObject): boolean {
  if (a.type === 'background' || b.type === 'background') return false
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value)
}
