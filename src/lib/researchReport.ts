import { runCompliance, type ValidationFinding } from './compliance'
import { checkOverflow, type LayoutIssue } from './fixLayout'
import { getFormatLayoutRule } from './groupLayout'
import type { BlockKind, FormatRuleSet, Project, Scene, TextBlock } from './types'

export type ResearchClassification = 'ready' | 'needsFix' | 'critical'
export type ResearchAuditMethod = 'simpleScale' | 'fixedTemplate' | 'adaptiveLayout'

export type ResearchValidationRecord = {
  scenarioId: string
  method: ResearchAuditMethod
  formatId: string
  formatName: string
  width: number
  height: number
  aspectRatio: number
  layoutMode: string
  exportOk: boolean
  requiredElementsPresent: boolean
  outOfBoundsCount: number
  overlapCount: number
  textOverflow: boolean
  safeAreaViolationCount: number
  criticalTechnicalViolations: string[]
  layoutWarnings: string[]
  methodologyWarnings: string[]
  manualReviewNotes: string[]
  classification: ResearchClassification
}

export type ResearchReport = {
  generatedAt: string
  totalFormats: number
  totalResults: number
  summary: ResearchReportSummary
  records: ResearchValidationRecord[]
}

export type ResearchReportSummary = {
  ready: ResearchClassSummary
  needsFix: ResearchClassSummary
  critical: ResearchClassSummary
  byMethod: Record<ResearchAuditMethod, ResearchMethodSummary>
  topNeedsFixReasons: Array<{ reason: string; count: number }>
  topCriticalReasons: Array<{ reason: string; count: number }>
  methodologyWarningCounts: Array<{ reason: string; count: number }>
}

export type ResearchClassSummary = {
  count: number
  percent: number
}

export type ResearchMethodSummary = {
  total: number
  ready: ResearchClassSummary
  needsFix: ResearchClassSummary
  critical: ResearchClassSummary
}

type BuildRecordInput = {
  scenarioId?: string
  method?: ResearchAuditMethod
  project: Project
  format: FormatRuleSet
  scene: Scene | null
  exportOk: boolean
  exportError?: string
}

type Rect = {
  kind: BlockKind
  x: number
  y: number
  w: number
  h: number
}

const TEXT_BLOCKS: BlockKind[] = ['title', 'subtitle', 'cta', 'badge']
const KEY_BLOCKS = new Set<BlockKind>(['title', 'cta', 'logo', 'image'])

export const RESEARCH_REPORT_CSV_HEADERS: Array<keyof ResearchValidationRecord> = [
  'scenarioId',
  'method',
  'formatId',
  'formatName',
  'width',
  'height',
  'aspectRatio',
  'layoutMode',
  'exportOk',
  'requiredElementsPresent',
  'outOfBoundsCount',
  'overlapCount',
  'textOverflow',
  'safeAreaViolationCount',
  'criticalTechnicalViolations',
  'layoutWarnings',
  'methodologyWarnings',
  'manualReviewNotes',
  'classification',
]

const METHODOLOGY_WARNING_CODES = new Set([
  'unknownRuleSource',
  'needsManualReview',
  'heuristicRuleApplied',
  'derivedRuleApplied',
  'percentageRegionsAreInternalModel',
  'layoutNotOfficiallySpecified',
])

