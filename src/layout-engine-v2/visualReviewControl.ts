import type { VisualReviewKeyCsvRow } from './visualReviewKey'

export interface VisualReviewRatingInput {
  evaluatorId: string
  sourceFile: string
  caseId: string
  manualScore: number
  readabilityOk: boolean
  requiredPreserved: boolean
  majorOverlap: boolean
  comment: string
}

export interface VisualReviewCombinedRow extends VisualReviewKeyCsvRow, VisualReviewRatingInput {}

export interface VisualReviewStats {
  cases: number
  ratings: number
  averageManualScore: number
  score0Count: number
  score1Count: number
  score2Count: number
  readabilityOkRate: number
  requiredPreservedRate: number
  majorOverlapRate: number
}

export interface VisualReviewCaseStats extends VisualReviewStats {
  caseId: string
  randomFileName: string
  formatId: string
  formatName: string
  group: string
  method: string
  selectedLayout: string
  evaluatorIds: string
  fullAgreement: boolean
  strongDisagreement: boolean
  comments: string
}

export interface VisualReviewMethodStats extends VisualReviewStats {
  method: string
}

export interface VisualReviewEvaluatorStats extends VisualReviewStats {
  evaluatorId: string
}

export interface VisualReviewControlAnalysis {
  combinedRows: VisualReviewCombinedRow[]
  byMethod: VisualReviewMethodStats[]
  byCase: VisualReviewCaseStats[]
  byEvaluator: VisualReviewEvaluatorStats[]
  summary: VisualReviewStats & {
    totalCases: number
    totalRatings: number
    fullAgreementCases: number
    strongDisagreementCases: number
  }
}

export function parseCsvRecords(csv: string): Array<Record<string, string>> {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0)

  if (lines.length === 0) {
    return []
  }

  const header = parseCsvLine(lines[0]!)

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const record: Record<string, string> = {}

    header.forEach((key, index) => {
      record[key] = cells[index] ?? ''
    })

    return record
  })
}

export function recordsToCsv(records: Array<Record<string, string | number | boolean>>, headers: string[]): string {
  return [
    headers.join(','),
    ...records.map((record) => headers.map((header) => csvEscape(record[header] ?? '')).join(',')),
  ].join('\n')
}

export function normalizeRatingRecord(
  record: Record<string, string>,
  evaluatorId: string,
  sourceFile: string,
): VisualReviewRatingInput | null {
  const caseId = readString(record, ['caseId', 'case_id', 'case'])
  const scoreRaw = readString(record, ['manualScore', 'manual_score', 'score'])

  if (!caseId || !scoreRaw) {
    return null
  }

  const manualScore = Number(scoreRaw)

  if (!Number.isInteger(manualScore) || manualScore < 0 || manualScore > 2) {
    throw new Error(`Invalid control visual review score for ${caseId} in ${sourceFile}: "${scoreRaw}".`)
  }

  return {
    evaluatorId,
    sourceFile,
    caseId,
    manualScore,
    readabilityOk: readBoolean(record, ['readabilityOk', 'readability_ok', 'readable']),
    requiredPreserved: readBoolean(record, ['requiredPreserved', 'required_preserved', 'requiredOk']),
    majorOverlap: readBoolean(record, ['majorOverlap', 'major_overlap', 'overlap']),
    comment: readString(record, ['comment', 'comments', 'notes']),
  }
}

export function analyzeVisualReviewControl(
  keyRows: VisualReviewKeyCsvRow[],
  ratings: VisualReviewRatingInput[],
): VisualReviewControlAnalysis {
  const keyByCaseId = new Map(keyRows.map((row) => [row.caseId, row]))
  const combinedRows = ratings.map((rating): VisualReviewCombinedRow => {
    const key = keyByCaseId.get(rating.caseId)

    if (!key) {
      throw new Error(`Control visual review rating references unknown caseId "${rating.caseId}".`)
    }

    return {
      ...key,
      ...rating,
    }
  })

  const byCase = keyRows.map((key): VisualReviewCaseStats => {
    const caseRatings = combinedRows.filter((row) => row.caseId === key.caseId)
    const stats = calculateStats(caseRatings, 1)
    const scoreValues = caseRatings.map((row) => row.manualScore)
    const fullAgreement = caseRatings.length > 1 &&
      allSame(scoreValues) &&
      allSame(caseRatings.map((row) => row.readabilityOk)) &&
      allSame(caseRatings.map((row) => row.requiredPreserved)) &&
      allSame(caseRatings.map((row) => row.majorOverlap))
    const strongDisagreement = scoreValues.length > 1 && Math.max(...scoreValues) - Math.min(...scoreValues) >= 2

    return {
      caseId: key.caseId,
      randomFileName: key.randomFileName,
      formatId: key.formatId,
      formatName: key.formatName,
      group: key.group,
      method: key.method,
      selectedLayout: key.selectedLayout,
      evaluatorIds: [...new Set(caseRatings.map((row) => row.evaluatorId))].join('|'),
      ...stats,
      fullAgreement,
      strongDisagreement,
      comments: caseRatings.map((row) => row.comment).filter(Boolean).join('|'),
    }
  })

  const methods = [...new Set(keyRows.map((row) => row.method))]
  const evaluators = [...new Set(combinedRows.map((row) => row.evaluatorId))]

  return {
    combinedRows,
    byMethod: methods.map((method) => ({
      method,
      ...calculateStats(combinedRows.filter((row) => row.method === method), keyRows.filter((row) => row.method === method).length),
    })),
    byCase,
    byEvaluator: evaluators.map((evaluatorId) => ({
      evaluatorId,
      ...calculateStats(combinedRows.filter((row) => row.evaluatorId === evaluatorId), undefined),
    })),
    summary: {
      totalCases: keyRows.length,
      totalRatings: combinedRows.length,
      ...calculateStats(combinedRows, keyRows.length),
      fullAgreementCases: byCase.filter((row) => row.fullAgreement).length,
      strongDisagreementCases: byCase.filter((row) => row.strongDisagreement).length,
    },
  }
}

