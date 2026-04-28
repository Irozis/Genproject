import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildScene } from '../src/lib/buildScene'
import { runCompliance, type ComplianceEntry } from '../src/lib/compliance'
import { fixLayout } from '../src/lib/fixLayout'
import { getFormat } from '../src/lib/formats'
import { resolveText, type TextRegime } from '../src/lib/localeResolver'
import { projectSchema } from '../src/lib/serialize'
import type { FormatKey, Project, Scene } from '../src/lib/types'
import { SceneRenderer } from '../src/renderers/SceneRenderer'

type CliOptions = {
  projectPath: string
  feedPath: string
  outDir: string
  locale: string
  regime: TextRegime
  noFix: boolean
}

type FeedRow = {
  id: string
  title: string
  subtitle: string
  cta: string
  badge?: string
}

type SummaryEntry = ComplianceEntry & {
  assetId: string
  pass: boolean
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const project = await loadProject(options.projectPath)
  const feed = await loadFeed(options.feedPath)

  const outRoot = path.resolve(options.outDir)
  await mkdir(outRoot, { recursive: true })

  const summary: SummaryEntry[] = []

  for (const row of feed) {
    const rowDir = path.join(outRoot, safeSegment(row.id))
    await mkdir(rowDir, { recursive: true })

    for (const formatKey of project.selectedFormats) {
      const rules = getFormat(formatKey, project.customFormats)
      const sceneForInput = createInputScene(project, row, options.locale, options.regime, formatKey)
      const built = buildScene(sceneForInput, formatKey, project.brandKit, project.enabled, {
        override: project.formatOverrides?.[formatKey],
        assetHint: project.assetHint,
        blockOverrides: project.blockOverrides?.[formatKey],
        locale: options.locale,
        customFormats: project.customFormats,
      })
      const sceneForChecks = options.noFix ? built : fixLayout(built, rules)
      const compliance = runCompliance(sceneForChecks, rules, project.brandKit)
      const finalized: SummaryEntry = {
        ...compliance,
        assetId: row.id,
        locale: options.locale,
        pass: compliance.checks.every((check) => check.status !== 'fail'),
      }

      const svg = renderSceneSvg(sceneForChecks, rules, project)
      await writeFile(path.join(rowDir, `${safeSegment(String(formatKey))}.svg`), svg, 'utf8')
      await writeFile(
        path.join(rowDir, `${safeSegment(String(formatKey))}.compliance.json`),
        JSON.stringify(finalized, null, 2),
        'utf8',
      )
      summary.push(finalized)
    }
  }

  await writeFile(path.join(outRoot, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8')
  await writeFile(path.join(outRoot, 'summary.html'), buildSummaryHtml(summary), 'utf8')

  const total = summary.length
  const passCount = summary.filter((entry) => entry.pass).length
  const failCount = total - passCount
  const passPct = total > 0 ? ((passCount / total) * 100).toFixed(1) : '0.0'

  console.log(`Total: ${total} assets`)
  console.log(`Pass: ${passCount} (${passPct}%)`)
  console.log(`Fail: ${failCount}`)
}

function parseArgs(argv: string[]): CliOptions {
  const map = new Map<string, string>()
  let noFix = false
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    if (token === '--no-fix') {
      noFix = true
      continue
    }
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for argument: ${token}`)
    }
    map.set(token, value)
    i++
  }

  const projectPath = map.get('--project')
  const feedPath = map.get('--feed')
  if (!projectPath) throw new Error('Required argument missing: --project <path-to-project.json>')
  if (!feedPath) throw new Error('Required argument missing: --feed <path-to-feed.csv|json>')

  const outDir = map.get('--out') ?? './out'
  const locale = map.get('--locale') ?? 'en'
  const regimeRaw = map.get('--regime') ?? 'nominal'
  if (regimeRaw !== 'nominal' && regimeRaw !== 'translated-long' && regimeRaw !== 'stress-long') {
    throw new Error('Invalid --regime value. Use: nominal | translated-long | stress-long')
  }

  return {
    projectPath,
    feedPath,
    outDir,
    locale,
    regime: regimeRaw,
    noFix,
  }
}

async function loadProject(projectPath: string): Promise<Project> {
  const raw = await readFile(path.resolve(projectPath), 'utf8')
  const parsed: unknown = JSON.parse(raw)
  const result = projectSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`project.json does not match projectSchema: ${result.error.issues[0]?.message ?? 'unknown issue'}`)
  }
  return result.data as Project
}

async function loadFeed(feedPath: string): Promise<FeedRow[]> {
  const abs = path.resolve(feedPath)
  if (abs.toLowerCase().endsWith('.json')) {
    const raw = await readFile(abs, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('feed.json must be an array of rows')
    }
    return parsed.map(validateFeedRow)
  }
  if (abs.toLowerCase().endsWith('.csv')) {
    const raw = await readFile(abs, 'utf8')
    return parseCsvFeed(raw).map(validateFeedRow)
  }
  throw new Error('Unsupported feed extension. Use .csv or .json')
}

function parseCsvFeed(csv: string): Array<Record<string, string>> {
  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]
    const next = csv[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += ch
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  if (rows.length === 0) return []
  const [headerRow, ...dataRows] = rows
  const headers = headerRow.map((h) => h.trim())
  const out: Array<Record<string, string>> = []
  for (const values of dataRows) {
    if (values.every((v) => v.trim() === '')) continue
    const record: Record<string, string> = {}
    headers.forEach((h, idx) => {
      record[h] = (values[idx] ?? '').trim()
    })
    out.push(record)
  }
  return out
}

function validateFeedRow(value: unknown): FeedRow {
  if (!value || typeof value !== 'object') {
    throw new Error('Feed row must be an object')
  }
  const row = value as Record<string, unknown>
  const id = asString(row.id, 'id')
  const title = asString(row.title, 'title')
  const subtitle = asString(row.subtitle, 'subtitle')
  const cta = asString(row.cta, 'cta')
  const badge = row.badge === undefined || row.badge === null ? undefined : String(row.badge)
  return { id, title, subtitle, cta, badge }
}

function createInputScene(
  project: Project,
  row: FeedRow,
  locale: string,
  regime: TextRegime,
  formatKey: FormatKey,
): Scene {
  const next: Scene = {
    ...project.master,
    title: project.master.title ? { ...project.master.title } : undefined,
    subtitle: project.master.subtitle ? { ...project.master.subtitle } : undefined,
    cta: project.master.cta ? { ...project.master.cta } : undefined,
    badge: project.master.badge ? { ...project.master.badge } : undefined,
    logo: project.master.logo ? { ...project.master.logo } : undefined,
    image: project.master.image ? { ...project.master.image } : undefined,
  }

  if (next.title) next.title.text = resolveText(row.title, locale, regime)
  if (next.subtitle) next.subtitle.text = resolveText(row.subtitle, locale, regime)
  if (next.cta) next.cta.text = resolveText(row.cta, locale, regime)
  if (next.badge && row.badge !== undefined) next.badge.text = resolveText(row.badge, locale, regime)

  if (next.image) {
    next.image.src = project.imageSrc
    const focal = project.imageFocals?.[formatKey]
    if (focal) {
      next.image.focalX = focal.x
      next.image.focalY = focal.y
    }
  }
  if (next.logo) next.logo.src = project.logoSrc

  return next
}

function renderSceneSvg(scene: Scene, rules: ReturnType<typeof getFormat>, project: Project): string {
  return renderToStaticMarkup(
    createElement(SceneRenderer, {
      scene,
      rules,
      displayFont: project.brandKit.displayFont,
      textFont: project.brandKit.textFont,
      brandInitials: project.brandKit.brandName,
      brandColor: project.brandKit.palette.accent,
    }),
  )
}

function buildSummaryHtml(entries: SummaryEntry[]): string {
  const rows = entries
    .map((entry) => {
      const status = entry.pass ? 'PASS' : 'FAIL'
      const details = entry.checks
        .map((check) => `${check.rule}: ${check.status}${check.detail ? ` (${check.detail})` : ''}`)
        .join(' | ')
      return `<tr>
  <td>${escapeHtml(entry.assetId)}</td>
  <td>${escapeHtml(entry.formatId)}</td>
  <td>${escapeHtml(entry.locale)}</td>
  <td>${escapeHtml(status)}</td>
  <td>${escapeHtml(details)}</td>
</tr>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Generation Summary</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; margin: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d9d9d9; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Generation Summary</h1>
  <table>
    <thead>
      <tr>
        <th>Asset ID</th>
        <th>Format</th>
        <th>Locale</th>
        <th>Status</th>
        <th>Checks</th>
      </tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Feed row field "${field}" must be a non-empty string`)
  }
  return value.trim()
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim()
  return cleaned.length > 0 ? cleaned : 'item'
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Generation failed: ${message}`)
  process.exitCode = 1
})