export function buildResearchValidationRecord(input: BuildRecordInput): ResearchValidationRecord {
  const { project, format, scene, exportOk, exportError } = input
  const layoutMode = scene?.layoutPolicy?.formatKind ?? getFormatLayoutRule(format).defaultLayoutMode.value
  const missingRequired = scene ? missingRequiredElements(scene, format, project) : [...format.requiredElements]
  const requiredElementsPresent = missingRequired.length === 0
  const overflowIssues = scene ? checkOverflow(scene, format) : []
  const safeAreaIssues = overflowIssues.filter((issue) => isSafeAreaIssue(issue))
  const textOverflowIssues = scene ? collectTextOverflowIssues(scene, format, overflowIssues) : []
  const outOfBoundsIssues = scene ? collectOutOfBoundsIssues(scene, format) : []
  const overlapIssues = scene ? collectOverlapIssues(scene, format) : []
  const compliance = scene ? runCompliance(scene, format, project.brandKit) : null
  const layoutWarnings = dedupeStrings([
    ...overflowIssues.filter((issue) => issue.level === 'info' || !isCriticalOverflowIssue(scene, format, issue)).map(formatLayoutIssue),
    ...(compliance?.layoutWarnings ?? []).map(formatFinding),
    ...((scene?.layoutPolicy?.debugWarnings ?? []).filter((warning) => warning === 'textStackRequiresManualReview').map((warning) => `${warning}: Text stack still requires manual review after automatic spacing guard.`)),
  ])
  const methodologyWarnings = dedupeStrings([
    ...(compliance?.heuristicWarnings ?? []).filter(isMethodologyFinding).map(formatFinding),
  ])
  const manualReviewNotes = dedupeStrings([
    ...(scene?.layoutPolicy?.needsManualReview ? ['layout policy requires manual review'] : []),
    ...(scene?.layoutPolicy?.requiresManualCorrection ? ['layout policy requires manual correction'] : []),
    ...((scene?.layoutPolicy?.debugWarnings ?? []).filter((warning) => warning !== 'textStackRequiresManualReview').map(formatDebugWarning)),
  ])
  const criticalTechnicalViolations = dedupeStrings([
    ...(!exportOk ? [`file not created${exportError ? `: ${exportError}` : ''}`] : []),
    ...missingRequired.map((kind) => `required element missing: ${kind}`),
    ...outOfBoundsIssues.filter((issue) => issue.critical).map((issue) => issue.message),
    ...overlapIssues.filter((issue) => issue.critical).map((issue) => issue.message),
    ...textOverflowIssues.filter((issue) => issue.critical).map((issue) => issue.message),
    ...(scene?.layoutPolicy?.requiresManualCorrection ? ['basic layout structure is marked for manual correction'] : []),
    ...(compliance?.officialErrors ?? []).map(formatFinding),
  ])

  return {
    formatId: String(format.key),
    scenarioId: input.scenarioId ?? project.id,
    method: input.method ?? 'adaptiveLayout',
    formatName: format.label,
    width: format.width,
    height: format.height,
    aspectRatio: round(format.aspectRatio, 4),
    layoutMode,
    exportOk,
    requiredElementsPresent,
    outOfBoundsCount: outOfBoundsIssues.length,
    overlapCount: overlapIssues.length,
    textOverflow: textOverflowIssues.length > 0,
    safeAreaViolationCount: safeAreaIssues.length,
    criticalTechnicalViolations,
    layoutWarnings,
    methodologyWarnings,
    manualReviewNotes,
    classification: classifyRecord({
      exportOk,
      requiredElementsPresent,
      criticalTechnicalViolations,
      layoutWarnings,
      methodologyWarnings,
      manualReviewNotes,
      safeAreaViolationCount: safeAreaIssues.length,
      outOfBoundsCount: outOfBoundsIssues.length,
      overlapCount: overlapIssues.length,
      textOverflow: textOverflowIssues.length > 0,
    }),
  }
}

export function classifyRecord(input: Pick<
  ResearchValidationRecord,
  | 'exportOk'
  | 'requiredElementsPresent'
  | 'criticalTechnicalViolations'
  | 'layoutWarnings'
  | 'methodologyWarnings'
  | 'manualReviewNotes'
  | 'safeAreaViolationCount'
  | 'outOfBoundsCount'
  | 'overlapCount'
  | 'textOverflow'
>): ResearchClassification {
  if (!input.exportOk) return 'critical'
  if (!input.requiredElementsPresent) return 'critical'
  if (input.criticalTechnicalViolations.length > 0) return 'critical'
  if (
    input.layoutWarnings.length > 0 ||
    input.safeAreaViolationCount > 0 ||
    input.outOfBoundsCount > 0 ||
    input.overlapCount > 0 ||
    input.textOverflow
  ) {
    return 'needsFix'
  }
  return 'ready'
}

