import { describe, expect, it } from 'vitest'
import { runResearch } from './runResearch'
import {
  researchSummaryTableToCsv,
  researchSummaryToText,
  toResearchSummaryTable,
} from './researchSummary'

describe('researchSummary', () => {
  it('converts research result to table rows', () => {
    const result = runResearch()
    const rows = toResearchSummaryTable(result)

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.method)).toEqual(['scaling', 'fixedLayout', 'candidateSelection'])

    for (const row of rows) {
      expect(row.totalFormats).toBe(result.formatCount)
      expect(row.clean + row.warningOnly + row.critical).toBe(result.formatCount)
      expect(row.withoutCritical).toBe(row.clean + row.warningOnly)
      expect(row.averageScore).toBeGreaterThanOrEqual(0)
      expect(row.totalActionsToFix).toBeGreaterThanOrEqual(0)
      expect(row.averageActionsToFix).toBeGreaterThanOrEqual(0)
      expect(row.estimatedCorrectionTimeSecTotal).toBe(row.totalActionsToFix * 30)
      expect(row.averageEstimatedCorrectionTimeSec).toBe(
        Math.round((row.estimatedCorrectionTimeSecTotal / row.totalFormats) * 100) / 100,
      )
    }
  })

  it('creates a summary CSV with one row per method', () => {
    const result = runResearch()
    const rows = toResearchSummaryTable(result)
    const csv = researchSummaryTableToCsv(rows)
    const lines = csv.split('\n')

    expect(lines[0]).toBe(
      [
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
        'totalActionsToFix',
        'averageActionsToFix',
        'estimatedCorrectionTimeSecTotal',
        'averageEstimatedCorrectionTimeSec',
      ].join(','),
    )

    expect(lines).toHaveLength(4)
    expect(csv).toContain('scaling')
    expect(csv).toContain('fixedLayout')
    expect(csv).toContain('candidateSelection')
  })

  it('creates a readable text summary', () => {
    const result = runResearch()
    const text = researchSummaryToText(result)

    expect(text).toContain(`Research result for project: ${result.projectId}`)
    expect(text).toContain('Scaling baseline:')
    expect(text).toContain('Fixed-layout baseline:')
    expect(text).toContain('Candidate selection:')
    expect(text).toContain('- total formats:')
    expect(text).toContain('- clean without issues:')
    expect(text).toContain('- without critical issues:')
    expect(text).toContain('- average score:')
    expect(text).toContain('- total actions to fix:')
    expect(text).toContain('- average actions to fix:')
    expect(text).toContain('- estimated correction time total:')
    expect(text).toContain('- estimated correction time average:')
  })

  it('is deterministic for identical research results', () => {
    const first = runResearch()
    const second = runResearch()

    expect(toResearchSummaryTable(second)).toEqual(toResearchSummaryTable(first))
    expect(researchSummaryToText(second)).toBe(researchSummaryToText(first))
    expect(researchSummaryTableToCsv(toResearchSummaryTable(second))).toBe(
      researchSummaryTableToCsv(toResearchSummaryTable(first)),
    )
  })
})
