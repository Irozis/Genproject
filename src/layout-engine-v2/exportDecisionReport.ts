import type { LayoutDecision, ValidationIssue, ValidationIssueType } from './types'

export interface CandidateReportRow {
  projectId: string
  formatId: string
  method: string
  candidateId: string
  candidateName: string
  methodFamily: string
  candidateCount: number | string
  decisionMode: string
  selected: boolean
  score: number
  criticalCount: number
  warningCount: number
  outOfBoundsCount: number
  overlapCount: number
  textTooSmallCount: number
  missingRequiredCount: number
  unsafeZoneCount: number
  excessiveCropCount: number
  emptySpaceCount: number
  hiddenOptionalCount: number
  hiddenElementsCount: number
  hiddenElements: string
  issueSummary: string
  reason: string
}

export interface DecisionReport {
  projectId: string
  formatId: string
  method: string
  selectedCandidateId: string
  selectedLayout: string
  selectedScore: number
  selectedCriticalCount: number
  selectedWarningCount: number
  candidateCount: number
  rejectedCount: number
  reason: string
  rows: CandidateReportRow[]
}

const ISSUE_TYPES: ValidationIssueType[] = [
  'out_of_bounds',
  'overlap',
  'text_too_small',
  'missing_required',
  'unsafe_zone',
  'excessive_crop',
  'empty_space',
  'hidden_optional',
]

export function countIssuesByType(issues: ValidationIssue[], type: ValidationIssueType): number {
  return issues.filter((issue) => issue.type === type).length
}

function summarizeIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return 'none'
  }

  return ISSUE_TYPES.map((type) => {
    const count = countIssuesByType(issues, type)

    return count > 0 ? `${type}:${count}` : ''
  })
    .filter(Boolean)
    .join('|')
}

function csvEscape(value: string | number | boolean): string {
  const raw = String(value)

  if (!/[",\n\r]/.test(raw)) {
    return raw
  }

  return `"${raw.replace(/"/g, '""')}"`
}

function rowToCsv(row: CandidateReportRow): string {
  return [
    row.projectId,
    row.formatId,
    row.method,
    row.candidateId,
    row.candidateName,
    row.methodFamily,
    row.candidateCount,
    row.decisionMode,
    row.selected,
    row.score,
    row.criticalCount,
    row.warningCount,
    row.outOfBoundsCount,
    row.overlapCount,
    row.textTooSmallCount,
    row.missingRequiredCount,
    row.unsafeZoneCount,
    row.excessiveCropCount,
    row.emptySpaceCount,
    row.hiddenOptionalCount,
    row.hiddenElementsCount,
    row.hiddenElements,
    row.issueSummary,
    row.reason,
  ]
    .map(csvEscape)
    .join(',')
}

export const DECISION_REPORT_CSV_HEADER = [
  'projectId',
  'formatId',
  'method',
  'candidateId',
  'candidateName',
  'methodFamily',
  'candidateCount',
  'decisionMode',
  'selected',
  'score',
  'criticalCount',
  'warningCount',
  'outOfBoundsCount',
  'overlapCount',
  'textTooSmallCount',
  'missingRequiredCount',
  'unsafeZoneCount',
  'excessiveCropCount',
  'emptySpaceCount',
  'hiddenOptionalCount',
  'hiddenElementsCount',
  'hiddenElements',
  'issueSummary',
  'reason',
].join(',')

export function createDecisionReport(params: {
  projectId: string
  method: string
  decision: LayoutDecision
}): DecisionReport {
  const evaluations = [params.decision.selected, ...params.decision.rejected]

  const rows = evaluations.map((evaluation): CandidateReportRow => {
    const selected = evaluation.candidate.id === params.decision.selected.candidate.id

    return {
      projectId: params.projectId,
      formatId: params.decision.formatId,
      method: params.method,
      candidateId: evaluation.candidate.id,
      candidateName: evaluation.candidate.name,
      methodFamily: typeof evaluation.candidate.metadata?.methodFamily === 'string' ? evaluation.candidate.metadata.methodFamily : '',
      candidateCount:
        typeof evaluation.candidate.metadata?.candidateCount === 'number' ||
        typeof evaluation.candidate.metadata?.candidateCount === 'string'
          ? evaluation.candidate.metadata.candidateCount
          : '',
      decisionMode: typeof evaluation.candidate.metadata?.decisionMode === 'string' ? evaluation.candidate.metadata.decisionMode : '',
      selected,
      score: evaluation.score,
      criticalCount: evaluation.criticalCount,
      warningCount: evaluation.warningCount,
      outOfBoundsCount: countIssuesByType(evaluation.issues, 'out_of_bounds'),
      overlapCount: countIssuesByType(evaluation.issues, 'overlap'),
      textTooSmallCount: countIssuesByType(evaluation.issues, 'text_too_small'),
      missingRequiredCount: countIssuesByType(evaluation.issues, 'missing_required'),
      unsafeZoneCount: countIssuesByType(evaluation.issues, 'unsafe_zone'),
      excessiveCropCount: countIssuesByType(evaluation.issues, 'excessive_crop'),
      emptySpaceCount: countIssuesByType(evaluation.issues, 'empty_space'),
      hiddenOptionalCount: countIssuesByType(evaluation.issues, 'hidden_optional'),
      hiddenElementsCount: evaluation.hiddenElements.length,
      hiddenElements: evaluation.hiddenElements.join('|'),
      issueSummary: summarizeIssues(evaluation.issues),
      reason: selected ? params.decision.reason : '',
    }
  })

  return {
    projectId: params.projectId,
    formatId: params.decision.formatId,
    method: params.method,
    selectedCandidateId: params.decision.selected.candidate.id,
    selectedLayout: params.decision.selected.candidate.name,
    selectedScore: params.decision.selected.score,
    selectedCriticalCount: params.decision.selected.criticalCount,
    selectedWarningCount: params.decision.selected.warningCount,
    candidateCount: evaluations.length,
    rejectedCount: params.decision.rejected.length,
    reason: params.decision.reason,
    rows,
  }
}

export function decisionReportToCsv(report: DecisionReport): string {
  return [DECISION_REPORT_CSV_HEADER, ...report.rows.map(rowToCsv)].join('\n')
}

export function decisionReportsToCsv(reports: DecisionReport[]): string {
  return [DECISION_REPORT_CSV_HEADER, ...reports.flatMap((report) => report.rows.map(rowToCsv))].join('\n')
}