export function buildResearchReport(records: ResearchValidationRecord[], generatedAt = new Date()): ResearchReport {
  return {
    generatedAt: generatedAt.toISOString(),
    totalFormats: new Set(records.map((record) => record.formatId)).size,
    totalResults: records.length,
    summary: summarizeResearchRecords(records),
    records,
  }
}

export function summarizeResearchRecords(records: ResearchValidationRecord[]): ResearchReportSummary {
  const total = records.length
  return {
    ready: classSummary(records, total, 'ready'),
    needsFix: classSummary(records, total, 'needsFix'),
    critical: classSummary(records, total, 'critical'),
    byMethod: {
      simpleScale: methodSummary(records, 'simpleScale'),
      fixedTemplate: methodSummary(records, 'fixedTemplate'),
      adaptiveLayout: methodSummary(records, 'adaptiveLayout'),
    },
    topNeedsFixReasons: topReasons(records.filter((record) => record.classification === 'needsFix'), false),
    topCriticalReasons: topReasons(records.filter((record) => record.classification === 'critical'), true),
    methodologyWarningCounts: countReasons(records.flatMap((record) => record.methodologyWarnings)),
  }
}

export function researchRecordsToCsv(records: ResearchValidationRecord[]): string {
  const rows = [
    RESEARCH_REPORT_CSV_HEADERS.join(','),
    ...records.map((record) => RESEARCH_REPORT_CSV_HEADERS.map((header) => csvCell(csvValue(record[header]))).join(',')),
  ]
  return `${rows.join('\n')}\n`
}

export function researchReportToMarkdown(report: ResearchReport): string {
  const { summary } = report
  return `# Research Validation Summary

| Metric | Value |
| --- | ---: |
| Total formats | ${report.totalFormats} |
| Total results | ${report.totalResults} |
| Ready | ${summary.ready.count} (${summary.ready.percent.toFixed(1)}%) |
| NeedsFix | ${summary.needsFix.count} (${summary.needsFix.percent.toFixed(1)}%) |
| Critical | ${summary.critical.count} (${summary.critical.percent.toFixed(1)}%) |

## Results By Method

| Method | Total | Ready | NeedsFix | Critical |
| --- | ---: | ---: | ---: | ---: |
${(['simpleScale', 'fixedTemplate', 'adaptiveLayout'] as ResearchAuditMethod[]).map((method) => {
  const item = summary.byMethod[method]
  return `| ${method} | ${item.total} | ${item.ready.count} (${item.ready.percent.toFixed(1)}%) | ${item.needsFix.count} (${item.needsFix.percent.toFixed(1)}%) | ${item.critical.count} (${item.critical.percent.toFixed(1)}%) |`
}).join('\n')}

## Top 5 NeedsFix Reasons

${formatReasonList(summary.topNeedsFixReasons, 'No needsFix reasons recorded')}

## Top 5 Critical Reasons

${formatReasonList(summary.topCriticalReasons, 'No critical reasons recorded')}

## Methodology Warning Counts

${formatReasonList(summary.methodologyWarningCounts, 'No methodology warnings recorded')}

## Diploma Conclusion

The audit produced reproducible technical validation records for the generated advertising materials. Ready results satisfy export, required element, boundary, text readability, and overlap checks. NeedsFix results are technically generated but require layout correction. Critical results contain blocking technical violations and should not be treated as production-ready without correction. Methodology warnings describe rule provenance and review confidence; by themselves they do not change the technical classification.
`
}

function missingRequiredElements(scene: Scene, format: FormatRuleSet, project: Project): BlockKind[] {
  return format.requiredElements.filter((kind) => {
    if (project.enabled[kind] === false) return true
    const block = scene[kind]
    if (!block) return true
    if (kind === 'title' || kind === 'subtitle' || kind === 'cta' || kind === 'badge') {
      return !(block as TextBlock).text?.trim()
    }
    if (kind === 'image') return !scene.image?.src
    return false
  })
}

