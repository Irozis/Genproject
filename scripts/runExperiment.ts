import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildScene } from '../src/lib/buildScene'
import { runCompliance } from '../src/lib/compliance'
import { checkOverflow, fixLayout } from '../src/lib/fixLayout'
import { groupOf } from '../src/lib/formatGroups'
import { getFormat } from '../src/lib/formats'
import { getActiveImageSrc } from '../src/lib/projectImages'
import { projectSchema } from '../src/lib/serialize'
import type { BlockKind, BlockOverride, FormatKey, FormatRuleSet, Project, Scene, TextBlock } from '../src/lib/types'
import { SceneRenderer } from '../src/renderers/SceneRenderer'

type ExperimentStatus = 'ready' | 'minor' | 'fail'
type IssueSeverity = 'critical' | 'warning' | 'info'
type OverlapBlockKind = Extract<BlockKind, 'title' | 'subtitle' | 'cta' | 'badge' | 'logo'>

type Issue = {
  message: string
  severity: IssueSeverity
  reason: string
}

type Rect = {
  kind: BlockKind
  x: number
  y: number
  w: number
  h: number
}

type LoadedProject = {
  fileName: string
  project: Project
}

type GeneratedAsset = {
  scene: Scene
  svg: string
  sceneHash: string
  outputHash: string
  generationMs: number
}

type ExperimentResult = {
  projectId: string
  projectName: string
  projectFile: string
  group: string
  formatKey: FormatKey
  status: ExperimentStatus
  generationMs: number
  issueCount: number
  issues: string[]
  issueDetails: Issue[]
  criticalIssues: string[]
  warningIssues: string[]
  infoIssues: string[]
  hasTextOverflow: boolean
  hasSafeZoneViolation: boolean
  hasOverlap: boolean
  hasContrastWarning: boolean
  deterministicMatch: boolean
  previewPath?: string
  previewFile?: string
  sceneHash?: string
  outputHash?: string
}

type ExperimentSummary = {
  totalProjects: number
  totalAssets: number
  ready: number
  minor: number
  fail: number
  averageGenerationMs: number
  medianGenerationMs: number
  p95GenerationMs: number
  deterministicMatchTrue: number
  deterministicMatchFalse: number
  topCriticalIssueReasons: Array<{ reason: string; count: number }>
  topWarningIssueReasons: Array<{ reason: string; count: number }>
  failAssets: Array<{ projectId: string; group: string; formatKey: FormatKey; criticalIssues: string[] }>
  assetSourceWarnings: string[]
}

const PROJECTS_DIR = path.resolve('experiment/projects')
const RESULTS_DIR = path.resolve('experiment/results')
const PREVIEWS_DIR = path.join(RESULTS_DIR, 'previews')
const RESULT_JSON_PATH = path.join(RESULTS_DIR, 'experiment-results.json')
const RESULT_CSV_PATH = path.join(RESULTS_DIR, 'experiment-results.csv')
const SUMMARY_MD_PATH = path.join(RESULTS_DIR, 'summary.md')
const REPORT_HTML_PATH = path.join(RESULTS_DIR, 'report.html')
const MANUAL_REVIEW_CSV_PATH = path.join(RESULTS_DIR, 'manual-review-template.csv')

async function main(): Promise<void> {
  await mkdir(PROJECTS_DIR, { recursive: true })
  await resetResults()

  const projects = await loadProjects(PROJECTS_DIR)
  const results: ExperimentResult[] = []

  for (const loaded of projects) {
    for (const formatKey of loaded.project.selectedFormats) {
      results.push(await runProjectFormat(loaded, formatKey))
    }
  }

  const summary = summarize(results, projects.length)
  await writeFile(RESULT_JSON_PATH, `${JSON.stringify(results, null, 2)}\n`, 'utf8')
  await writeFile(RESULT_CSV_PATH, toCsv(results), 'utf8')
  await writeFile(MANUAL_REVIEW_CSV_PATH, toManualReviewCsv(results), 'utf8')
  await writeFile(SUMMARY_MD_PATH, toMarkdown(summary), 'utf8')
  await writeFile(REPORT_HTML_PATH, toHtmlReport(results, summary), 'utf8')

  console.log(`Experiment projects: ${summary.totalProjects}`)
  console.log(`Experiment assets: ${summary.totalAssets}`)
  console.log(`Ready/minor/fail: ${summary.ready}/${summary.minor}/${summary.fail}`)
  console.log(`Report: ${REPORT_HTML_PATH}`)
}

