import { validateLayoutCandidate } from './validateCandidate'
import type { CandidateEvaluation, FormatSpecV2, LayoutCandidate, LayoutElement, ValidationIssue } from './types'

export function scoreLayoutCandidate(issues: ValidationIssue[]): number {
  return issues.reduce((sum, issue) => sum + issue.penalty, 0)
}

export function countCriticalIssues(issues: ValidationIssue[]): number {
  return issues.filter((issue) => issue.severity === 'critical').length
}

export function countWarningIssues(issues: ValidationIssue[]): number {
  return issues.filter((issue) => issue.severity === 'warning').length
}

export function getHiddenElements(candidate: LayoutCandidate): string[] {
  return candidate.elements.filter((element) => !element.visible).map((element) => element.id)
}

export function countPreservedRequiredAndImportant(candidate: LayoutCandidate): number {
  return candidate.elements.filter(
    (element: LayoutElement) =>
      element.visible &&
      element.rect.width > 0 &&
      element.rect.height > 0 &&
      (element.priority === 'required' || element.priority === 'important'),
  ).length
}

export function evaluateLayoutCandidate(candidate: LayoutCandidate, format: FormatSpecV2): CandidateEvaluation {
  const issues = validateLayoutCandidate(candidate, format)

  return {
    candidate,
    issues,
    score: scoreLayoutCandidate(issues),
    criticalCount: countCriticalIssues(issues),
    warningCount: countWarningIssues(issues),
    hiddenElements: getHiddenElements(candidate),
  }
}