import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getDefaultProjectSourceMaterial } from '../src/layout-engine-v2/defaultProjectSource'
import { createFixedVsCandidateReport } from '../src/layout-engine-v2/fixedVsCandidateReport'
import { runCatalogResearch } from '../src/layout-engine-v2/runCatalogResearch'
import {
  researchSummaryTableToCsv,
  researchSummaryToText,
  toResearchSummaryTable,
} from '../src/layout-engine-v2/researchSummary'

const OUTPUT_DIR = path.resolve(process.cwd(), 'research-results')

function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

function writeTextFile(fileName: string, content: string): void {
  writeFileSync(path.join(OUTPUT_DIR, fileName), content, 'utf8')
}

function main(): void {
  ensureOutputDir()

  const source = getDefaultProjectSourceMaterial()

  const result = runCatalogResearch({
    source,
  })

  const summaryTable = toResearchSummaryTable(result)
  const summaryCsv = researchSummaryTableToCsv(summaryTable)
  const summaryText = researchSummaryToText(result)
  const fixedVsCandidateReport = createFixedVsCandidateReport(result)

  const jsonReport = {
    projectId: result.projectId,
    formatCount: result.formatCount,
    formats: result.formats,
    methods: result.methods,
    summary: result.summary,
    fixedVsCandidateSummary: fixedVsCandidateReport.summary,
    reports: result.reports,
  }

  writeTextFile('layout-v2-decisions.csv', result.csv)
  writeTextFile('layout-v2-summary.csv', summaryCsv)
  writeTextFile('layout-v2-summary.txt', summaryText)
  writeTextFile('layout-v2-fixed-vs-candidate.csv', fixedVsCandidateReport.csv)
  writeTextFile('layout-v2-fixed-vs-candidate-summary.txt', fixedVsCandidateReport.summaryText)
  writeTextFile('layout-v2-report.json', JSON.stringify(jsonReport, null, 2))

  console.log(`layout-engine-v2 research completed`)
  console.log(`projectId: ${result.projectId}`)
  console.log(`formats: ${result.formatCount}`)
  console.log(`methods: ${result.methods.join(', ')}`)
  console.log(`output: ${OUTPUT_DIR}`)
  console.log('')
  console.log(summaryText)
}

main()
