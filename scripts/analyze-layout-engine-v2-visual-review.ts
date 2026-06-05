import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import {
  analyzeVisualReviewControl,
  byCaseToCsv,
  byMethodToCsv,
  combinedRowsToCsv,
  normalizeRatingRecord,
  parseCsvRecords,
  recordsToCsv,
  renderControlSummary,
  type VisualReviewRatingInput,
} from '../src/layout-engine-v2/visualReviewControl'
import { parseVisualReviewKeyCsv } from '../src/layout-engine-v2/visualReviewKey'

const VISUAL_REVIEW_DIR = path.resolve(process.cwd(), 'research-results', 'visual-review')
const KEY_CSV_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-key.csv')
const EVALUATOR_1_CSV_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-evaluator-1.csv')
const EVALUATOR_1_TEXT_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-evaluator-1.txt')
const CONTROL_ASSISTANT_CSV_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-sheet_filled_control_assistant.csv')
const FULL_REPORT_XLSX_PATH = path.join(VISUAL_REVIEW_DIR, 'visual_review_full_report.xlsx')
const EVALUATOR_CSV_PATTERN = /^visual-review-evaluator-.+\.csv$/i

const COMBINED_CSV_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-control-combined.csv')
const BY_METHOD_CSV_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-control-by-method.csv')
const SUMMARY_TXT_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-control-summary.txt')
const BY_CASE_CSV_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-control-by-case.csv')

interface RatingSource {
  evaluatorId: string
  filePath: string
  kind: 'csv' | 'xlsx'
}

function evaluatorIdFromFile(filePath: string): string {
  const fileName = path.basename(filePath)

  if (fileName === 'visual-review-evaluator-1.csv') {
    return 'evaluator-1'
  }

  if (fileName === 'visual-review-sheet_filled_control_assistant.csv') {
    return 'control-assistant'
  }

  if (fileName === 'visual_review_full_report.xlsx') {
    return 'full-report'
  }

  return fileName
    .replace(/^visual-review-/, '')
    .replace(/^visual_review_/, '')
    .replace(/\.(csv|xlsx)$/i, '')
}

async function createEvaluator1CsvFromTextIfPresent(): Promise<void> {
  if (existsSync(EVALUATOR_1_CSV_PATH) || !existsSync(EVALUATOR_1_TEXT_PATH)) {
    return
  }

  const text = await readFile(EVALUATOR_1_TEXT_PATH, 'utf8')
  const records = textToRatingRecords(text)

  if (records.length === 0) {
    throw new Error(`Cannot create visual-review-evaluator-1.csv: no case ratings found in ${EVALUATOR_1_TEXT_PATH}.`)
  }

  await writeFile(
    EVALUATOR_1_CSV_PATH,
    recordsToCsv(records, ['caseId', 'manualScore', 'readabilityOk', 'requiredPreserved', 'majorOverlap', 'comment']),
    'utf8',
  )
}

function textToRatingRecords(text: string): Array<Record<string, string>> {
  const records: Array<Record<string, string>> = []
  const lines = text.split(/\r?\n/)

  for (const line of lines) {
    const caseId = line.match(/case_\d{3}/)?.[0]

    if (!caseId) {
      continue
    }

    const manualScore = line.match(/(?:manualScore|score|оценка)\s*[:=]\s*([012])/i)?.[1] ?? line.match(/\b([012])\b/)?.[1]

    if (!manualScore) {
      continue
    }

    records.push({
      caseId,
      manualScore,
      readabilityOk: readInlineFlag(line, 'readabilityOk') ?? '',
      requiredPreserved: readInlineFlag(line, 'requiredPreserved') ?? '',
      majorOverlap: readInlineFlag(line, 'majorOverlap') ?? '',
      comment: line,
    })
  }

  return records
}

function readInlineFlag(line: string, key: string): string | undefined {
  return line.match(new RegExp(`${key}\\s*[:=]\\s*(yes|no|true|false|да|нет)`, 'i'))?.[1]
}

async function ratingSources(): Promise<RatingSource[]> {
  const files = existsSync(VISUAL_REVIEW_DIR) ? await readdir(VISUAL_REVIEW_DIR) : []
  const evaluatorCsvSources: RatingSource[] = files
    .filter((fileName) => EVALUATOR_CSV_PATTERN.test(fileName))
    .sort((first, second) => first.localeCompare(second, undefined, { numeric: true }))
    .map((fileName) => {
      const filePath = path.join(VISUAL_REVIEW_DIR, fileName)

      return {
        evaluatorId: evaluatorIdFromFile(filePath),
        filePath,
        kind: 'csv' as const,
      }
    })

  const optionalSources: RatingSource[] = [
    { evaluatorId: evaluatorIdFromFile(CONTROL_ASSISTANT_CSV_PATH), filePath: CONTROL_ASSISTANT_CSV_PATH, kind: 'csv' },
    { evaluatorId: evaluatorIdFromFile(FULL_REPORT_XLSX_PATH), filePath: FULL_REPORT_XLSX_PATH, kind: 'xlsx' },
  ].filter((source) => existsSync(source.filePath))

  return [...evaluatorCsvSources, ...optionalSources]
}