function collectOutOfBoundsIssues(scene: Scene, format: FormatRuleSet): Array<{ message: string; critical: boolean }> {
  const required = new Set<BlockKind>(format.requiredElements)
  return collectRects(scene, format)
    .map((rect) => {
      const ratio = containedAreaRatio(rect, { kind: rect.kind, x: 0, y: 0, w: 100, h: 100 })
      if (ratio >= 0.995) return null
      const lost = 1 - ratio
      const critical = KEY_BLOCKS.has(rect.kind) && (required.has(rect.kind) || rect.kind === 'title' || rect.kind === 'cta') && lost >= 0.25
      return {
        message: `${rect.kind}: substantial out-of-bounds (${(lost * 100).toFixed(1)}%)`,
        critical,
      }
    })
    .filter((item): item is { message: string; critical: boolean } => Boolean(item))
}

function collectOverlapIssues(scene: Scene, format: FormatRuleSet): Array<{ message: string; critical: boolean }> {
  const rects = collectRects(scene, format).filter((rect) => TEXT_BLOCKS.includes(rect.kind) || rect.kind === 'logo')
  const out: Array<{ message: string; critical: boolean }> = []
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const first = rects[i]
      const second = rects[j]
      if (!first || !second) continue
      const ratio = overlapRatio(first, second)
      if (ratio <= 0) continue
      out.push({
        message: `${first.kind} critically overlaps ${second.kind} (${(ratio * 100).toFixed(1)}% of smaller block)`,
        critical: ratio >= 0.18 && (KEY_BLOCKS.has(first.kind) || KEY_BLOCKS.has(second.kind)),
      })
    }
  }
  return out
}

function collectTextOverflowIssues(scene: Scene, format: FormatRuleSet, overflowIssues: LayoutIssue[]): Array<{ message: string; critical: boolean }> {
  const fromOverflow = overflowIssues
    .filter((issue) => /truncated|too long|text does not fit|exceeds/i.test(issue.message))
    .map((issue) => ({
      message: formatLayoutIssue(issue),
      critical: issue.block === 'title' && /truncated|text does not fit/i.test(issue.message),
    }))

  const geometry = TEXT_BLOCKS.flatMap((kind) => {
    const block = scene[kind] as TextBlock | undefined
    if (!block?.text.trim() || !block.h) return []
    const estimated = estimateTextHeight(block, format)
    if (estimated <= block.h) return []
    return [{
      message: `${kind}: text does not fit block`,
      critical: (kind === 'title' || kind === 'cta') && estimated > block.h * 1.5,
    }]
  })

  return [...fromOverflow, ...geometry]
}

function isCriticalOverflowIssue(scene: Scene | null, format: FormatRuleSet, issue: LayoutIssue): boolean {
  if (!scene || !issue.block) return false
  if (!KEY_BLOCKS.has(issue.block)) return false
  if (/outside visible area|intersects overlay zone/i.test(issue.message)) return true
  if (!/safe area/i.test(issue.message)) return false
  const rect = getRect(scene, format, issue.block)
  return rect ? containedAreaRatio(rect, safeRect(format, issue.block)) <= 0.05 : false
}

function isSafeAreaIssue(issue: LayoutIssue): boolean {
  return /safe area|safe-zone|visible area|overlay zone/i.test(issue.message)
}

function collectRects(scene: Scene, format: FormatRuleSet): Rect[] {
  return (['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as BlockKind[])
    .map((kind) => getRect(scene, format, kind))
    .filter((rect): rect is Rect => Boolean(rect))
}

function getRect(scene: Scene, format: FormatRuleSet, kind: BlockKind): Rect | null {
  const block = scene[kind]
  if (!block) return null
  return {
    kind,
    x: block.x,
    y: block.y,
    w: block.w,
    h: block.h ?? (isTextKind(kind) ? estimateTextHeight(block as TextBlock, format) : 0),
  }
}

function safeRect(format: FormatRuleSet, kind: BlockKind): Rect {
  return {
    kind,
    x: format.safeZone.left,
    y: format.safeZone.top,
    w: 100 - format.safeZone.left - format.safeZone.right,
    h: 100 - format.safeZone.top - format.safeZone.bottom,
  }
}

function containedAreaRatio(rect: Rect, container: Rect): number {
  const area = rect.w * rect.h
  if (area <= 0) return 0
  const xOverlap = Math.max(0, Math.min(rect.x + rect.w, container.x + container.w) - Math.max(rect.x, container.x))
  const yOverlap = Math.max(0, Math.min(rect.y + rect.h, container.y + container.h) - Math.max(rect.y, container.y))
  return (xOverlap * yOverlap) / area
}

function overlapRatio(first: Rect, second: Rect): number {
  const xOverlap = Math.max(0, Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x))
  const yOverlap = Math.max(0, Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y))
  const smallerArea = Math.min(first.w * first.h, second.w * second.h)
  return smallerArea <= 0 ? 0 : (xOverlap * yOverlap) / smallerArea
}

