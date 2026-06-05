import { describe, expect, it } from 'vitest'
import {
  assertVisualReviewPngNames,
  expectedVisualReviewPngNames,
  parseVisualReviewKeyCsv,
} from './visualReviewKey'

const CSV = [
  'caseId,randomFileName,formatId,formatName,group,method,selectedLayout,score,actionsToFix,estimatedCorrectionTimeSec',
  'case_001,case_001.png,format-1,"Format, One",small,scaling,scaling,100,1,30',
  'case_002,case_002.png,format-1,"Format, One",small,fixedLayout,fixedLayout,90,2,60',
  'case_003,case_003.png,format-1,"Format, One",small,candidateSelection,compact,80,3,90',
].join('\n')

describe('visualReviewKey', () => {
  it('parses visual-review-key.csv rows with quoted values', () => {
    const rows = parseVisualReviewKeyCsv(CSV)

    expect(rows).toHaveLength(3)
    expect(rows[0]?.formatName).toBe('Format, One')
    expect(rows[0]?.method).toBe('scaling')
    expect(rows[2]?.score).toBe(80)
  })

  it('returns expected PNG file names', () => {
    const rows = parseVisualReviewKeyCsv(CSV)

    expect(expectedVisualReviewPngNames(rows)).toEqual(['case_001.png', 'case_002.png', 'case_003.png'])
  })

  it('accepts blind case PNG names', () => {
    const rows = parseVisualReviewKeyCsv(CSV)

    expect(() => assertVisualReviewPngNames(rows)).not.toThrow()
  })

  it('rejects file names that reveal the method', () => {
    const rows = parseVisualReviewKeyCsv(CSV)

    rows[0]!.randomFileName = 'case_001_scaling.png'

    expect(() => assertVisualReviewPngNames(rows)).toThrow(/reveals method/)
  })
})