async function readRatingsFromSource(source: RatingSource): Promise<VisualReviewRatingInput[]> {
  const records = source.kind === 'csv'
    ? parseCsvRecords(await readFile(source.filePath, 'utf8'))
    : await readXlsxRecords(source.filePath)

  return records
    .map((record) => normalizeRatingRecord(record, source.evaluatorId, path.basename(source.filePath)))
    .filter((rating) => rating !== null)
}

async function readXlsxRecords(filePath: string): Promise<Array<Record<string, string>>> {
  const zip = await JSZip.loadAsync(await readFile(filePath))
  const sharedStrings = await readSharedStrings(zip)
  const sheetFiles = Object.keys(zip.files)
    .filter((fileName) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(fileName))
    .sort()
  const records: Array<Record<string, string>> = []

  for (const sheetFile of sheetFiles) {
    const xml = await zip.file(sheetFile)?.async('string')

    if (!xml) {
      continue
    }

    records.push(...worksheetXmlToRecords(xml, sharedStrings))
  }

  return records
}

async function readSharedStrings(zip: JSZip): Promise<string[]> {
  const xml = await zip.file('xl/sharedStrings.xml')?.async('string')

  if (!xml) {
    return []
  }

  return [...xml.matchAll(/<si\b[\s\S]*?<\/si>/g)].map((match) => {
    const item = match[0]
    const textParts = [...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => decodeXml(textMatch[1] ?? ''))

    return textParts.join('')
  })
}

function worksheetXmlToRecords(xml: string, sharedStrings: string[]): Array<Record<string, string>> {
  const rows = [...xml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)]
    .map((rowMatch) => cellsFromRowXml(rowMatch[0], sharedStrings))
    .filter((row) => row.some((cell) => cell.trim() !== ''))

  if (rows.length === 0) {
    return []
  }

  const header = rows[0]!

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {}

    header.forEach((key, index) => {
      if (key.trim()) {
        record[key.trim()] = row[index] ?? ''
      }
    })

    return record
  })
}

function cellsFromRowXml(rowXml: string, sharedStrings: string[]): string[] {
  const cells: string[] = []

  for (const cellMatch of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const attrs = cellMatch[1] ?? ''
    const body = cellMatch[2] ?? ''
    const cellRef = attrs.match(/\br="([A-Z]+)\d+"/)?.[1]
    const columnIndex = cellRef ? columnLettersToIndex(cellRef) : cells.length
    const type = attrs.match(/\bt="([^"]+)"/)?.[1]
    const rawValue = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? ''
    const decodedRawValue = decodeXml(rawValue)

    cells[columnIndex] = type === 's' ? sharedStrings[Number(decodedRawValue)] ?? '' : decodedRawValue
  }

  return cells.map((cell) => cell ?? '')
}

function columnLettersToIndex(letters: string): number {
  return letters.split('').reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1
}

function decodeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
}

async function main(): Promise<void> {
  if (!existsSync(KEY_CSV_PATH)) {
    throw new Error(`Missing visual-review-key.csv: ${KEY_CSV_PATH}`)
  }

  await createEvaluator1CsvFromTextIfPresent()

  const sources = await ratingSources()

  if (sources.length === 0) {
    throw new Error(
      [
        'No filled control visual review rating files found.',
        `Expected at least one of:`,
        `- ${path.join(VISUAL_REVIEW_DIR, 'visual-review-evaluator-*.csv')}`,
        `- ${CONTROL_ASSISTANT_CSV_PATH}`,
        `- ${FULL_REPORT_XLSX_PATH}`,
      ].join('\n'),
    )
  }

  const keyRows = parseVisualReviewKeyCsv(await readFile(KEY_CSV_PATH, 'utf8'))
  const ratings = (await Promise.all(sources.map(readRatingsFromSource))).flat()

  if (ratings.length === 0) {
    throw new Error('No filled control visual review ratings were parsed from the available files.')
  }

  const analysis = analyzeVisualReviewControl(keyRows, ratings)

  await mkdir(VISUAL_REVIEW_DIR, { recursive: true })
  await writeFile(COMBINED_CSV_PATH, combinedRowsToCsv(analysis.combinedRows), 'utf8')
  await writeFile(BY_METHOD_CSV_PATH, byMethodToCsv(analysis.byMethod), 'utf8')
  await writeFile(BY_CASE_CSV_PATH, byCaseToCsv(analysis.byCase), 'utf8')
  await writeFile(SUMMARY_TXT_PATH, renderControlSummary(analysis), 'utf8')

  console.log('control visual review analysis completed')
  console.log(`totalCases: ${analysis.summary.totalCases}`)
  console.log(`totalRatings: ${analysis.summary.totalRatings}`)
  console.log(`output: ${path.relative(process.cwd(), VISUAL_REVIEW_DIR).replace(/\\/g, '/')}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