export function combinedRowsToCsv(rows: VisualReviewCombinedRow[]): string {
  const headers = [
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
    'evaluatorId',
    'sourceFile',
    'manualScore',
    'readabilityOk',
    'requiredPreserved',
    'majorOverlap',
    'comment',
  ]

  return recordsToCsv(rows as unknown as Array<Record<string, string | number | boolean>>, headers)
}

export function byMethodToCsv(rows: VisualReviewMethodStats[]): string {
  const headers = [
    'method',
    'cases',
    'ratings',
    'averageManualScore',
    'score0Count',
    'score1Count',
    'score2Count',
    'readabilityOkRate',
    'requiredPreservedRate',
    'majorOverlapRate',
  ]

  return recordsToCsv(rows as unknown as Array<Record<string, string | number | boolean>>, headers)
}

export function byCaseToCsv(rows: VisualReviewCaseStats[]): string {
  const headers = [
    'caseId',
    'randomFileName',
    'formatId',
    'formatName',
    'group',
    'method',
    'selectedLayout',
    'cases',
    'ratings',
    'averageManualScore',
    'score0Count',
    'score1Count',
    'score2Count',
    'readabilityOkRate',
    'requiredPreservedRate',
    'majorOverlapRate',
    'evaluatorIds',
    'fullAgreement',
    'strongDisagreement',
    'comments',
  ]

  return recordsToCsv(rows as unknown as Array<Record<string, string | number | boolean>>, headers)
}

export function renderControlSummary(analysis: VisualReviewControlAnalysis): string {
  const lines = [
    'control visual review / контрольная визуальная оценка',
    '',
    `totalCases: ${analysis.summary.totalCases}`,
    `totalRatings: ${analysis.summary.totalRatings}`,
    `averageManualScore: ${formatNumber(analysis.summary.averageManualScore)}`,
    `score0Count: ${analysis.summary.score0Count}`,
    `score1Count: ${analysis.summary.score1Count}`,
    `score2Count: ${analysis.summary.score2Count}`,
    `readabilityOkRate: ${formatNumber(analysis.summary.readabilityOkRate)}`,
    `requiredPreservedRate: ${formatNumber(analysis.summary.requiredPreservedRate)}`,
    `majorOverlapRate: ${formatNumber(analysis.summary.majorOverlapRate)}`,
    `fullAgreementCases: ${analysis.summary.fullAgreementCases}`,
    `strongDisagreementCases: ${analysis.summary.strongDisagreementCases}`,
    '',
    'by evaluator:',
    ...analysis.byEvaluator.map((row) =>
      [
        `- ${row.evaluatorId}: ratings=${row.ratings}`,
        `averageManualScore=${formatNumber(row.averageManualScore)}`,
        `score0=${row.score0Count}`,
        `score1=${row.score1Count}`,
        `score2=${row.score2Count}`,
        `readabilityOkRate=${formatNumber(row.readabilityOkRate)}`,
        `requiredPreservedRate=${formatNumber(row.requiredPreservedRate)}`,
        `majorOverlapRate=${formatNumber(row.majorOverlapRate)}`,
      ].join(', '),
    ),
  ]

  return lines.join('\n')
}

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

function csvEscape(value: string | number | boolean): string {
  const raw = String(value)

  if (!/[",\n\r]/.test(raw)) {
    return raw
  }

  return `"${raw.replace(/"/g, '""')}"`
}

function readString(record: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]

    if (value !== undefined && value.trim() !== '') {
      return value.trim()
    }
  }

  return ''
}

function readBoolean(record: Record<string, string>, keys: string[]): boolean {
  const value = readString(record, keys).toLowerCase()

  return value === 'yes' || value === 'true' || value === '1' || value === 'да'
}

function calculateStats(rows: VisualReviewCombinedRow[], explicitCaseCount: number | undefined): VisualReviewStats {
  const ratings = rows.length
  const scoreTotal = rows.reduce((sum, row) => sum + row.manualScore, 0)

  return {
    cases: explicitCaseCount ?? new Set(rows.map((row) => row.caseId)).size,
    ratings,
    averageManualScore: ratings > 0 ? scoreTotal / ratings : 0,
    score0Count: rows.filter((row) => row.manualScore === 0).length,
    score1Count: rows.filter((row) => row.manualScore === 1).length,
    score2Count: rows.filter((row) => row.manualScore === 2).length,
    readabilityOkRate: rate(rows.filter((row) => row.readabilityOk).length, ratings),
    requiredPreservedRate: rate(rows.filter((row) => row.requiredPreserved).length, ratings),
    majorOverlapRate: rate(rows.filter((row) => row.majorOverlap).length, ratings),
  }
}

function rate(count: number, total: number): number {
  return total > 0 ? count / total : 0
}

function allSame(values: unknown[]): boolean {
  if (values.length === 0) {
    return false
  }

  return values.every((value) => value === values[0])
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(4)
}