function estimateTextHeight(block: TextBlock, format: FormatRuleSet): number {
  const lineHeight = block.lineHeight ?? 1.2
  const lines = Math.max(1, Math.min(block.maxLines, Math.ceil(block.text.length / Math.max(1, block.charsPerLine))))
  return block.fontSize * lineHeight * lines * format.aspectRatio
}

function isTextKind(kind: BlockKind): boolean {
  return TEXT_BLOCKS.includes(kind)
}

function formatLayoutIssue(issue: LayoutIssue): string {
  return `${issue.block ?? 'layout'}: ${issue.message}`
}

function formatFinding(finding: ValidationFinding): string {
  return `${finding.code}: ${finding.message}${finding.detail ? ` (${finding.detail})` : ''}`
}

function formatDebugWarning(warning: string): string {
  if (warning === 'textStackCollisionResolved') return 'textStackCollisionResolved: Automatic text stack spacing resolved a local collision.'
  if (warning === 'subtitleHiddenDueToSpace') return 'subtitleHiddenDueToSpace: Subtitle was hidden to preserve title and CTA readability.'
  if (warning === 'ctaCompactApplied') return 'ctaCompactApplied: CTA compact sizing was applied to preserve the text stack.'
  if (warning === 'titleFontReduced') return 'titleFontReduced: Title font size was reduced to fit the text stack.'
  return `${warning}: Layout debug note.`
}

function isMethodologyFinding(finding: ValidationFinding): boolean {
  return METHODOLOGY_WARNING_CODES.has(finding.code)
}

function classSummary(records: ResearchValidationRecord[], total: number, classification: ResearchClassification): ResearchClassSummary {
  const count = records.filter((record) => record.classification === classification).length
  return { count, percent: total > 0 ? round((count / total) * 100, 1) : 0 }
}

function methodSummary(records: ResearchValidationRecord[], method: ResearchAuditMethod): ResearchMethodSummary {
  const scoped = records.filter((record) => record.method === method)
  const total = scoped.length
  return {
    total,
    ready: classSummary(scoped, total, 'ready'),
    needsFix: classSummary(scoped, total, 'needsFix'),
    critical: classSummary(scoped, total, 'critical'),
  }
}

function topReasons(records: ResearchValidationRecord[], critical: boolean): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>()
  for (const record of records) {
    const reasons = critical
      ? record.criticalTechnicalViolations
      : [...record.layoutWarnings, ...(record.textOverflow ? ['text overflow'] : [])]
    for (const reason of reasons) {
      increment(counts, normalizeReason(reason))
    }
  }
  return sortedReasonCounts(counts).slice(0, 5)
}

function countReasons(reasons: string[]): Array<{ reason: string; count: number }> {
  const counts = new Map<string, number>()
  for (const reason of reasons) increment(counts, normalizeReason(reason))
  return sortedReasonCounts(counts)
}

function sortedReasonCounts(counts: Map<string, number>): Array<{ reason: string; count: number }> {
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
}

function normalizeReason(reason: string): string {
  const first = reason.split(':')[0]?.trim()
  return first && first.length <= 80 ? first : reason.slice(0, 80)
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function formatReasonList(reasons: Array<{ reason: string; count: number }>, empty: string): string {
  return reasons.length > 0 ? reasons.map((item) => `- ${item.reason}: ${item.count}`).join('\n') : `- ${empty}`
}

function csvValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(' | ')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value ?? '')
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}
