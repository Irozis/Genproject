import type { ResearchMethodSummary, ResearchResult } from './runResearch'

export interface ResearchSummaryTableRow {
  method: string
  totalFormats: number
  clean: number
  withoutCritical: number
  warningOnly: number
  critical: number
  averageScore: number
  totalCriticalIssues: number
  totalWarningIssues: number
  totalOutOfBounds: number
  totalOverlap: number
  totalTextTooSmall: number
  totalMissingRequired: number
  totalUnsafeZone: number
  totalHiddenOptional: number
}

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits

  return Math.round(value * multiplier) / multiplier
}

export function toResearchSummaryTable(result: ResearchResult): ResearchSummaryTableRow[] {
  return result.summary.map((summary) => ({
    method: summary.method,
    totalFormats: summary.totalFormats,
    clean: summary.clean,
    withoutCritical: summary.withoutCritical,
    warningOnly: summary.warningOnly,
    critical: summary.critical,
    averageScore: round(summary.averageScore, 2),
    totalCriticalIssues: summary.totalCriticalIssues,
    totalWarningIssues: summary.totalWarningIssues,
    totalOutOfBounds: summary.totalOutOfBounds,
    totalOverlap: summary.totalOverlap,
    totalTextTooSmall: summary.totalTextTooSmall,
    totalMissingRequired: summary.totalMissingRequired,
    totalUnsafeZone: summary.totalUnsafeZone,
    totalHiddenOptional: summary.totalHiddenOptional,
  }))
}

export function researchSummaryTableToCsv(rows: ResearchSummaryTableRow[]): string {
  const header = [
    'method',
    'totalFormats',
    'clean',
    'withoutCritical',
    'warningOnly',
    'critical',
    'averageScore',
    'totalCriticalIssues',
    'totalWarningIssues',
    'totalOutOfBounds',
    'totalOverlap',
    'totalTextTooSmall',
    'totalMissingRequired',
    'totalUnsafeZone',
    'totalHiddenOptional',
  ].join(',')

  const body = rows.map((row) =>
    [
      row.method,
      row.totalFormats,
      row.clean,
      row.withoutCritical,
      row.warningOnly,
      row.critical,
      row.averageScore,
      row.totalCriticalIssues,
      row.totalWarningIssues,
      row.totalOutOfBounds,
      row.totalOverlap,
      row.totalTextTooSmall,
      row.totalMissingRequired,
      row.totalUnsafeZone,
      row.totalHiddenOptional,
    ].join(','),
  )

  return [header, ...body].join('\n')
}

function formatMethodLabel(method: ResearchMethodSummary['method']): string {
  if (method === 'scaling') {
    return 'Scaling baseline'
  }

  if (method === 'fixedLayout') {
    return 'Fixed-layout baseline'
  }

  return 'Candidate selection'
}

export function researchSummaryToText(result: ResearchResult): string {
  const lines: string[] = []

  lines.push(`Research result for project: ${result.projectId}`)
  lines.push(`Formats: ${result.formatCount}`)
  lines.push(`Methods: ${result.methods.join(', ')}`)
  lines.push('')

  for (const summary of result.summary) {
    lines.push(`${formatMethodLabel(summary.method)}:`)
    lines.push(`- total formats: ${summary.totalFormats}`)
    lines.push(`- clean without issues: ${summary.clean}`)
    lines.push(`- without critical issues: ${summary.withoutCritical}`)
    lines.push(`- warning only: ${summary.warningOnly}`)
    lines.push(`- critical: ${summary.critical}`)
    lines.push(`- average score: ${round(summary.averageScore, 2)}`)
    lines.push(`- total critical issues: ${summary.totalCriticalIssues}`)
    lines.push(`- total warning issues: ${summary.totalWarningIssues}`)
    lines.push(`- out of bounds: ${summary.totalOutOfBounds}`)
    lines.push(`- overlap: ${summary.totalOverlap}`)
    lines.push(`- text too small: ${summary.totalTextTooSmall}`)
    lines.push(`- missing required: ${summary.totalMissingRequired}`)
    lines.push(`- unsafe zone: ${summary.totalUnsafeZone}`)
    lines.push(`- hidden optional: ${summary.totalHiddenOptional}`)
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}