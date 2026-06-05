import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { ResearchResult } from './runResearch'
import {
  buildVisualReviewSample,
  decisionReportsToResearchDecisions,
  type VisualReviewKeyRow,
  type VisualReviewSheetRow,
} from './visualReviewSample'

export const VISUAL_REVIEW_SHEET_HEADER = [
  'caseId',
  'randomFileName',
  'manualScore',
  'readabilityOk',
  'requiredPreserved',
  'majorOverlap',
  'comment',
].join(',')

export const VISUAL_REVIEW_KEY_HEADER = [
  'caseId',
  'randomFileName',
  'formatId',
  'formatName',
  'group',
  'method',
  'selectedLayout',
  'score',
  'actionsToFix',
  'estimatedCorrectionTimeSec',
].join(',')

export const VISUAL_REVIEW_INSTRUCTION = [
  'Оценить каждый PNG без знания метода генерации.',
  '',
  'manualScore:',
  '0 - непригодно',
  '1 - требует ручной доработки',
  '2 - пригодно как стартовая заготовка',
  '',
  'readabilityOk:',
  'yes/no',
  '',
  'requiredPreserved:',
  'yes/no',
  '',
  'majorOverlap:',
  'yes/no',
  '',
  'comment:',
  'краткий комментарий, если есть проблема',
].join('\n')

export interface VisualReviewExportResult {
  directory: string
  sheetPath: string
  keyPath: string
  instructionPath: string
  sheetCsv: string
  keyCsv: string
  instruction: string
}

function csvEscape(value: string | number): string {
  const raw = String(value)

  if (!/[",\n\r]/.test(raw)) {
    return raw
  }

  return `"${raw.replace(/"/g, '""')}"`
}

export function visualReviewSheetRowsToCsv(rows: VisualReviewSheetRow[]): string {
  return [
    VISUAL_REVIEW_SHEET_HEADER,
    ...rows.map((row) =>
      [
        row.caseId,
        row.randomFileName,
        row.manualScore,
        row.readabilityOk,
        row.requiredPreserved,
        row.majorOverlap,
        row.comment,
      ]
        .map(csvEscape)
        .join(','),
    ),
  ].join('\n')
}

export function visualReviewKeyRowsToCsv(rows: VisualReviewKeyRow[]): string {
  return [
    VISUAL_REVIEW_KEY_HEADER,
    ...rows.map((row) =>
      [
        row.caseId,
        row.randomFileName,
        row.formatId,
        row.formatName,
        row.group,
        row.method,
        row.selectedLayout,
        row.score,
        row.actionsToFix,
        row.estimatedCorrectionTimeSec,
      ]
        .map(csvEscape)
        .join(','),
    ),
  ].join('\n')
}

export function exportVisualReview(result: ResearchResult, outputRoot = path.resolve(process.cwd(), 'research-results')): VisualReviewExportResult {
  const directory = path.join(outputRoot, 'visual-review')
  const decisions = decisionReportsToResearchDecisions(result.reports, result.formats)
  const sample = buildVisualReviewSample(decisions)
  const sheetCsv = visualReviewSheetRowsToCsv(sample.sheetRows)
  const keyCsv = visualReviewKeyRowsToCsv(sample.keyRows)
  const sheetPath = path.join(directory, 'visual-review-sheet.csv')
  const keyPath = path.join(directory, 'visual-review-key.csv')
  const instructionPath = path.join(directory, 'visual-review-instruction.txt')

  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true })
  }

  writeFileSync(sheetPath, sheetCsv, 'utf8')
  writeFileSync(keyPath, keyCsv, 'utf8')
  writeFileSync(instructionPath, VISUAL_REVIEW_INSTRUCTION, 'utf8')

  return {
    directory,
    sheetPath,
    keyPath,
    instructionPath,
    sheetCsv,
    keyCsv,
    instruction: VISUAL_REVIEW_INSTRUCTION,
  }
}
