import { describe, expect, it } from 'vitest'
import { buildVisualReviewSample, type ResearchDecision } from './visualReviewSample'
import type { FormatGroup } from './types'

const GROUPS: FormatGroup[] = ['small', 'wide', 'horizontal', 'vertical', 'square', 'narrow', 'logo']
const METHODS: ResearchDecision['method'][] = ['scaling', 'fixedLayout', 'candidateSelection']

function buildDecisions(formatCount = 42): ResearchDecision[] {
  return Array.from({ length: formatCount }, (_, index) => {
    const group = GROUPS[index % GROUPS.length]!
    const formatNumber = String(index + 1).padStart(3, '0')

    return METHODS.map((method, methodIndex): ResearchDecision => ({
      formatId: `${group}-${formatNumber}`,
      formatName: `${group} format ${formatNumber}`,
      group,
      method,
      selectedLayout: method === 'scaling' ? 'scaling' : method === 'fixedLayout' ? 'fixedLayout' : 'hero',
      score: 1000 - index - methodIndex,
      actionsToFix: methodIndex,
      estimatedCorrectionTimeSec: methodIndex * 30,
    }))
  }).flat()
}

describe('visualReviewSample', () => {
  it('returns 90 sheet rows and 90 key rows when a full decision set is available', () => {
    const sample = buildVisualReviewSample(buildDecisions())

    expect(sample.sheetRows).toHaveLength(90)
    expect(sample.keyRows).toHaveLength(90)
  })

  it('keeps method, format id, score, and layout out of the blind sheet rows', () => {
    const sample = buildVisualReviewSample(buildDecisions())
    const row = sample.sheetRows[0] as unknown as Record<string, unknown>

    expect(row.method).toBeUndefined()
    expect(row.formatId).toBeUndefined()
    expect(row.score).toBeUndefined()
    expect(row.selectedLayout).toBeUndefined()
    expect(Object.keys(row)).toEqual([
      'caseId',
      'randomFileName',
      'manualScore',
      'readabilityOk',
      'requiredPreserved',
      'majorOverlap',
      'comment',
    ])
  })

  it('includes method, format id, selected layout, score, and fix estimates in key rows', () => {
    const sample = buildVisualReviewSample(buildDecisions())
    const row = sample.keyRows[0]!

    expect(row.method).toBe('scaling')
    expect(row.formatId).toBeTruthy()
    expect(row.selectedLayout).toBe('scaling')
    expect(row.score).toBeTypeOf('number')
    expect(row.actionsToFix).toBeTypeOf('number')
    expect(row.estimatedCorrectionTimeSec).toBeTypeOf('number')
  })

  it('uses deterministic case ids and random file names', () => {
    const sample = buildVisualReviewSample(buildDecisions())

    expect(sample.sheetRows[0]?.caseId).toBe('case_001')
    expect(sample.sheetRows[0]?.randomFileName).toBe('case_001.png')
    expect(sample.sheetRows[89]?.caseId).toBe('case_090')
    expect(sample.sheetRows[89]?.randomFileName).toBe('case_090.png')
    expect(sample.keyRows.map((row) => row.caseId)).toEqual(sample.sheetRows.map((row) => row.caseId))
    expect(sample.keyRows.map((row) => row.randomFileName)).toEqual(sample.sheetRows.map((row) => row.randomFileName))
  })

  it('keeps manual review columns empty in the sheet rows', () => {
    const sample = buildVisualReviewSample(buildDecisions())

    expect(sample.sheetRows.every((row) => row.manualScore === '')).toBe(true)
    expect(sample.sheetRows.every((row) => row.readabilityOk === '')).toBe(true)
    expect(sample.sheetRows.every((row) => row.requiredPreserved === '')).toBe(true)
    expect(sample.sheetRows.every((row) => row.majorOverlap === '')).toBe(true)
    expect(sample.sheetRows.every((row) => row.comment === '')).toBe(true)
  })

  it('includes rows for all three methods', () => {
    const sample = buildVisualReviewSample(buildDecisions())
    const methods = new Set(sample.keyRows.map((row) => row.method))

    expect(methods).toEqual(new Set(['scaling', 'fixedLayout', 'candidateSelection']))
  })

  it('covers diverse format groups when they exist in the decision set', () => {
    const sample = buildVisualReviewSample(buildDecisions())
    const groups = new Set(sample.keyRows.map((row) => row.group))

    for (const group of GROUPS) {
      expect(groups.has(group)).toBe(true)
    }
  })

  it('is deterministic for the same decision input', () => {
    const decisions = buildDecisions()

    expect(buildVisualReviewSample(decisions)).toEqual(buildVisualReviewSample(decisions))
  })
})
