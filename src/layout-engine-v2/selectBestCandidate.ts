import { calculateActionsToFix } from './actionsToFix'
import { evaluateLayoutCandidate } from './scoreCandidate'
import type { CandidateEvaluation, FormatSpecV2, LayoutCandidate, LayoutDecision, ValidationIssue } from './types'

const DETERMINISTIC_CREATED_AT = '1970-01-01T00:00:00.000Z'

function compareEvaluations(first: CandidateEvaluation, second: CandidateEvaluation): number {
  if (first.criticalCount !== second.criticalCount) {
    return first.criticalCount - second.criticalCount
  }

  const firstActionsToFix = calculateActionsToFix(first).actionsToFix
  const secondActionsToFix = calculateActionsToFix(second).actionsToFix

  if (firstActionsToFix !== secondActionsToFix) {
    return firstActionsToFix - secondActionsToFix
  }

  if (first.score !== second.score) {
    return first.score - second.score
  }

  if (first.warningCount !== second.warningCount) {
    return first.warningCount - second.warningCount
  }

  const firstIsFixedFallback =
    first.candidate.metadata?.methodFamily === 'fixedLayout' ||
    first.candidate.metadata?.decisionMode === 'predefined-template'
  const secondIsFixedFallback =
    second.candidate.metadata?.methodFamily === 'fixedLayout' ||
    second.candidate.metadata?.decisionMode === 'predefined-template'

  if (firstIsFixedFallback !== secondIsFixedFallback) {
    return firstIsFixedFallback ? -1 : 1
  }

  return first.candidate.name.localeCompare(second.candidate.name)
}

function summarizeIssue(issue: ValidationIssue): string {
  if (issue.elementId && issue.relatedElementId) {
    return `${issue.type}:${issue.elementId}->${issue.relatedElementId}`
  }

  if (issue.elementId) {
    return `${issue.type}:${issue.elementId}`
  }

  return issue.type
}

function summarizeEvaluation(evaluation: CandidateEvaluation): string {
  if (evaluation.issues.length === 0) {
    return `${evaluation.candidate.name}: no issues`
  }

  const firstIssues = evaluation.issues.slice(0, 3).map(summarizeIssue).join(', ')

  return `${evaluation.candidate.name}: score=${evaluation.score}, critical=${evaluation.criticalCount}, warnings=${evaluation.warningCount}, issues=[${firstIssues}]`
}

function buildSelectionReason(selected: CandidateEvaluation, rejected: CandidateEvaluation[]): string {
  const selectedSummary = `Selected ${selected.candidate.name} with score ${selected.score}, ${selected.criticalCount} critical issue(s), ${selected.warningCount} warning(s).`

  if (rejected.length === 0) {
    return selectedSummary
  }

  const rejectedSummary = rejected.map(summarizeEvaluation).join('; ')

  return `${selectedSummary} Rejected candidates: ${rejectedSummary}.`
}

export function selectBestLayoutCandidate(candidates: LayoutCandidate[], format: FormatSpecV2): LayoutDecision {
  if (candidates.length === 0) {
    throw new Error(`Cannot select layout candidate for "${format.id}": candidate list is empty.`)
  }

  const evaluations = candidates.map((candidate) => evaluateLayoutCandidate(candidate, format))
  const sortedEvaluations = [...evaluations].sort(compareEvaluations)
  const selected = sortedEvaluations[0]

  if (!selected) {
    throw new Error(`Cannot select layout candidate for "${format.id}": evaluation list is empty.`)
  }

  const rejected = sortedEvaluations.filter((evaluation) => evaluation.candidate.id !== selected.candidate.id)

  return {
    formatId: format.id,
    selected,
    rejected,
    reason: buildSelectionReason(selected, rejected),
    createdAt: DETERMINISTIC_CREATED_AT,
  }
}
