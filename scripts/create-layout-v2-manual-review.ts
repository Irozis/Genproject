import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getDefaultProjectSourceMaterial } from '../src/layout-engine-v2/defaultProjectSource'
import { getCatalogFormatsV2 } from '../src/layout-engine-v2/runCatalogResearch'
import {
  buildFixedLayoutCandidate,
  buildScalingCandidate,
  type ResearchMethod,
} from '../src/layout-engine-v2/runResearch'
import { generateLayoutCandidates } from '../src/layout-engine-v2/generateCandidates'
import { selectBestLayoutCandidate } from '../src/layout-engine-v2/selectBestCandidate'
import type {
  CandidateEvaluation,
  FormatGroup,
  FormatSpecV2,
  LayoutCandidate,
  LayoutDecision,
  LayoutElement,
  SourceMaterialV2,
  ValidationIssue,
  ValidationIssueType,
} from '../src/layout-engine-v2/types'

const OUTPUT_DIR = path.resolve(process.cwd(), 'research-results', 'manual-review')
const REVIEW_FORMAT_COUNT = 20
const METHODS: ResearchMethod[] = ['scaling', 'fixedLayout', 'candidateSelection']

interface ManualReviewCase {
  caseId: string
  format: FormatSpecV2
  method: ResearchMethod
  decision: LayoutDecision
  selected: CandidateEvaluation
}

interface ManualReviewJson {
  projectId: string
  formatCount: number
  methods: ResearchMethod[]
  caseCount: number
  cases: Array<{
    caseId: string
    formatId: string
    formatName: string
    group: FormatGroup
    width: number
    height: number
    method: ResearchMethod
    selectedLayout: string
    score: number
    criticalCount: number
    warningCount: number
    hiddenElements: string[]
    issues: ValidationIssue[]
    elements: LayoutElement[]
    reason: string
  }>
}

function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }
}

function writeTextFile(fileName: string, content: string): void {
  writeFileSync(path.join(OUTPUT_DIR, fileName), content, 'utf8')
}

