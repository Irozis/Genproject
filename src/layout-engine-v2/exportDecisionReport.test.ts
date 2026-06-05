import { describe, expect, it } from 'vitest'
import { buildFixedLayoutCandidate } from './fixedLayoutBaseline'
import { sampleFormats, sampleSourceMaterial } from './fixtures'
import { generateLayoutCandidates } from './generateCandidates'
import { selectBestLayoutCandidate } from './selectBestCandidate'
import {
  DECISION_REPORT_CSV_HEADER,
  countIssuesByType,
  createDecisionReport,
  decisionReportToCsv,
  decisionReportsToCsv,
} from './exportDecisionReport'
import type { FormatSpecV2, ValidationIssue } from './types'

function formatById(id: string): FormatSpecV2 {
  const format = sampleFormats.find((item) => item.id === id)

  if (!format) {
    throw new Error(`Missing test format: ${id}`)
  }

  return format
}

function decisionForFormat(formatId: string) {
  const format = formatById(formatId)
  const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

  return selectBestLayoutCandidate(candidates, format)
}

describe('exportDecisionReport', () => {
  it('counts issues by type', () => {
    const issues: ValidationIssue[] = [
      {
        type: 'out_of_bounds',
        severity: 'critical',
        elementId: 'headline',
        message: 'out',
        penalty: 800,
      },
      {
        type: 'out_of_bounds',
        severity: 'warning',
        elementId: 'logo',
        message: 'out',
        penalty: 800,
      },
      {
        type: 'hidden_optional',
        severity: 'warning',
        elementId: 'cta',
        message: 'hidden',
        penalty: 50,
      },
    ]

    expect(countIssuesByType(issues, 'out_of_bounds')).toBe(2)
    expect(countIssuesByType(issues, 'hidden_optional')).toBe(1)
    expect(countIssuesByType(issues, 'overlap')).toBe(0)
  })

  it('creates a report with one row per evaluated candidate', () => {
    const decision = decisionForFormat('horizontal-1200x628')
    const report = createDecisionReport({
      projectId: sampleSourceMaterial.id,
      method: 'candidateSelection',
      decision,
    })

    expect(report.projectId).toBe(sampleSourceMaterial.id)
    expect(report.formatId).toBe('horizontal-1200x628')
    expect(report.method).toBe('candidateSelection')
    expect(report.candidateCount).toBe(1 + decision.rejected.length)
    expect(report.rejectedCount).toBe(decision.rejected.length)
    expect(report.rows.length).toBe(report.candidateCount)
  })

  it('marks exactly one row as selected', () => {
    const decision = decisionForFormat('horizontal-1200x628')
    const report = createDecisionReport({
      projectId: sampleSourceMaterial.id,
      method: 'candidateSelection',
      decision,
    })

    expect(report.rows.filter((row) => row.selected)).toHaveLength(1)
    expect(report.rows.find((row) => row.selected)?.candidateId).toBe(decision.selected.candidate.id)
  })

  it('copies selected candidate metrics to the report summary', () => {
    const decision = decisionForFormat('horizontal-1200x628')
    const report = createDecisionReport({
      projectId: sampleSourceMaterial.id,
      method: 'candidateSelection',
      decision,
    })

    expect(report.selectedCandidateId).toBe(decision.selected.candidate.id)
    expect(report.selectedLayout).toBe(decision.selected.candidate.name)
    expect(report.selectedScore).toBe(decision.selected.score)
    expect(report.selectedCriticalCount).toBe(decision.selected.criticalCount)
    expect(report.selectedWarningCount).toBe(decision.selected.warningCount)
  })

  it('keeps candidate metadata in report rows', () => {
    const format = formatById('horizontal-1200x628')
    const fixedCandidate = buildFixedLayoutCandidate(sampleSourceMaterial, format)
    const decision = selectBestLayoutCandidate([fixedCandidate], format)
    const report = createDecisionReport({
      projectId: sampleSourceMaterial.id,
      method: 'fixedLayout',
      decision,
    })

    expect(report.rows[0]?.methodFamily).toBe('fixedLayout')
    expect(report.rows[0]?.candidateCount).toBe(1)
    expect(report.rows[0]?.decisionMode).toBe('predefined-template')
  })

  it('creates a CSV string with a header and candidate rows', () => {
    const decision = decisionForFormat('horizontal-1200x628')
    const report = createDecisionReport({
      projectId: sampleSourceMaterial.id,
      method: 'candidateSelection',
      decision,
    })
    const csv = decisionReportToCsv(report)
    const lines = csv.split('\n')

    expect(lines[0]).toBe(DECISION_REPORT_CSV_HEADER)
    expect(lines.length).toBe(report.rows.length + 1)
    expect(csv).toContain('candidateSelection')
    expect(csv).toContain(report.selectedLayout)
  })

  it('creates a combined CSV for multiple reports with a single header', () => {
    const first = createDecisionReport({
      projectId: sampleSourceMaterial.id,
      method: 'candidateSelection',
      decision: decisionForFormat('horizontal-1200x628'),
    })
    const second = createDecisionReport({
      projectId: sampleSourceMaterial.id,
      method: 'candidateSelection',
      decision: decisionForFormat('small-320x50'),
    })
    const csv = decisionReportsToCsv([first, second])
    const lines = csv.split('\n')

    expect(lines[0]).toBe(DECISION_REPORT_CSV_HEADER)
    expect(lines.length).toBe(first.rows.length + second.rows.length + 1)
    expect(lines.filter((line) => line === DECISION_REPORT_CSV_HEADER)).toHaveLength(1)
  })

  it('is deterministic for the same decision input', () => {
    const decision = decisionForFormat('horizontal-1200x628')
    const first = createDecisionReport({
      projectId: sampleSourceMaterial.id,
      method: 'candidateSelection',
      decision,
    })
    const second = createDecisionReport({
      projectId: sampleSourceMaterial.id,
      method: 'candidateSelection',
      decision,
    })

    expect(second).toEqual(first)
    expect(decisionReportToCsv(second)).toBe(decisionReportToCsv(first))
  })

  it('escapes CSV values that contain commas or quotes', () => {
    const decision = decisionForFormat('horizontal-1200x628')
    const report = createDecisionReport({
      projectId: 'project,with,"quotes"',
      method: 'candidateSelection',
      decision,
    })
    const csv = decisionReportToCsv(report)

    expect(csv).toContain('"project,with,""quotes"""')
  })
})
