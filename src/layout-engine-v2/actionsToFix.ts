import type { CandidateEvaluation, LayoutElementRole, ValidationIssue } from './types'

export interface ActionsToFixResult {
  actionsToFix: number
  estimatedCorrectionTimeSec: number
  reasons: string[]
}

const HIDDEN_ROLE_ACTIONS: Partial<Record<LayoutElementRole, number>> = {
  subtitle: 1,
  cta: 1,
  image: 2,
  badge: 0,
  decor: 0,
  logo: 2,
  headline: 3,
}

function issueElementLabel(issue: ValidationIssue): string {
  return issue.elementId ? `:${issue.elementId}` : ''
}

function issueActions(issue: ValidationIssue): number {
  if (issue.type === 'missing_required') {
    return 3
  }

  if (issue.type === 'overlap') {
    return issue.severity === 'critical' ? 2 : 1
  }

  if (issue.type === 'unsafe_zone') {
    return 1
  }

  if (issue.type === 'out_of_bounds') {
    return 2
  }

  if (issue.type === 'text_too_small') {
    return 1
  }

  if (issue.type === 'excessive_crop') {
    return 1
  }

  return 0
}

function hiddenElementActions(evaluation: CandidateEvaluation, elementId: string): { label: string; actions: number } {
  const element = evaluation.candidate.elements.find((item) => item.id === elementId)
  const role = element?.role

  return {
    label: role ?? elementId,
    actions: role ? HIDDEN_ROLE_ACTIONS[role] ?? 1 : 1,
  }
}

export function calculateActionsToFix(evaluation: CandidateEvaluation): ActionsToFixResult {
  const reasons: string[] = []
  let actionsToFix = 0

  for (const issue of evaluation.issues) {
    if (issue.type === 'hidden_optional' || issue.type === 'empty_space') {
      continue
    }

    const actions = issueActions(issue)

    if (actions > 0) {
      actionsToFix += actions
      reasons.push(`${issue.type}${issueElementLabel(issue)} +${actions}`)
    }
  }

  for (const elementId of evaluation.hiddenElements) {
    const hidden = hiddenElementActions(evaluation, elementId)

    if (hidden.actions > 0) {
      actionsToFix += hidden.actions
      reasons.push(`hidden:${hidden.label} +${hidden.actions}`)
    }
  }

  if (evaluation.criticalCount > 0 && actionsToFix < 3) {
    actionsToFix = 3
    reasons.push('critical_minimum +3')
  }

  return {
    actionsToFix,
    estimatedCorrectionTimeSec: actionsToFix * 30,
    reasons,
  }
}
