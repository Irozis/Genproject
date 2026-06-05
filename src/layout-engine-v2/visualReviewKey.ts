import type { ResearchMethod } from './runResearch'
import type { FormatGroup } from './types'

export interface VisualReviewKeyCsvRow {
  caseId: string
  randomFileName: string
  formatId: string
  formatName: string
  group: FormatGroup
  method: ResearchMethod
  selectedLayout: string
  score: number
  actionsToFix: number
  estimatedCorrectionTimeSec: number
}

const EXPECTED_HEADER = [
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
]

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }

    current += char
  }

  cells.push(current)

  return cells
}

function isResearchMethod(value: string): value is ResearchMethod {
  return value === 'scaling' || value === 'fixedLayout' || value === 'candidateSelection'
}

function isFormatGroup(value: string): value is FormatGroup {
  return value === 'square' ||
    value === 'horizontal' ||
    value === 'vertical' ||
    value === 'small' ||
    value === 'wide' ||
    value === 'narrow' ||
    value === 'logo'
}

function readNumber(value: string, field: string, lineNumber: number): number {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    throw new Error(`Invalid visual review key CSV: ${field} is not a number at line ${lineNumber}.`)
  }

  return numberValue
}

export function parseVisualReviewKeyCsv(csv: string): VisualReviewKeyCsvRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    throw new Error('Invalid visual review key CSV: file is empty.')
  }

  const header = parseCsvLine(lines[0]!)

  if (header.join(',') !== EXPECTED_HEADER.join(',')) {
    throw new Error(`Invalid visual review key CSV header: expected "${EXPECTED_HEADER.join(',')}".`)
  }

  return lines.slice(1).map((line, index): VisualReviewKeyCsvRow => {
    const lineNumber = index + 2
    const cells = parseCsvLine(line)

    if (cells.length !== EXPECTED_HEADER.length) {
      throw new Error(`Invalid visual review key CSV: expected ${EXPECTED_HEADER.length} columns at line ${lineNumber}.`)
    }

    const [
      caseId,
      randomFileName,
      formatId,
      formatName,
      group,
      method,
      selectedLayout,
      score,
      actionsToFix,
      estimatedCorrectionTimeSec,
    ] = cells

    if (!caseId || !randomFileName || !formatId || !formatName || !group || !method || !selectedLayout) {
      throw new Error(`Invalid visual review key CSV: missing required field at line ${lineNumber}.`)
    }

    if (!isFormatGroup(group)) {
      throw new Error(`Invalid visual review key CSV: unsupported group "${group}" at line ${lineNumber}.`)
    }

    if (!isResearchMethod(method)) {
      throw new Error(`Invalid visual review key CSV: unsupported method "${method}" at line ${lineNumber}.`)
    }

    return {
      caseId,
      randomFileName,
      formatId,
      formatName,
      group,
      method,
      selectedLayout,
      score: readNumber(score ?? '', 'score', lineNumber),
      actionsToFix: readNumber(actionsToFix ?? '', 'actionsToFix', lineNumber),
      estimatedCorrectionTimeSec: readNumber(estimatedCorrectionTimeSec ?? '', 'estimatedCorrectionTimeSec', lineNumber),
    }
  })
}

export function expectedVisualReviewPngNames(rows: VisualReviewKeyCsvRow[]): string[] {
  return rows.map((row) => row.randomFileName)
}

export function assertVisualReviewPngNames(rows: VisualReviewKeyCsvRow[]): void {
  const seen = new Set<string>()

  for (const row of rows) {
    const expectedCaseFile = `${row.caseId}.png`

    if (/scaling|fixedLayout|candidateSelection/i.test(row.randomFileName)) {
      throw new Error(`Invalid visual review key CSV: randomFileName "${row.randomFileName}" reveals method.`)
    }

    if (row.randomFileName !== expectedCaseFile) {
      throw new Error(`Invalid visual review key CSV: ${row.caseId} must use randomFileName "${expectedCaseFile}".`)
    }

    if (!/^case_\d{3}\.png$/.test(row.randomFileName)) {
      throw new Error(`Invalid visual review key CSV: randomFileName "${row.randomFileName}" is not blind case filename.`)
    }

    if (seen.has(row.randomFileName)) {
      throw new Error(`Invalid visual review key CSV: duplicate randomFileName "${row.randomFileName}".`)
    }

    seen.add(row.randomFileName)
  }
}
