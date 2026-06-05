import type { CandidateReportRow } from './exportDecisionReport'
import type { ResearchResult } from './runResearch'

export interface FixedVsCandidateRow {
  formatId: string
  formatName: string
  group: string
  fixedLayoutName: string
  candidateSelectionName: string
  sameLayout: boolean
  fixedScore: number
  candidateScore: number
  deltaScore: number
  fixedCriticalCount: number
  candidateCriticalCount: number
  deltaCritical: number
  fixedWarningCount: number
  candidateWarningCount: number
  deltaWarning: number
  fixedHiddenElements: string
  candidateHiddenElements: string
  fixedHiddenElementsCount: number
  candidateHiddenElementsCount: number
  deltaHiddenElements: number
  candidateBetter: boolean
  candidateWorse: boolean
  candidateEqual: boolean
}

export interface FixedVsCandidateSummary {
  totalFormats: number
  sameLayoutCount: number
  differentLayoutCount: number
  candidateBetterCount: number
  candidateEqualCount: number
  candidateWorseCount: number
  averageDeltaScore: number
  totalFixedHiddenElements: number
  totalCandidateHiddenElements: number
  deltaHiddenElementsTotal: number
}

const CSV_HEADER = [
  'formatId',
  'formatName',
  'group',
  'fixedLayoutName',
  'candidateSelectionName',
  'sameLayout',
  'fixedScore',
  'candidateScore',
  'deltaScore',
  'fixedCriticalCount',
  'candidateCriticalCount',
  'deltaCritical',
  'fixedWarningCount',
  'candidateWarningCount',
  'deltaWarning',
  'fixedHiddenElements',
  'candidateHiddenElements',
  'fixedHiddenElementsCount',
  'candidateHiddenElementsCount',
  'deltaHiddenElements',
  'candidateBetter',
  'candidateWorse',
  'candidateEqual',
]

function round(value: number, digits = 2): number {
  const multiplier = 10 ** digits

  return Math.round(value * multiplier) / multiplier
}

