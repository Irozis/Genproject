import { describe, expect, it } from 'vitest'
import { sampleFormats, sampleSourceMaterial } from './fixtures'
import { buildCandidateSelectionCandidates, runResearch } from './runResearch'
import type { CandidateReportRow } from './exportDecisionReport'

function selectedRow(rows: CandidateReportRow[]): CandidateReportRow {
  const selected = rows.find((row) => row.selected)

  if (!selected) {
    throw new Error('Missing selected report row.')
  }

  return selected
}

describe('runResearch', () => {
  it('runs all three methods for all sample formats', () => {
    const result = runResearch()

    expect(result.projectId).toBe(sampleSourceMaterial.id)
    expect(result.formatCount).toBe(sampleFormats.length)
    expect(result.formats).toEqual(sampleFormats)
    expect(result.methods).toEqual(['scaling', 'fixedLayout', 'candidateSelection'])
    expect(result.reports.length).toBe(sampleFormats.length * 3)
  })

  it('creates a summary row for each method', () => {
    const result = runResearch()

    expect(result.summary.map((item) => item.method)).toEqual(['scaling', 'fixedLayout', 'candidateSelection'])

    for (const summary of result.summary) {
      expect(summary.totalFormats).toBe(sampleFormats.length)
      expect(summary.averageScore).toBeGreaterThanOrEqual(0)
      expect(summary.totalScore).toBeGreaterThanOrEqual(0)
      expect(summary.clean + summary.warningOnly + summary.critical).toBe(sampleFormats.length)
      expect(summary.withoutCritical).toBe(summary.clean + summary.warningOnly)
      expect(summary.totalActionsToFix).toBeGreaterThanOrEqual(0)
      expect(summary.averageActionsToFix).toBe(summary.totalActionsToFix / summary.totalFormats)
      expect(summary.estimatedCorrectionTimeSecTotal).toBe(summary.totalActionsToFix * 30)
      expect(summary.averageEstimatedCorrectionTimeSec).toBe(summary.averageActionsToFix * 30)
    }
  })

  it('creates CSV containing all methods', () => {
    const result = runResearch()

    expect(result.csv).toContain('scaling')
    expect(result.csv).toContain('fixedLayout')
    expect(result.csv).toContain('candidateSelection')
    expect(result.csv).toContain('actionsToFix')
  })

  it('is deterministic for the same inputs', () => {
    const first = runResearch()
    const second = runResearch()

    expect(second).toEqual(first)
  })

  it('can run only candidateSelection when requested', () => {
    const result = runResearch({
      methods: ['candidateSelection'],
    })

    expect(result.methods).toEqual(['candidateSelection'])
    expect(result.reports.length).toBe(sampleFormats.length)
    expect(result.summary).toHaveLength(1)
    expect(result.summary[0]?.method).toBe('candidateSelection')
  })

  it('builds candidateSelection candidates with fixedLayout fallback first', () => {
    const format = sampleFormats[2]!
    const candidates = buildCandidateSelectionCandidates(sampleSourceMaterial, format)

    expect(candidates.length).toBeGreaterThan(1)
    expect(candidates[0]?.name).toBe('fixedLayout')
    expect(candidates[0]?.metadata?.methodFamily).toBe('candidateSelectionFallback')
    expect(candidates[0]?.metadata?.sourceCandidate).toBe('fixedLayout')
    expect(candidates.slice(1).some((candidate) => candidate.name !== 'fixedLayout')).toBe(true)
  })

  it('keeps candidateSelection no worse than fixedLayout by critical count', () => {
    const result = runResearch({
      methods: ['fixedLayout', 'candidateSelection'],
    })

    for (const format of sampleFormats) {
      const fixedReport = result.reports.find((report) => report.formatId === format.id && report.method === 'fixedLayout')
      const candidateReport = result.reports.find(
        (report) => report.formatId === format.id && report.method === 'candidateSelection',
      )

      expect(selectedRow(candidateReport?.rows ?? []).criticalCount).toBeLessThanOrEqual(
        selectedRow(fixedReport?.rows ?? []).criticalCount,
      )
    }
  })

  it('keeps candidateSelection no worse than fixedLayout by actionsToFix when critical counts tie', () => {
    const result = runResearch({
      methods: ['fixedLayout', 'candidateSelection'],
    })

    for (const format of sampleFormats) {
      const fixedReport = result.reports.find((report) => report.formatId === format.id && report.method === 'fixedLayout')
      const candidateReport = result.reports.find(
        (report) => report.formatId === format.id && report.method === 'candidateSelection',
      )
      const fixed = selectedRow(fixedReport?.rows ?? [])
      const candidate = selectedRow(candidateReport?.rows ?? [])

      if (candidate.criticalCount === fixed.criticalCount) {
        expect(candidate.actionsToFix).toBeLessThanOrEqual(fixed.actionsToFix)
      }
    }
  })

  it('keeps candidateSelection no worse than fixedLayout by score when critical and actions tie', () => {
    const result = runResearch({
      methods: ['fixedLayout', 'candidateSelection'],
    })

    for (const format of sampleFormats) {
      const fixedReport = result.reports.find((report) => report.formatId === format.id && report.method === 'fixedLayout')
      const candidateReport = result.reports.find(
        (report) => report.formatId === format.id && report.method === 'candidateSelection',
      )
      const fixed = selectedRow(fixedReport?.rows ?? [])
      const candidate = selectedRow(candidateReport?.rows ?? [])

      if (candidate.criticalCount === fixed.criticalCount && candidate.actionsToFix === fixed.actionsToFix) {
        expect(candidate.score).toBeLessThanOrEqual(fixed.score)
      }
    }
  })

  it('can run on a subset of formats', () => {
    const result = runResearch({
      formats: [sampleFormats[0]!, sampleFormats[1]!],
    })

    expect(result.formatCount).toBe(2)
    expect(result.reports.length).toBe(2 * 3)
  })
})
