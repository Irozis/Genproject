import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildScene } from '../src/lib/buildScene'
import { fixLayout } from '../src/lib/fixLayout'
import { getFormat } from '../src/lib/formats'
import { resolveText, type TextRegime } from '../src/lib/localeResolver'
import { projectSchema } from '../src/lib/serialize'
import type { FormatKey, Project, Scene } from '../src/lib/types'
import { SceneRenderer } from '../src/renderers/SceneRenderer'

const RUNS = 10

type CliOptions = {
  projectPath: string
  feedPath: string
  locale: string
  regime: TextRegime
}

type FeedRow = {
  id: string
  title: string
  subtitle: string
  cta: string
  badge?: string
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const project = await loadProject(options.projectPath)
  const feed = await loadFeed(options.feedPath)

  const hashByAssetFormat = new Map<string, string[]>()

  for (let runIndex = 0; runIndex < RUNS; runIndex++) {
    for (const row of feed) {
      for (const formatKey of project.selectedFormats) {
        const rules = getFormat(formatKey, project.customFormats)
        const inputScene = createInputScene(project, row, options.locale, options.regime, formatKey)
        const built = buildScene(inputScene, formatKey, project.brandKit, project.enabled, {
          override: project.formatOverrides?.[formatKey],
          assetHint: project.assetHint,
          blockOverrides: project.blockOverrides?.[formatKey],
          locale: options.locale,
          customFormats: project.customFormats,
        })
        const fixed = fixLayout(built, rules)
        const svg = renderSceneSvg(fixed, rules, project)
        const hash = sha256(svg)
        const key = `${row.id}::${String(formatKey)}`
        const hashes = hashByAssetFormat.get(key)
        if (hashes) {
          hashes.push(hash)
        } else {
          hashByAssetFormat.set(key, [hash])
        }
      }
    }
  }

  const assetsCount = hashByAssetFormat.size
  const totalComparisons = assetsCount * (RUNS - 1)
  let matchedComparisons = 0
  const unstableAssets: Array<{ key: string; hashes: string[] }> = []

  for (const [key, hashes] of hashByAssetFormat) {
    const baseline = hashes[0]
    let isStable = true
    for (let i = 1; i < hashes.length; i++) {
      if (hashes[i] === baseline) {
        matchedComparisons++
      } else {
        isStable = false
      }
    }
    if (!isStable) {
      unstableAssets.push({
        key,
        hashes: unique(hashes),
      })
    }
  }

  const matchRate = totalComparisons === 0 ? 100 : (matchedComparisons / totalComparisons) * 100
  console.log(`Hash match rate: ${matchRate.toFixed(2)}% (${matchedComparisons}/${totalComparisons} совпадений)`)

  if (unstableAssets.length === 0) {
    console.log('Unstable assets: none')
    return
  }

  console.log('Unstable assets:')
  for (const asset of unstableAssets) {
    console.log(`- ${asset.key}`)
    for (const hash of asset.hashes) {
      console.log(`  ${hash}`)
    }
  }

  process.exitCode = 1
}

function parseArgs(argv: string[]): CliOptions {
  const map = new Map<string, string>()
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for argument: ${token}`)
    }
    map.set(token, value)
    i++
  }

  const projectPath = map.get('--project')
  const feedPath = map.get('--feed')
  const locale = map.get('--locale')
  const regimeRaw = map.get('--regime')

  if (!projectPath) throw new Error('Required argument missing: --project <path-to-project.json>')
  if (!feedPath) throw new Error('Required argument missing: --feed <path-to-feed.csv|json>')
  if (!locale) throw new Error('Required argument missing: --locale <locale>')
  if (!regimeRaw) throw new Error('Required argument missing: --regime <nominal|translated-long|stress-long>')
  if (regimeRaw !== 'nominal' && regimeRaw !== 'translated-long' && regimeRaw !== 'stress-long') {
    throw new Error('Invalid --regime value. Use: nominal | translated-long | stress-long')
  }

  return {
    projectPath,
    feedPath,
    locale,
    regime: regimeRaw,
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

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Feed row field "${field}" must be a non-empty string`)
  }
  return value.trim()
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Determinism check failed: ${message}`)
  process.exitCode = 1
})