function escapeHtml(value: string | number | boolean | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function csvEscape(value: string | number | boolean | undefined): string {
  const raw = String(value ?? '')

  if (!/[",\n\r]/.test(raw)) {
    return raw
  }

  return `"${raw.replace(/"/g, '""')}"`
}

function issueCount(issues: ValidationIssue[], type: ValidationIssueType): number {
  return issues.filter((issue) => issue.type === type).length
}

function issueSummary(issues: ValidationIssue[]): string {
  const types: ValidationIssueType[] = [
    'missing_required',
    'out_of_bounds',
    'overlap',
    'text_too_small',
    'unsafe_zone',
    'excessive_crop',
    'empty_space',
    'hidden_optional',
  ]

  const parts = types
    .map((type) => {
      const count = issueCount(issues, type)

      return count > 0 ? `${type}:${count}` : ''
    })
    .filter(Boolean)

  return parts.length > 0 ? parts.join('|') : 'none'
}

function selectBalancedFormats(formats: FormatSpecV2[], targetCount: number): FormatSpecV2[] {
  const quotas: Array<[FormatGroup, number]> = [
    ['horizontal', 4],
    ['vertical', 4],
    ['small', 4],
    ['wide', 4],
    ['square', 2],
    ['logo', 1],
    ['narrow', 1],
  ]

  const selected: FormatSpecV2[] = []
  const used = new Set<string>()

  for (const [group, quota] of quotas) {
    const groupFormats = formats.filter((format) => format.group === group)

    for (const format of groupFormats) {
      if (selected.length >= targetCount) {
        return selected
      }

      if (used.has(format.id)) {
        continue
      }

      selected.push(format)
      used.add(format.id)

      if (selected.filter((item) => item.group === group).length >= quota) {
        break
      }
    }
  }

  for (const format of formats) {
    if (selected.length >= targetCount) {
      break
    }

    if (used.has(format.id)) {
      continue
    }

    selected.push(format)
    used.add(format.id)
  }

  return selected
}

function buildDecisionForMethod(source: SourceMaterialV2, format: FormatSpecV2, method: ResearchMethod): LayoutDecision {
  if (method === 'scaling') {
    return selectBestLayoutCandidate([buildScalingCandidate(source, format)], format)
  }

  if (method === 'fixedLayout') {
    return selectBestLayoutCandidate([buildFixedLayoutCandidate(source, format)], format)
  }

  const candidates = generateLayoutCandidates(source, format)

  return selectBestLayoutCandidate(candidates, format)
}

function buildReviewCases(source: SourceMaterialV2, formats: FormatSpecV2[]): ManualReviewCase[] {
  const cases: ManualReviewCase[] = []

  for (const format of formats) {
    for (const method of METHODS) {
      const decision = buildDecisionForMethod(source, format, method)

      cases.push({
        caseId: `${format.id}__${method}`,
        format,
        method,
        decision,
        selected: decision.selected,
      })
    }
  }

  return cases
}

function roleLabel(element: LayoutElement): string {
  if (element.role === 'headline' && element.text) {
    return `headline: ${element.text}`
  }

  if (element.role === 'subtitle' && element.text) {
    return `subtitle: ${element.text}`
  }

  if (element.role === 'cta' && element.text) {
    return `cta: ${element.text}`
  }

  return `${element.role}`
}

function roleColor(role: LayoutElement['role']): string {
  if (role === 'background') {
    return '#f7f7f7'
  }

  if (role === 'image') {
    return '#cfe8ff'
  }

  if (role === 'headline') {
    return '#ffe0a3'
  }

  if (role === 'subtitle') {
    return '#e4d7ff'
  }

  if (role === 'cta') {
    return '#b8f0c2'
  }

  if (role === 'logo') {
    return '#ffd1dc'
  }

  if (role === 'badge') {
    return '#fff3b0'
  }

  return '#dddddd'
}

function renderCandidateSvg(candidate: LayoutCandidate, format: FormatSpecV2): string {
  const visibleElements = candidate.elements.filter((element) => element.visible && element.rect.width > 0 && element.rect.height > 0)
  const nonBackgroundElements = visibleElements.filter((element) => element.role !== 'background')
  const background = visibleElements.find((element) => element.role === 'background')

  const backgroundRect = background
    ? `<rect x="${background.rect.x}" y="${background.rect.y}" width="${background.rect.width}" height="${background.rect.height}" fill="${roleColor('background')}" stroke="#cccccc" />`
    : `<rect x="0" y="0" width="${format.width}" height="${format.height}" fill="#f7f7f7" stroke="#cccccc" />`

  const elementsSvg = nonBackgroundElements
    .map((element) => {
      const label = roleLabel(element)
      const fontSize = Math.max(8, Math.min(18, format.width * 0.025))

      return [
        `<rect x="${element.rect.x}" y="${element.rect.y}" width="${element.rect.width}" height="${element.rect.height}" fill="${roleColor(element.role)}" stroke="#333333" stroke-width="2" />`,
        `<text x="${element.rect.x + 4}" y="${element.rect.y + Math.min(element.rect.height - 4, fontSize + 4)}" font-size="${fontSize}" font-family="Arial, sans-serif" fill="#111111">${escapeHtml(label)}</text>`,
      ].join('\n')
    })
    .join('\n')

  return `
<svg class="preview-svg" viewBox="0 0 ${format.width} ${format.height}" role="img" aria-label="${escapeHtml(candidate.name)} preview">
  ${backgroundRect}
  ${elementsSvg}
</svg>`
}

function renderCaseCard(testCase: ManualReviewCase): string {
  const selected = testCase.selected
  const candidate = selected.candidate
  const hiddenElements = selected.hiddenElements.join(', ') || 'none'
  const issues = issueSummary(selected.issues)

  return `
<section class="case-card method-${escapeHtml(testCase.method)}">
  <div class="case-header">
    <h3>${escapeHtml(testCase.method)} → ${escapeHtml(candidate.name)}</h3>
    <div class="case-meta">
      score: <b>${selected.score}</b> |
      critical: <b>${selected.criticalCount}</b> |
      warnings: <b>${selected.warningCount}</b>
    </div>
  </div>
  ${renderCandidateSvg(candidate, testCase.format)}
  <div class="case-info">
    <p><b>Issues:</b> ${escapeHtml(issues)}</p>
    <p><b>Hidden:</b> ${escapeHtml(hiddenElements)}</p>
    <p><b>Manual score:</b> 0 = critical defect, 1 = needs correction, 2 = technically acceptable.</p>
  </div>
</section>`
}

function renderHtml(cases: ManualReviewCase[], formats: FormatSpecV2[], projectId: string): string {
  const casesByFormat = formats.map((format) => ({
    format,
    cases: cases.filter((testCase) => testCase.format.id === format.id),
  }))

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>layout-engine-v2 manual review</title>
  <style>
    body {
      margin: 24px;
      font-family: Arial, sans-serif;
      background: #ffffff;
      color: #111111;
    }
    h1, h2, h3 {
      margin: 0 0 8px;
    }
    .intro {
      max-width: 980px;
      margin-bottom: 24px;
      line-height: 1.45;
    }
    .format-section {
      border-top: 3px solid #222222;
      padding-top: 18px;
      margin-top: 28px;
    }
    .format-meta {
      margin-bottom: 12px;
      color: #333333;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(3, minmax(260px, 1fr));
      gap: 16px;
      align-items: start;
    }
    .case-card {
      border: 1px solid #cccccc;
      border-radius: 10px;
      padding: 12px;
      background: #fafafa;
    }
    .case-header {
      min-height: 56px;
    }
    .case-meta {
      font-size: 13px;
      color: #333333;
    }
    .preview-svg {
      width: 100%;
      height: 260px;
      border: 1px solid #dddddd;
      background: #ffffff;
      object-fit: contain;
    }
    .case-info {
      font-size: 13px;
      line-height: 1.35;
    }
    .rubric {
      border-collapse: collapse;
      margin-top: 12px;
      margin-bottom: 24px;
    }
    .rubric th, .rubric td {
      border: 1px solid #cccccc;
      padding: 6px 10px;
      text-align: left;
    }
    code {
      background: #eeeeee;
      padding: 1px 4px;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="intro">
    <h1>layout-engine-v2 manual review</h1>
    <p><b>Project:</b> ${escapeHtml(projectId)}</p>
    <p><b>Formats:</b> ${formats.length}; <b>Methods:</b> ${METHODS.join(', ')}; <b>Cases:</b> ${cases.length}</p>
    <p>Цель: вручную проверить контрольную выборку результатов. Проверяющий оценивает не художественное качество, а техническую пригодность: читаемость текста, сохранение обязательных элементов, отсутствие явных наложений и пригодность результата для первичной адаптации.</p>

    <table class="rubric">
      <thead>
        <tr><th>Оценка</th><th>Смысл</th></tr>
      </thead>
      <tbody>
        <tr><td>0</td><td>Критический дефект, результат технически непригоден</td></tr>
        <tr><td>1</td><td>Есть заметные недочёты, требуется ручная доработка</td></tr>
        <tr><td>2</td><td>Технически пригоден для первичной адаптации</td></tr>
      </tbody>
    </table>

    <p>Заполнять нужно файл <code>layout-v2-manual-review.csv</code>: поля <code>manualScore</code>, <code>criticalDefect</code>, <code>readabilityOk</code>, <code>requiredPreserved</code>, <code>comment</code>.</p>
  </div>

  ${casesByFormat
    .map(
      ({ format, cases: formatCases }) => `
  <section class="format-section">
    <h2>${escapeHtml(format.id)} — ${escapeHtml(format.name)}</h2>
    <div class="format-meta">${format.width}×${format.height}; group: ${escapeHtml(format.group)}</div>
    <div class="cards">
      ${formatCases.map(renderCaseCard).join('\n')}
    </div>
  </section>`,
    )
    .join('\n')}
</body>
</html>`
}

function manualReviewCsv(cases: ManualReviewCase[]): string {
  const header = [
    'caseId',
    'formatId',
    'formatName',
    'group',
    'width',
    'height',
    'method',
    'selectedLayout',
    'score',
    'criticalCount',
    'warningCount',
    'textTooSmallCount',
    'hiddenOptionalCount',
    'hiddenElements',
    'issueSummary',
    'manualScore',
    'criticalDefect',
    'readabilityOk',
    'requiredPreserved',
    'comment',
  ]

  const rows = cases.map((testCase) => {
    const selected = testCase.selected

    return [
      testCase.caseId,
      testCase.format.id,
      testCase.format.name,
      testCase.format.group,
      testCase.format.width,
      testCase.format.height,
      testCase.method,
      selected.candidate.name,
      selected.score,
      selected.criticalCount,
      selected.warningCount,
      issueCount(selected.issues, 'text_too_small'),
      issueCount(selected.issues, 'hidden_optional'),
      selected.hiddenElements.join('|'),
      issueSummary(selected.issues),
      '',
      '',
      '',
      '',
      '',
    ].map(csvEscape).join(',')
  })

  return [header.join(','), ...rows].join('\n')
}

function manualReviewJson(projectId: string, cases: ManualReviewCase[], formats: FormatSpecV2[]): ManualReviewJson {
  return {
    projectId,
    formatCount: formats.length,
    methods: METHODS,
    caseCount: cases.length,
    cases: cases.map((testCase) => ({
      caseId: testCase.caseId,
      formatId: testCase.format.id,
      formatName: testCase.format.name,
      group: testCase.format.group,
      width: testCase.format.width,
      height: testCase.format.height,
      method: testCase.method,
      selectedLayout: testCase.selected.candidate.name,
      score: testCase.selected.score,
      criticalCount: testCase.selected.criticalCount,
      warningCount: testCase.selected.warningCount,
      hiddenElements: testCase.selected.hiddenElements,
      issues: testCase.selected.issues,
      elements: testCase.selected.candidate.elements,
      reason: testCase.decision.reason,
    })),
  }
}

function main(): void {
  ensureOutputDir()

  const source = getDefaultProjectSourceMaterial()
  const catalogFormats = getCatalogFormatsV2()
  const reviewFormats = selectBalancedFormats(catalogFormats, REVIEW_FORMAT_COUNT)
  const cases = buildReviewCases(source, reviewFormats)

  writeTextFile('layout-v2-manual-review.html', renderHtml(cases, reviewFormats, source.id))
  writeTextFile('layout-v2-manual-review.csv', manualReviewCsv(cases))
  writeTextFile('layout-v2-manual-review.json', JSON.stringify(manualReviewJson(source.id, cases, reviewFormats), null, 2))

  console.log('layout-engine-v2 manual review files created')
  console.log(`projectId: ${source.id}`)
  console.log(`formats: ${reviewFormats.length}`)
  console.log(`methods: ${METHODS.join(', ')}`)
  console.log(`cases: ${cases.length}`)
  console.log(`output: ${OUTPUT_DIR}`)
  console.log('')
  console.log('Created files:')
  console.log('- layout-v2-manual-review.html')
  console.log('- layout-v2-manual-review.csv')
  console.log('- layout-v2-manual-review.json')
}

main()