async function resetResults(): Promise<void> {
  await mkdir(RESULTS_DIR, { recursive: true })
  await rm(PREVIEWS_DIR, { recursive: true, force: true })
  await mkdir(PREVIEWS_DIR, { recursive: true })
}

async function loadProjects(projectsDir: string): Promise<LoadedProject[]> {
  const entries = await readdir(projectsDir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  const projects: LoadedProject[] = []
  for (const fileName of files) {
    const raw = await readFile(path.join(projectsDir, fileName), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const result = projectSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error(`Project ${fileName} does not match projectSchema: ${result.error.issues[0]?.message ?? 'unknown issue'}`)
    }
    projects.push({ fileName, project: result.data as Project })
  }
  return projects
}

async function runProjectFormat(loaded: LoadedProject, formatKey: FormatKey): Promise<ExperimentResult> {
  const { project } = loaded
  const group = groupOf(formatKey)
  try {
    const first = generateAsset(project, formatKey)
    const second = generateAsset(project, formatKey)
    const rules = getFormat(formatKey, project.customFormats)
    const issues = collectIssues(first.scene, first.svg, rules, project)
    const status = resolveStatus(issues)
    const issueMessages = issues.map((issue) => issue.message)
    const criticalIssues = issues.filter((issue) => issue.severity === 'critical').map((issue) => issue.message)
    const warningIssues = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message)
    const infoIssues = issues.filter((issue) => issue.severity === 'info').map((issue) => issue.message)
    const previewFile = `${safeSegment(project.id)}_${safeSegment(formatKey)}.svg`
    const previewPath = `experiment/results/previews/${previewFile}`
    await writeFile(path.join(PREVIEWS_DIR, previewFile), first.svg, 'utf8')

    return {
      projectId: project.id,
      projectName: project.name,
      projectFile: loaded.fileName,
      group,
      formatKey,
      status,
      generationMs: roundMs(first.generationMs),
      issueCount: issueMessages.length,
      issues: issueMessages,
      issueDetails: issues,
      criticalIssues,
      warningIssues,
      infoIssues,
      hasTextOverflow: issueMessages.some((issue) => /truncated|too long|overflow|text does not fit/i.test(issue)),
      hasSafeZoneViolation: issueMessages.some((issue) => /safe zone|safe-zone|safe area/i.test(issue)),
      hasOverlap: issues.some((issue) => issue.reason === 'overlap'),
      hasContrastWarning: issues.some((issue) => issue.reason === 'WCAG AA contrast'),
      deterministicMatch: first.sceneHash === second.sceneHash && first.outputHash === second.outputHash,
      previewPath,
      previewFile,
      sceneHash: first.sceneHash,
      outputHash: first.outputHash,
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const issue: Issue = { message: `generation failed: ${message}`, severity: 'critical', reason: 'generation failed' }
    return {
      projectId: project.id,
      projectName: project.name,
      projectFile: loaded.fileName,
      group,
      formatKey,
      status: 'fail',
      generationMs: 0,
      issueCount: 1,
      issues: [issue.message],
      issueDetails: [issue],
      criticalIssues: [issue.message],
      warningIssues: [],
      infoIssues: [],
      hasTextOverflow: false,
      hasSafeZoneViolation: false,
      hasOverlap: false,
      hasContrastWarning: false,
      deterministicMatch: false,
    }
  }
}

function generateAsset(project: Project, formatKey: FormatKey): GeneratedAsset {
  const started = performance.now()
  const rules = getFormat(formatKey, project.customFormats)
  const inputScene = createInputScene(project, formatKey)
  const built = buildScene(inputScene, formatKey, project.brandKit, project.enabled, {
    override: project.formatOverrides?.[formatKey],
    assetHint: project.assetHint,
    blockOverrides: project.blockOverrides?.[formatKey],
    locale: project.activeLocale,
    customFormats: project.customFormats,
    density: project.formatDensities?.[formatKey] ?? project.layoutDensity,
  })
  const scene = fixLayout(built, rules)
  const svg = renderSceneSvg(scene, rules, project)
  const generationMs = performance.now() - started
  return {
    scene,
    svg,
    sceneHash: sha256(stableStringify(scene)),
    outputHash: sha256(svg),
    generationMs,
  }
}

function createInputScene(project: Project, formatKey: FormatKey): Scene {
  const next: Scene = cloneScene(project.master)
  if (next.image) {
    next.image.src = resolveProjectImageSrc(project, formatKey)
    const focal = project.imageFocals?.[formatKey]
    if (focal) {
      next.image.focalX = focal.x
      next.image.focalY = focal.y
    }
  }
  if (next.logo) next.logo.src = project.logoSrc ?? next.logo.src
  return next
}

function cloneScene(scene: Scene): Scene {
  return {
    ...scene,
    title: scene.title ? { ...scene.title } : undefined,
    subtitle: scene.subtitle ? { ...scene.subtitle } : undefined,
    cta: scene.cta ? { ...scene.cta } : undefined,
    badge: scene.badge ? { ...scene.badge } : undefined,
    logo: scene.logo ? { ...scene.logo } : undefined,
    image: scene.image ? { ...scene.image } : undefined,
  }
}

function collectIssues(scene: Scene, svg: string, rules: FormatRuleSet, project: Project): Issue[] {
  const issues: Issue[] = []
  issues.push(...collectAssetSourceIssues(project, rules.key))
  issues.push(...collectSvgIssues(svg, rules))

  const compliance = runCompliance(scene, rules, project.brandKit)
  for (const check of compliance.checks) {
    if (check.status === 'pass') continue
    if (check.rule === 'safe zone' || check.rule === 'overflow') continue
    issues.push({
      message: `${check.rule}: ${check.status}${check.detail ? ` (${check.detail})` : ''}`,
      severity: check.rule === 'WCAG AA contrast' ? 'warning' : check.status === 'fail' ? 'critical' : 'warning',
      reason: check.rule,
    })
  }

  for (const issue of checkOverflow(scene, rules)) {
    issues.push({
      message: `${issue.block ?? 'layout'}: ${issue.message}`,
      severity: classifyLayoutIssue(scene, rules, issue.block, issue.message),
      reason: issueReason(issue.message),
    })
  }

  issues.push(...collectLocalGeometryIssues(scene, rules))
  return dedupeIssues(issues)
}

function resolveProjectImageSrc(project: Project, formatKey?: FormatKey): string | null {
  return getActiveImageSrc(project, formatKey)
}

function collectAssetSourceIssues(project: Project, formatKey: FormatKey): Issue[] {
  const issues: Issue[] = []
  const imageSrc = resolveProjectImageSrc(project, formatKey)
  if (!imageSrc) {
    issues.push({
      message: 'imageSrc: missing reproducible project image source',
      severity: 'warning',
      reason: 'asset source',
    })
  } else if (imageSrc.startsWith('blob:')) {
    issues.push({
      message: 'imageSrc: blob URL is not reproducible and is forbidden for diploma experiment',
      severity: 'critical',
      reason: 'asset source',
    })
  }
  if (project.logoSrc?.startsWith('blob:') || project.master.logo?.src?.startsWith('blob:')) {
    issues.push({
      message: 'logoSrc: blob URL is not reproducible and is forbidden for diploma experiment',
      severity: 'critical',
      reason: 'asset source',
    })
  }
  if (imageSrc && !imageSrc.startsWith('data:') && !imageSrc.startsWith('http://') && !imageSrc.startsWith('https://')) {
    issues.push({
      message: `imageSrc: unsupported source scheme (${imageSrc.slice(0, 24)})`,
      severity: 'warning',
      reason: 'asset source',
    })
  }
  return issues
}

function collectSvgIssues(svg: string, rules: FormatRuleSet): Issue[] {
  const issues: Issue[] = []
  const svgTag = svg.match(/<svg\b[^>]*>/i)?.[0]
  if (!svgTag) return [{ message: 'svg: root <svg> is missing', severity: 'critical', reason: 'svg' }]

  const width = readSvgNumericAttribute(svgTag, 'width')
  const height = readSvgNumericAttribute(svgTag, 'height')
  const viewBox = readSvgAttribute(svgTag, 'viewBox')
  const expectedViewBox = `0 0 ${rules.width} ${rules.height}`

  if (width !== rules.width) issues.push({ message: `svg: width mismatch (${String(width)} !== ${rules.width})`, severity: 'critical', reason: 'svg' })
  if (height !== rules.height) issues.push({ message: `svg: height mismatch (${String(height)} !== ${rules.height})`, severity: 'critical', reason: 'svg' })
  if (viewBox !== expectedViewBox) issues.push({ message: `svg: viewBox mismatch (${String(viewBox)} !== ${expectedViewBox})`, severity: 'critical', reason: 'svg' })
  if (readSvgAttribute(svgTag, 'data-testid') !== 'format-preview-svg') {
    issues.push({ message: 'svg: data-testid="format-preview-svg" is missing', severity: 'warning', reason: 'svg' })
  }
  if (readSvgAttribute(svgTag, 'data-format-key') !== rules.key) {
    issues.push({ message: `svg: data-format-key mismatch (${String(readSvgAttribute(svgTag, 'data-format-key'))} !== ${rules.key})`, severity: 'warning', reason: 'svg' })
  }
  return issues
}

function classifyLayoutIssue(scene: Scene, rules: FormatRuleSet, blockKind: BlockKind | null, message: string): IssueSeverity {
  const text = message.toLowerCase()
  if (text.includes('contrast')) return 'warning'
  if (text.includes('weak hierarchy') || text.includes('sits on image without scrim')) return 'info'
  if (text.includes('too small') || text.includes('too close')) return 'warning'
  if (text.includes('truncated') || text.includes('too long')) return 'warning'
  if (!blockKind) return 'warning'

  const rect = getRect(scene, rules, blockKind)
  if (!rect) return 'warning'
  const required = new Set<BlockKind>(rules.requiredElements)
  const canvasRatio = getContainedAreaRatio(rect, { kind: rect.kind, x: 0, y: 0, w: 100, h: 100 })
  if (canvasRatio <= 0) return blockKind === 'title' || blockKind === 'cta' || required.has(blockKind) ? 'critical' : 'warning'

  if (text.includes('safe area')) {
    if (blockKind === 'image') return 'warning'
    const safeRatio = getContainedAreaRatio(rect, safeRectFor(rules, blockKind))
    return required.has(blockKind) && safeRatio < 0.05 ? 'critical' : 'warning'
  }
  return 'warning'
}

function issueReason(message: string): string {
  const text = message.toLowerCase()
  if (text.includes('contrast')) return 'WCAG AA contrast'
  if (text.includes('safe area') || text.includes('safe-zone')) return 'safe zone'
  if (text.includes('truncated') || text.includes('too long') || text.includes('text does not fit')) return 'overflow'
  if (text.includes('image')) return 'image'
  if (text.includes('cta')) return 'cta'
  return message
}

function collectLocalGeometryIssues(scene: Scene, rules: FormatRuleSet): Issue[] {
  const issues: Issue[] = []
  const required = new Set<BlockKind>(rules.requiredElements)

  for (const kind of ['title', 'cta', 'image'] as const) {
    const block = scene[kind]
    if (!block) {
      issues.push({
        message: `${kind}: block is missing${required.has(kind) ? ' (required)' : ''}`,
        severity: required.has(kind) || kind === 'title' ? 'critical' : 'warning',
        reason: kind,
      })
      continue
    }
    const h = getBlockHeight(kind, block, rules)
    if (!isFinitePositive(block.x) || !isFinitePositive(block.y, true) || !isFinitePositive(block.w) || !isFinitePositive(h)) {
      issues.push({ message: `${kind}: non-positive or invalid geometry`, severity: 'critical', reason: kind })
    }
  }

  for (const rect of collectRects(scene, rules)) {
    if (!isFiniteRect(rect)) {
      issues.push({ message: `${rect.kind}: NaN/null geometry`, severity: 'critical', reason: rect.kind })
      continue
    }

    const canvasRatio = getContainedAreaRatio(rect, { kind: rect.kind, x: 0, y: 0, w: 100, h: 100 })
    if (canvasRatio < 0.995) {
      const fullyOutside = canvasRatio <= 0
      const critical = fullyOutside && (rect.kind === 'title' || rect.kind === 'cta' || required.has(rect.kind))
      issues.push({
        message: `${rect.kind}: outside canvas (${((1 - canvasRatio) * 100).toFixed(1)}%)`,
        severity: critical ? 'critical' : 'warning',
        reason: rect.kind === 'image' ? 'image' : rect.kind,
      })
    }

    if (rect.kind !== 'subtitle' && rect.kind !== 'image') {
      const safeRatio = getContainedAreaRatio(rect, safeRectFor(rules, rect.kind))
      if (safeRatio < 0.995) {
        issues.push({
          message: `${rect.kind}: partially outside safe-zone (${((1 - safeRatio) * 100).toFixed(1)}%)`,
          severity: safeRatio <= 0.05 && (rect.kind === 'title' || rect.kind === 'cta') ? 'critical' : 'warning',
          reason: rect.kind,
        })
      }
    }
  }

  for (const kind of ['title', 'subtitle', 'cta', 'badge'] as const) {
    const block = scene[kind]
    if (!block?.text.trim() || !block.h || block.h <= 0) continue
    const estimated = estimateTextHeight(block, rules)
    if (estimated > block.h * 1.15) {
      issues.push({ message: `${kind}: text does not fit block`, severity: kind === 'title' || kind === 'cta' ? 'critical' : 'warning', reason: kind })
    } else if (estimated > block.h) {
      issues.push({ message: `${kind}: text slightly exceeds block`, severity: 'warning', reason: kind })
    }
  }

  const overlapRects = collectRects(scene, rules).filter((rect): rect is Rect & { kind: OverlapBlockKind } =>
    ['title', 'subtitle', 'cta', 'badge', 'logo'].includes(rect.kind),
  )
  for (let i = 0; i < overlapRects.length; i++) {
    for (let j = i + 1; j < overlapRects.length; j++) {
      const first = overlapRects[i]
      const second = overlapRects[j]
      if (!first || !second) continue
      const ratio = getOverlapRatio(first, second)
      if (ratio <= 0) continue
      issues.push({
        message: `${first.kind} overlaps ${second.kind} (${(ratio * 100).toFixed(1)}% of smaller block)`,
        severity: ratio > 0.1 ? 'critical' : 'warning',
        reason: 'overlap',
      })
    }
  }
  return issues
}

function resolveStatus(issues: Issue[]): ExperimentStatus {
  if (issues.some((issue) => issue.severity === 'critical')) return 'fail'
  if (issues.some((issue) => issue.severity === 'warning')) return 'minor'
  return 'ready'
}

function summarize(results: ExperimentResult[], totalProjects: number): ExperimentSummary {
  const generationTimes = results.map((result) => result.generationMs).sort((a, b) => a - b)
  const criticalIssueCounts = new Map<string, number>()
  const warningIssueCounts = new Map<string, number>()
  for (const result of results) {
    for (const issue of result.issueDetails) {
      if (issue.severity === 'critical') increment(criticalIssueCounts, issue.reason)
      if (issue.severity === 'warning') increment(warningIssueCounts, issue.reason)
    }
  }

  return {
    totalProjects,
    totalAssets: results.length,
    ready: results.filter((result) => result.status === 'ready').length,
    minor: results.filter((result) => result.status === 'minor').length,
    fail: results.filter((result) => result.status === 'fail').length,
    averageGenerationMs: roundMs(average(generationTimes)),
    medianGenerationMs: roundMs(percentile(generationTimes, 0.5)),
    p95GenerationMs: roundMs(percentile(generationTimes, 0.95)),
    deterministicMatchTrue: results.filter((result) => result.deterministicMatch).length,
    deterministicMatchFalse: results.filter((result) => !result.deterministicMatch).length,
    topCriticalIssueReasons: topCounts(criticalIssueCounts),
    topWarningIssueReasons: topCounts(warningIssueCounts),
    failAssets: results
      .filter((result) => result.status === 'fail')
      .map((result) => ({
        projectId: result.projectId,
        group: result.group,
        formatKey: result.formatKey,
        criticalIssues: result.criticalIssues,
      })),
    assetSourceWarnings: collectAssetSourceWarnings(results),
  }
}

function collectAssetSourceWarnings(results: ExperimentResult[]): string[] {
  const warnings = new Set<string>()
  for (const result of results) {
    for (const issue of result.issueDetails) {
      if (issue.reason === 'asset source') {
        warnings.add(`${result.projectId} / ${result.formatKey}: ${issue.message}`)
      }
    }
  }
  return [...warnings].sort((a, b) => a.localeCompare(b))
}

function toCsv(results: ExperimentResult[]): string {
  const headers: Array<keyof ExperimentResult> = [
    'projectId',
    'projectName',
    'projectFile',
    'group',
    'formatKey',
    'status',
    'generationMs',
    'issueCount',
    'issues',
    'issueDetails',
    'criticalIssues',
    'warningIssues',
    'infoIssues',
    'hasTextOverflow',
    'hasSafeZoneViolation',
    'hasOverlap',
    'hasContrastWarning',
    'deterministicMatch',
    'previewPath',
    'previewFile',
    'sceneHash',
    'outputHash',
  ]
  return `${headers.join(',')}\n${results.map((result) => headers.map((header) => csvCell(csvValue(result[header]))).join(',')).join('\n')}\n`
}

function toManualReviewCsv(results: ExperimentResult[]): string {
  const headers = [
    'projectId',
    'group',
    'formatKey',
    'autoStatus',
    'humanStatus',
    'validatorCorrect',
    'notes',
    'previewPath',
    'criticalIssues',
    'warningIssues',
  ]
  const rows = results.map((result) =>
    [
      result.projectId,
      result.group,
      result.formatKey,
      result.status,
      '',
      '',
      '',
      result.previewPath ?? '',
      result.criticalIssues.join(' | '),
      result.warningIssues.join(' | '),
    ]
      .map(csvCell)
      .join(','),
  )
  return `${headers.join(',')}\n${rows.join('\n')}\n`
}

function toMarkdown(summary: ExperimentSummary): string {
  return `# Experiment Summary

| Metric | Value |
| --- | ---: |
| Total projects | ${summary.totalProjects} |
| Total assets | ${summary.totalAssets} |
| Ready | ${summary.ready} |
| Minor | ${summary.minor} |
| Fail | ${summary.fail} |
| Average generation/render time, ms | ${summary.averageGenerationMs} |
| Median generation/render time, ms | ${summary.medianGenerationMs} |
| P95 generation/render time, ms | ${summary.p95GenerationMs} |
| deterministicMatch true | ${summary.deterministicMatchTrue} |
| deterministicMatch false | ${summary.deterministicMatchFalse} |

Visual report: experiment/results/report.html

## Top Critical Issues

${formatCounts(summary.topCriticalIssueReasons, 'No critical issues recorded')}

## Top Warning Issues

${formatCounts(summary.topWarningIssueReasons, 'No warning issues recorded')}

## Asset Source Sanity

${summary.assetSourceWarnings.length > 0 ? summary.assetSourceWarnings.map((warning) => `- ${warning}`).join('\n') : '- All project image sources are reproducible data/http URLs'}

## Fail Assets With Reasons

${summary.failAssets.length > 0 ? summary.failAssets.map((item) => `- ${item.projectId} / ${item.group} / ${item.formatKey}: ${item.criticalIssues.join(' | ')}`).join('\n') : '- No fail assets'}
`
}

function toHtmlReport(results: ExperimentResult[], summary: ExperimentSummary): string {
  const section = (status: ExperimentStatus, title: string): string => {
    const items = results.filter((result) => result.status === status)
    const cards = items.length > 0 ? items.map(renderReportCard).join('\n') : '<p class="empty">No assets in this section.</p>'
    return `<section class="section section-${status}"><h2>${escapeHtml(title)} <span>${items.length}</span></h2><div class="grid">${cards}</div></section>`
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Experiment Visual Report</title>
  <style>
    :root { --ready:#15803d; --ready-bg:#dcfce7; --minor:#a16207; --minor-bg:#fef3c7; --fail:#b91c1c; --fail-bg:#fee2e2; --ink:#111827; --muted:#6b7280; --line:#e5e7eb; --panel:#fff; --page:#f8fafc; }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--page); color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { padding: 28px 32px 18px; background: linear-gradient(135deg, #111827, #334155); color: white; }
    h1 { margin: 0 0 14px; font-size: 30px; }
    h2 { display: flex; align-items: center; gap: 10px; margin: 28px 0 14px; }
    h2 span { border-radius: 999px; background: #e5e7eb; color: #111827; padding: 2px 10px; font-size: 14px; }
    main { padding: 0 32px 32px; }
    .metrics { display: flex; flex-wrap: wrap; gap: 10px; }
    .metric { border: 1px solid rgba(255,255,255,.2); border-radius: 12px; padding: 10px 12px; background: rgba(255,255,255,.1); }
    .metric b { display: block; font-size: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 18px; }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; box-shadow: 0 16px 40px rgba(15,23,42,.08); }
    .card.fail { border-color: #fecaca; } .card.minor { border-color: #fde68a; } .card.ready { border-color: #bbf7d0; }
    .card-head { display: flex; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
    .identity strong { display: block; } .identity small { color: var(--muted); }
    .badge-status { align-self: start; border-radius: 999px; padding: 5px 10px; font-weight: 800; font-size: 12px; text-transform: uppercase; }
    .badge-status.fail { background: var(--fail-bg); color: var(--fail); } .badge-status.minor { background: var(--minor-bg); color: var(--minor); } .badge-status.ready { background: var(--ready-bg); color: var(--ready); }
    .preview { display: grid; place-items: center; min-height: 260px; padding: 16px; background: #f1f5f9; }
    .preview img { max-width: 100%; max-height: 340px; border-radius: 10px; background: white; box-shadow: 0 8px 20px rgba(15,23,42,.12); }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 13px; }
    .issues { padding: 14px 16px 18px; }
    details { border: 1px solid var(--line); border-radius: 12px; padding: 8px 10px; margin-top: 8px; background: #fff; }
    summary { cursor: pointer; font-weight: 800; } ul { margin: 8px 0 0; padding-left: 18px; } li { margin: 5px 0; }
    .severity-critical { color: var(--fail); } .severity-warning { color: var(--minor); } .severity-info { color: #2563eb; }
    .empty { color: var(--muted); } code { background: #f3f4f6; border-radius: 6px; padding: 1px 5px; }
  </style>
</head>
<body>
  <header>
    <h1>Experiment Visual Report</h1>
    <div class="metrics">
      <div class="metric"><span>Projects</span><b>${summary.totalProjects}</b></div>
      <div class="metric"><span>Assets</span><b>${summary.totalAssets}</b></div>
      <div class="metric"><span>Ready</span><b>${summary.ready}</b></div>
      <div class="metric"><span>Minor</span><b>${summary.minor}</b></div>
      <div class="metric"><span>Fail</span><b>${summary.fail}</b></div>
      <div class="metric"><span>Avg render, ms</span><b>${summary.averageGenerationMs}</b></div>
      <div class="metric"><span>Deterministic true/false</span><b>${summary.deterministicMatchTrue}/${summary.deterministicMatchFalse}</b></div>
    </div>
  </header>
  <main>${section('fail', 'Fail assets')}${section('minor', 'Minor assets')}${section('ready', 'Ready assets')}</main>
</body>
</html>`
}

function renderReportCard(result: ExperimentResult): string {
  const previewSrc = result.previewFile ? `./previews/${encodeHtmlAttribute(result.previewFile)}` : ''
  return `<article class="card ${result.status}">
  <div class="card-head"><div class="identity"><strong>${escapeHtml(result.projectId)}</strong><small>${escapeHtml(result.group)} / <code>${escapeHtml(result.formatKey)}</code></small></div><span class="badge-status ${result.status}">${result.status}</span></div>
  <div class="preview">${previewSrc ? `<img src="${previewSrc}" alt="${escapeHtml(result.projectId)} ${escapeHtml(result.formatKey)} preview" />` : '<span>No preview generated</span>'}</div>
  <div class="meta"><div>generationMs: <strong>${result.generationMs}</strong></div><div>deterministicMatch: <strong>${String(result.deterministicMatch)}</strong></div><div>projectFile: <strong>${escapeHtml(result.projectFile)}</strong></div><div>outputHash: <code>${escapeHtml((result.outputHash ?? '').slice(0, 10))}</code></div></div>
  <div class="issues">${renderIssueList('Critical issues', result.criticalIssues, 'critical')}${renderIssueList('Warning issues', result.warningIssues, 'warning')}${renderIssueList('Info issues', result.infoIssues, 'info')}<details open><summary>All issues with type, severity, message</summary>${renderIssueDetails(result.issueDetails)}</details></div>
</article>`
}

function renderIssueList(title: string, issues: string[], severity: IssueSeverity): string {
  const body = issues.length > 0 ? `<ul>${issues.map((issue) => `<li>${escapeHtml(issue)}</li>`).join('')}</ul>` : '<p class="empty">None</p>'
  return `<details><summary class="severity-${severity}">${escapeHtml(title)} (${issues.length})</summary>${body}</details>`
}

function renderIssueDetails(issues: Issue[]): string {
  if (issues.length === 0) return '<p class="empty">No issues</p>'
  return `<ul>${issues.map((issue) => `<li><strong>${escapeHtml(issue.reason)}</strong> <span class="severity-${issue.severity}">[${issue.severity}]</span>: ${escapeHtml(issue.message)}</li>`).join('')}</ul>`
}

function renderSceneSvg(scene: Scene, rules: FormatRuleSet, project: Project): string {
  return renderToStaticMarkup(
    createElement(SceneRenderer, {
      scene,
      rules,
      displayFont: project.brandKit.displayFont,
      textFont: project.brandKit.textFont,
      brandInitials: project.brandKit.brandName,
      brandColor: project.brandKit.palette.accent,
      imageAspectRatio: project.assetHint?.aspectRatio ?? null,
    }),
  )
}

function blockToOverride(block: NonNullable<Scene[BlockKind]>): BlockOverride {
  return block as BlockOverride
}

function collectRects(scene: Scene, rules: FormatRuleSet): Rect[] {
  const rects: Rect[] = []
  for (const kind of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const rect = getRect(scene, rules, kind)
    if (rect) rects.push(rect)
  }
  return rects
}

function getRect(scene: Scene, rules: FormatRuleSet, kind: BlockKind): Rect | null {
  const block = scene[kind]
  if (!block) return null
  return { kind, x: block.x, y: block.y, w: block.w, h: getBlockHeight(kind, block, rules) }
}

function getBlockHeight(kind: BlockKind, block: NonNullable<Scene[BlockKind]>, rules: FormatRuleSet): number {
  if (block.h !== undefined) return block.h
  if (kind === 'title' || kind === 'subtitle' || kind === 'cta' || kind === 'badge') return estimateTextHeight(block as TextBlock, rules)
  return 0
}

function safeRectFor(rules: FormatRuleSet, kind: BlockKind): Rect {
  return {
    kind,
    x: rules.safeZone.left,
    y: rules.safeZone.top,
    w: 100 - rules.safeZone.left - rules.safeZone.right,
    h: 100 - rules.safeZone.top - rules.safeZone.bottom,
  }
}

function getContainedAreaRatio(rect: Rect, container: Rect): number {
  const area = rect.w * rect.h
  if (area <= 0) return 0
  const xOverlap = Math.max(0, Math.min(rect.x + rect.w, container.x + container.w) - Math.max(rect.x, container.x))
  const yOverlap = Math.max(0, Math.min(rect.y + rect.h, container.y + container.h) - Math.max(rect.y, container.y))
  return (xOverlap * yOverlap) / area
}

function getOverlapRatio(first: Rect, second: Rect): number {
  const xOverlap = Math.max(0, Math.min(first.x + first.w, second.x + second.w) - Math.max(first.x, second.x))
  const yOverlap = Math.max(0, Math.min(first.y + first.h, second.y + second.h) - Math.max(first.y, second.y))
  const smallerArea = Math.min(first.w * first.h, second.w * second.h)
  return smallerArea <= 0 ? 0 : (xOverlap * yOverlap) / smallerArea
}

function estimateTextHeight(block: TextBlock, rules: FormatRuleSet): number {
  const lineHeight = block.lineHeight ?? 1.2
  const lines = Math.max(1, Math.min(block.maxLines, Math.ceil(block.text.length / Math.max(1, block.charsPerLine))))
  return block.fontSize * lineHeight * lines * rules.aspectRatio
}

function isFinitePositive(value: number, allowZero = false): boolean {
  return Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
}

function isFiniteRect(rect: Rect): boolean {
  return Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h)
}

function readSvgNumericAttribute(svgTag: string, name: string): number | null {
  const raw = readSvgAttribute(svgTag, name)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

function readSvgAttribute(svgTag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return svgTag.match(new RegExp(`${escaped}="([^"]*)"`, 'i'))?.[1] ?? null
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function percentile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) return 0
  const index = Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * ratio) - 1)
  return sortedValues[index] ?? 0
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function topCounts(counts: Map<string, number>): Array<{ reason: string; count: number }> {
  return [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 10)
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function formatCounts(counts: Array<{ reason: string; count: number }>, empty: string): string {
  return counts.length > 0 ? counts.map((item) => `- ${item.reason}: ${item.count}`).join('\n') : `- ${empty}`
}

function csvValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item))).join(' | ')
  return String(value ?? '')
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim()
  return cleaned.length > 0 ? cleaned : 'item'
}

function dedupeIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>()
  return issues.filter((issue) => {
    const key = `${issue.severity}:${issue.reason}:${issue.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function encodeHtmlAttribute(value: string): string {
  return encodeURI(value).replaceAll('"', '%22')
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function roundMs(value: number): number {
  return Math.round(value * 100) / 100
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Experiment failed: ${message}`)
  process.exitCode = 1
})