function csvEscape(value: string | number | boolean): string {
  const raw = String(value)

  if (!/[",\n\r]/.test(raw)) {
    return raw
  }

  return `"${raw.replace(/"/g, '""')}"`
}

function selectedRow(report: ResearchResult['reports'][number]): CandidateReportRow {
  const row = report.rows.find((item) => item.selected)

  if (!row) {
    throw new Error(`Cannot compare report for "${report.formatId}" and "${report.method}": no selected row.`)
  }

  return row
}

function fixedTemplateName(row: CandidateReportRow): string {
  const suffix = row.candidateId.match(/:fixedLayout:([^:]+)$/)?.[1]

  return suffix ?? row.candidateName
}

export function buildFixedVsCandidateRows(result: ResearchResult): FixedVsCandidateRow[] {
  return result.formats.map((format) => {
    const fixedReport = result.reports.find((report) => report.formatId === format.id && report.method === 'fixedLayout')
    const candidateReport = result.reports.find((report) => report.formatId === format.id && report.method === 'candidateSelection')

    if (!fixedReport || !candidateReport) {
      throw new Error(`Cannot compare fixedLayout and candidateSelection for "${format.id}": missing method report.`)
    }

    const fixed = selectedRow(fixedReport)
    const candidate = selectedRow(candidateReport)
    const fixedLayoutName = fixedTemplateName(fixed)
    const candidateSelectionName = candidate.candidateName
    const deltaScore = fixed.score - candidate.score
    const deltaCritical = fixed.criticalCount - candidate.criticalCount
    const deltaWarning = fixed.warningCount - candidate.warningCount
    const deltaHiddenElements = fixed.hiddenElementsCount - candidate.hiddenElementsCount

    return {
      formatId: format.id,
      formatName: format.name,
      group: format.group,
      fixedLayoutName,
      candidateSelectionName,
      sameLayout: fixedLayoutName === candidateSelectionName,
      fixedScore: fixed.score,
      candidateScore: candidate.score,
      deltaScore,
      fixedCriticalCount: fixed.criticalCount,
      candidateCriticalCount: candidate.criticalCount,
      deltaCritical,
      fixedWarningCount: fixed.warningCount,
      candidateWarningCount: candidate.warningCount,
      deltaWarning,
      fixedHiddenElements: fixed.hiddenElements,
      candidateHiddenElements: candidate.hiddenElements,
      fixedHiddenElementsCount: fixed.hiddenElementsCount,
      candidateHiddenElementsCount: candidate.hiddenElementsCount,
      deltaHiddenElements,
      candidateBetter: deltaScore > 0,
      candidateWorse: deltaScore < 0,
      candidateEqual: deltaScore === 0,
    }
  })
}

export function summarizeFixedVsCandidateRows(rows: FixedVsCandidateRow[]): FixedVsCandidateSummary {
  const totalFormats = rows.length
  const totalDeltaScore = rows.reduce((sum, row) => sum + row.deltaScore, 0)
  const totalFixedHiddenElements = rows.reduce((sum, row) => sum + row.fixedHiddenElementsCount, 0)
  const totalCandidateHiddenElements = rows.reduce((sum, row) => sum + row.candidateHiddenElementsCount, 0)

  return {
    totalFormats,
    sameLayoutCount: rows.filter((row) => row.sameLayout).length,
    differentLayoutCount: rows.filter((row) => !row.sameLayout).length,
    candidateBetterCount: rows.filter((row) => row.candidateBetter).length,
    candidateEqualCount: rows.filter((row) => row.candidateEqual).length,
    candidateWorseCount: rows.filter((row) => row.candidateWorse).length,
    averageDeltaScore: totalFormats > 0 ? round(totalDeltaScore / totalFormats, 2) : 0,
    totalFixedHiddenElements,
    totalCandidateHiddenElements,
    deltaHiddenElementsTotal: totalFixedHiddenElements - totalCandidateHiddenElements,
  }
}

export function fixedVsCandidateRowsToCsv(rows: FixedVsCandidateRow[]): string {
  const body = rows.map((row) =>
    [
      row.formatId,
      row.formatName,
      row.group,
      row.fixedLayoutName,
      row.candidateSelectionName,
      row.sameLayout,
      row.fixedScore,
      row.candidateScore,
      row.deltaScore,
      row.fixedCriticalCount,
      row.candidateCriticalCount,
      row.deltaCritical,
      row.fixedWarningCount,
      row.candidateWarningCount,
      row.deltaWarning,
      row.fixedHiddenElements,
      row.candidateHiddenElements,
      row.fixedHiddenElementsCount,
      row.candidateHiddenElementsCount,
      row.deltaHiddenElements,
      row.candidateBetter,
      row.candidateWorse,
      row.candidateEqual,
    ]
      .map(csvEscape)
      .join(','),
  )

  return [CSV_HEADER.join(','), ...body].join('\n')
}

export function fixedVsCandidateSummaryToText(summary: FixedVsCandidateSummary): string {
  return [
    'Fixed-layout vs candidate selection',
    `- totalFormats: ${summary.totalFormats}`,
    `- sameLayoutCount: ${summary.sameLayoutCount}`,
    `- differentLayoutCount: ${summary.differentLayoutCount}`,
    `- candidateBetterCount: ${summary.candidateBetterCount}`,
    `- candidateEqualCount: ${summary.candidateEqualCount}`,
    `- candidateWorseCount: ${summary.candidateWorseCount}`,
    `- averageDeltaScore: ${summary.averageDeltaScore}`,
    `- totalFixedHiddenElements: ${summary.totalFixedHiddenElements}`,
    `- totalCandidateHiddenElements: ${summary.totalCandidateHiddenElements}`,
    `- deltaHiddenElementsTotal: ${summary.deltaHiddenElementsTotal}`,
  ].join('\n')
}

export function createFixedVsCandidateReport(result: ResearchResult): {
  rows: FixedVsCandidateRow[]
  summary: FixedVsCandidateSummary
  csv: string
  summaryText: string
} {
  const rows = buildFixedVsCandidateRows(result)
  const summary = summarizeFixedVsCandidateRows(rows)

  return {
    rows,
    summary,
    csv: fixedVsCandidateRowsToCsv(rows),
    summaryText: fixedVsCandidateSummaryToText(summary),
  }
}
