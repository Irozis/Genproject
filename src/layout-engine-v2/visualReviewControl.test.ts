import { describe, expect, it } from 'vitest'
import {
  analyzeVisualReviewControl,
  byMethodToCsv,
  combinedRowsToCsv,
  normalizeRatingRecord,
  parseCsvRecords,
  renderControlSummary,
} from './visualReviewControl'
import type { VisualReviewKeyCsvRow } from './visualReviewKey'

const keyRows: VisualReviewKeyCsvRow[] = [
  {
    caseId: 'case_001',
    randomFileName: 'case_001.png',
    formatId: 'format-a',
    formatName: 'Format A',
    group: 'small',
    method: 'scaling',
    selectedLayout: 'scaling',
    score: 100,
    actionsToFix: 1,
    estimatedCorrectionTimeSec: 30,
  },
  {
    caseId: 'case_002',
    randomFileName: 'case_002.png',
    formatId: 'format-a',
    formatName: 'Format A',
    group: 'small',
    method: 'fixedLayout',
    selectedLayout: 'fixedLayout',
    score: 100,
    actionsToFix: 0,
    estimatedCorrectionTimeSec: 0,
  },
]

describe('visualReviewControl', () => {
  it('parses and normalizes filled rating records', () => {
    const records = parseCsvRecords([
      'caseId,manualScore,readabilityOk,requiredPreserved,majorOverlap,comment',
      'case_001,2,yes,yes,no,"looks, ok"',
    ].join('\n'))
    const rating = normalizeRatingRecord(records[0]!, 'evaluator-a', 'ratings.csv')

    expect(rating).toEqual({
      evaluatorId: 'evaluator-a',
      sourceFile: 'ratings.csv',
      caseId: 'case_001',
      manualScore: 2,
      readabilityOk: true,
      requiredPreserved: true,
      majorOverlap: false,
      comment: 'looks, ok',
    })
  })

  it('aggregates summary, method stats, evaluator stats, and disagreement', () => {
    const analysis = analyzeVisualReviewControl(keyRows, [
      {
        evaluatorId: 'a',
        sourceFile: 'a.csv',
        caseId: 'case_001',
        manualScore: 2,
        readabilityOk: true,
        requiredPreserved: true,
        majorOverlap: false,
        comment: '',
      },
      {
        evaluatorId: 'b',
        sourceFile: 'b.csv',
        caseId: 'case_001',
        manualScore: 0,
        readabilityOk: false,
        requiredPreserved: false,
        majorOverlap: true,
        comment: 'bad',
      },
      {
        evaluatorId: 'a',
        sourceFile: 'a.csv',
        caseId: 'case_002',
        manualScore: 1,
        readabilityOk: true,
        requiredPreserved: true,
        majorOverlap: false,
        comment: '',
      },
    ])

    expect(analysis.summary.totalCases).toBe(2)
    expect(analysis.summary.totalRatings).toBe(3)
    expect(analysis.summary.averageManualScore).toBe(1)
    expect(analysis.summary.score0Count).toBe(1)
    expect(analysis.summary.score1Count).toBe(1)
    expect(analysis.summary.score2Count).toBe(1)
    expect(analysis.summary.strongDisagreementCases).toBe(1)
    expect(analysis.byMethod.find((row) => row.method === 'scaling')?.ratings).toBe(2)
    expect(analysis.byEvaluator.find((row) => row.evaluatorId === 'a')?.ratings).toBe(2)
  })

  it('serializes combined and method CSV outputs', () => {
    const analysis = analyzeVisualReviewControl(keyRows, [
      {
        evaluatorId: 'a',
        sourceFile: 'a.csv',
        caseId: 'case_001',
        manualScore: 2,
        readabilityOk: true,
        requiredPreserved: true,
        majorOverlap: false,
        comment: '',
      },
    ])

    expect(combinedRowsToCsv(analysis.combinedRows).split('\n')[0]).toContain('evaluatorId')
    expect(byMethodToCsv(analysis.byMethod).split('\n')[0]).toBe(
      'method,cases,ratings,averageManualScore,score0Count,score1Count,score2Count,readabilityOkRate,requiredPreservedRate,majorOverlapRate',
    )
  })

  it('uses control visual review terminology in summary', () => {
    const analysis = analyzeVisualReviewControl(keyRows, [])
    const summary = renderControlSummary(analysis)

    expect(summary).toContain('control visual review / контрольная визуальная оценка')
    expect(summary).not.toContain('independent')
  })
})
