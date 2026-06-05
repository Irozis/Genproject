import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DecisionReport } from './exportDecisionReport'
import {
  VISUAL_REVIEW_INSTRUCTION,
  VISUAL_REVIEW_KEY_HEADER,
  VISUAL_REVIEW_SHEET_HEADER,
  exportVisualReview,
  visualReviewKeyRowsToCsv,
  visualReviewSheetRowsToCsv,
} from './exportVisualReview'
import type { ResearchResult } from './runResearch'
import type { FormatGroup, FormatSpecV2 } from './types'
import type { VisualReviewKeyRow, VisualReviewSheetRow } from './visualReviewSample'

const GROUPS: FormatGroup[] = ['small', 'wide', 'horizontal', 'vertical', 'square', 'narrow', 'logo']
const METHODS = ['scaling', 'fixedLayout', 'candidateSelection'] as const

function buildFormats(count = 35): FormatSpecV2[] {
  return Array.from({ length: count }, (_, index) => {
    const group = GROUPS[index % GROUPS.length]!
    const size = index + 1

    return {
      id: `${group}-${String(size).padStart(3, '0')}`,
      name: `${group} format ${size}`,
      width: 100 + size,
      height: 100 + size,
      aspectRatio: 1,
      group,
      safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
    }
  })
}

function buildReport(format: FormatSpecV2, method: (typeof METHODS)[number], index: number): DecisionReport {
  return {
    projectId: 'project',
    formatId: format.id,
    method,
    selectedCandidateId: `${format.id}:${method}`,
    selectedLayout: method === 'scaling' ? 'scaling' : method === 'fixedLayout' ? 'fixedLayout' : 'hero',
    selectedScore: 900 - index,
    selectedCriticalCount: 0,
    selectedWarningCount: 0,
    candidateCount: 1,
    rejectedCount: 0,
    reason: 'selected',
    rows: [
      {
        projectId: 'project',
        formatId: format.id,
        method,
        candidateId: `${format.id}:${method}`,
        candidateName: method === 'candidateSelection' ? 'hero' : method,
        methodFamily: method,
        candidateCount: 1,
        decisionMode: 'test',
        selected: true,
        score: 900 - index,
        criticalCount: 0,
        warningCount: 0,
        outOfBoundsCount: 0,
        overlapCount: 0,
        textTooSmallCount: 0,
        missingRequiredCount: 0,
        unsafeZoneCount: 0,
        excessiveCropCount: 0,
        emptySpaceCount: 0,
        hiddenOptionalCount: 0,
        hiddenElementsCount: 0,
        hiddenElements: '',
        actionsToFix: index % 4,
        estimatedCorrectionTimeSec: (index % 4) * 30,
        fixReasons: '',
        issueSummary: 'none',
        reason: 'selected',
      },
    ],
  }
}

function buildResult(): ResearchResult {
  const formats = buildFormats()
  const reports = formats.flatMap((format, formatIndex) => METHODS.map((method) => buildReport(format, method, formatIndex)))

  return {
    projectId: 'project',
    formatCount: formats.length,
    formats,
    methods: [...METHODS],
    reports,
    csv: '',
    summary: [],
  }
}

describe('exportVisualReview', () => {
  it('creates CSV strings with the expected headers', () => {
    const sheetRows: VisualReviewSheetRow[] = [
      {
        caseId: 'case_001',
        randomFileName: 'case_001.png',
        manualScore: '',
        readabilityOk: '',
        requiredPreserved: '',
        majorOverlap: '',
        comment: '',
      },
    ]
    const keyRows: VisualReviewKeyRow[] = [
      {
        caseId: 'case_001',
        randomFileName: 'case_001.png',
        formatId: 'format-1',
        formatName: 'Format, with comma',
        group: 'square',
        method: 'candidateSelection',
        selectedLayout: 'hero',
        score: 100,
        actionsToFix: 1,
        estimatedCorrectionTimeSec: 30,
      },
    ]

    expect(visualReviewSheetRowsToCsv(sheetRows).split('\n')[0]).toBe(VISUAL_REVIEW_SHEET_HEADER)
    expect(visualReviewKeyRowsToCsv(keyRows).split('\n')[0]).toBe(VISUAL_REVIEW_KEY_HEADER)
    expect(visualReviewKeyRowsToCsv(keyRows)).toContain('"Format, with comma"')
  })

  it('writes sheet, key, and instruction files under visual-review', () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'layout-v2-visual-review-'))
    const result = exportVisualReview(buildResult(), outputRoot)

    expect(result.directory).toBe(path.join(outputRoot, 'visual-review'))
    expect(existsSync(result.sheetPath)).toBe(true)
    expect(existsSync(result.keyPath)).toBe(true)
    expect(existsSync(result.instructionPath)).toBe(true)
    expect(readFileSync(result.sheetPath, 'utf8').split('\n')[0]).toBe(VISUAL_REVIEW_SHEET_HEADER)
    expect(readFileSync(result.keyPath, 'utf8').split('\n')[0]).toBe(VISUAL_REVIEW_KEY_HEADER)
    expect(readFileSync(result.instructionPath, 'utf8')).toBe(VISUAL_REVIEW_INSTRUCTION)
  })

  it('exports a 90-row blind sheet and matching 90-row key for a full decision set', () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'layout-v2-visual-review-'))
    const result = exportVisualReview(buildResult(), outputRoot)
    const sheetLines = readFileSync(result.sheetPath, 'utf8').split('\n')
    const keyLines = readFileSync(result.keyPath, 'utf8').split('\n')

    expect(sheetLines).toHaveLength(91)
    expect(keyLines).toHaveLength(91)
    expect(sheetLines[1]?.startsWith('case_001,case_001.png,,,,,')).toBe(true)
    expect(keyLines[1]).toContain('case_001,case_001.png,')
  })

  it('keeps method and score out of the blind sheet CSV', () => {
    const outputRoot = mkdtempSync(path.join(tmpdir(), 'layout-v2-visual-review-'))
    const result = exportVisualReview(buildResult(), outputRoot)
    const sheetHeader = readFileSync(result.sheetPath, 'utf8').split('\n')[0]

    expect(sheetHeader).not.toContain('method')
    expect(sheetHeader).not.toContain('formatId')
    expect(sheetHeader).not.toContain('score')
    expect(sheetHeader).not.toContain('selectedLayout')
  })

  it('includes the 0/1/2 manual score scale in the instruction', () => {
    expect(VISUAL_REVIEW_INSTRUCTION).toContain('0 - непригодно')
    expect(VISUAL_REVIEW_INSTRUCTION).toContain('1 - требует ручной доработки')
    expect(VISUAL_REVIEW_INSTRUCTION).toContain('2 - пригодно как стартовая заготовка')
  })
})
