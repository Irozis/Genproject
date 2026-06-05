import { describe, expect, it } from 'vitest'
import { calculateActionsToFix } from './actionsToFix'
import type { CandidateEvaluation, LayoutElement, ValidationIssue } from './types'

const baseElement: LayoutElement = {
  id: 'headline',
  role: 'headline',
  priority: 'required',
  rect: { x: 0, y: 0, width: 100, height: 40 },
  visible: true,
  canHide: false,
  canScale: true,
  canCrop: false,
}

function issue(type: ValidationIssue['type'], elementId = 'headline', severity: ValidationIssue['severity'] = 'warning'): ValidationIssue {
  return {
    type,
    severity,
    elementId,
    message: type,
    penalty: 1,
  }
}

function evaluation(params: {
  issues?: ValidationIssue[]
  hiddenElements?: string[]
  elements?: LayoutElement[]
  criticalCount?: number
} = {}): CandidateEvaluation {
  return {
    candidate: {
      id: 'candidate',
      name: 'compact',
      formatId: 'format',
      elements: params.elements ?? [baseElement],
    },
    issues: params.issues ?? [],
    score: 0,
    criticalCount: params.criticalCount ?? params.issues?.filter((item) => item.severity === 'critical').length ?? 0,
    warningCount: params.issues?.filter((item) => item.severity === 'warning').length ?? 0,
    hiddenElements: params.hiddenElements ?? [],
  }
}

function hiddenElement(id: string, role: LayoutElement['role']): LayoutElement {
  return {
    ...baseElement,
    id,
    role,
    visible: false,
    priority: 'optional',
    canHide: true,
  }
}

describe('calculateActionsToFix', () => {
  it('adds one action for text_too_small', () => {
    expect(calculateActionsToFix(evaluation({ issues: [issue('text_too_small')] })).actionsToFix).toBe(1)
  })

  it.each([
    ['subtitle', 1],
    ['cta', 1],
    ['image', 2],
    ['decor', 0],
    ['badge', 0],
  ] as const)('adds %i actions for hidden %s', (role, actions) => {
    expect(
      calculateActionsToFix(
        evaluation({
          hiddenElements: [role],
          elements: [baseElement, hiddenElement(role, role)],
        }),
      ).actionsToFix,
    ).toBe(actions)
  })

  it('adds three actions for missing_required', () => {
    expect(calculateActionsToFix(evaluation({ issues: [issue('missing_required')] })).actionsToFix).toBe(3)
  })

  it('applies a minimum of three actions when criticalCount is positive', () => {
    expect(
      calculateActionsToFix(
        evaluation({
          issues: [issue('text_too_small', 'headline', 'critical')],
          criticalCount: 1,
        }),
      ).actionsToFix,
    ).toBe(3)
  })

  it('estimates correction time as actionsToFix multiplied by 30 seconds', () => {
    const result = calculateActionsToFix(evaluation({ issues: [issue('missing_required'), issue('text_too_small')] }))

    expect(result.actionsToFix).toBe(4)
    expect(result.estimatedCorrectionTimeSec).toBe(result.actionsToFix * 30)
  })

  it('returns non-empty reasons when actions are required', () => {
    const result = calculateActionsToFix(evaluation({ issues: [issue('text_too_small')] }))

    expect(result.actionsToFix).toBeGreaterThan(0)
    expect(result.reasons.length).toBeGreaterThan(0)
    expect(result.reasons[0]).toBe('text_too_small:headline +1')
  })
})
