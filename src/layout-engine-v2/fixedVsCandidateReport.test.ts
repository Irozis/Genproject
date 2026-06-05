import { describe, expect, it } from 'vitest'
import {
  buildFixedVsCandidateRows,
  createFixedVsCandidateReport,
  fixedVsCandidateRowsToCsv,
  fixedVsCandidateSummaryToText,
  summarizeFixedVsCandidateRows,
} from './fixedVsCandidateReport'
import { sampleFormats } from './fixtures'
import { runResearch } from './runResearch'

describe('fixedVsCandidateReport', () => {
  it('builds one comparison row per format', () => {
    const result = runResearch({
      formats: [sampleFormats[2]!],
      methods: ['fixedLayout', 'candidateSelection'],
    })
    const rows = buildFixedVsCandidateRows(result)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.formatId).toBe('horizontal-1200x628')
    expect(rows[0]?.formatName).toBe('Horizontal 1200x628')
    expect(rows[0]?.group).toBe('horizontal')
    expect(rows[0]?.fixedLayoutName).toBe('split')
    expect(rows[0]?.candidateSelectionName).toBeTruthy()
  })

  it('calculates deltas and candidate result flags', () => {
    const result = runResearch({
      formats: [sampleFormats[2]!],
      methods: ['fixedLayout', 'candidateSelection'],
    })
    const row = buildFixedVsCandidateRows(result)[0]!

    expect(row.deltaScore).toBe(row.fixedScore - row.candidateScore)
    expect(row.deltaCritical).toBe(row.fixedCriticalCount - row.candidateCriticalCount)
    expect(row.deltaWarning).toBe(row.fixedWarningCount - row.candidateWarningCount)
    expect(row.deltaHiddenElements).toBe(row.fixedHiddenElementsCount - row.candidateHiddenElementsCount)
    expect([row.candidateBetter, row.candidateWorse, row.candidateEqual].filter(Boolean)).toHaveLength(1)
    expect(row.candidateBetter).toBe(row.deltaScore > 0)
    expect(row.candidateWorse).toBe(row.deltaScore < 0)
    expect(row.candidateEqual).toBe(row.deltaScore === 0)
  })

  it('summarizes pairwise comparison rows', () => {
    const rows = buildFixedVsCandidateRows(
      runResearch({
        formats: [sampleFormats[0]!, sampleFormats[1]!, sampleFormats[2]!],
        methods: ['fixedLayout', 'candidateSelection'],
      }),
    )
    const summary = summarizeFixedVsCandidateRows(rows)

    expect(summary.totalFormats).toBe(3)
    expect(summary.sameLayoutCount + summary.differentLayoutCount).toBe(3)
    expect(summary.candidateBetterCount + summary.candidateEqualCount + summary.candidateWorseCount).toBe(3)
    expect(summary.deltaHiddenElementsTotal).toBe(summary.totalFixedHiddenElements - summary.totalCandidateHiddenElements)
  })

  it('writes the requested CSV header', () => {
    const rows = buildFixedVsCandidateRows(
      runResearch({
        formats: [sampleFormats[2]!],
        methods: ['fixedLayout', 'candidateSelection'],
      }),
    )
    const csv = fixedVsCandidateRowsToCsv(rows)

    expect(csv.split('\n')[0]).toBe(
      [
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
      ].join(','),
    )
  })

  it('creates a text summary with requested fields', () => {
    const report = createFixedVsCandidateReport(
      runResearch({
        formats: [sampleFormats[2]!],
        methods: ['fixedLayout', 'candidateSelection'],
      }),
    )
    const text = fixedVsCandidateSummaryToText(report.summary)

    expect(text).toContain('- totalFormats: 1')
    expect(text).toContain('- sameLayoutCount:')
    expect(text).toContain('- candidateBetterCount:')
    expect(text).toContain('- deltaHiddenElementsTotal:')
  })
})
