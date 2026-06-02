import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import JSZip from 'jszip'
import { AD_FORMAT_CATALOG } from '../src/data/adFormats'
import { buildScene } from '../src/lib/buildScene'
import { DEFAULT_COMPOSITION_BY_FORMAT } from '../src/lib/formats'
import { fixLayout } from '../src/lib/fixLayout'
import { getActiveImageSrc } from '../src/lib/projectImages'
import {
  buildResearchReport,
  buildResearchValidationRecord,
  researchRecordsToCsv,
  researchReportToMarkdown,
  type ResearchAuditMethod,
  type ResearchValidationRecord,
} from '../src/lib/researchReport'
import { projectSchema } from '../src/lib/serialize'
import type { FormatKey, FormatRuleSet, Project, Scene } from '../src/lib/types'
import { SceneRenderer } from '../src/renderers/SceneRenderer'

type CliOptions = {
  projectsDir: string
  outDir: string
  skipPng: boolean
}

type LoadedProject = {
  scenarioId: string
  fileName: string
  project: Project
}

type AuditRender = {
  scene: Scene | null
  svg: string | null
  exportOk: boolean
  exportError?: string
}

type PngArtifactSummary = {
  requested: number
  created: number
  zipCount: number
  unavailable: Array<{ scenarioId: string; formatId: string; reason: string }>
}

const DEFAULT_PROJECTS_DIR = path.resolve('experiment/projects')
const DEFAULT_OUT_DIR = path.resolve('research-output')
const METHODS: ResearchAuditMethod[] = ['simpleScale', 'fixedTemplate', 'adaptiveLayout']

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const projects = (await loadProjectDir(path.resolve(options.projectsDir))).slice(0, 5)
  if (projects.length !== 5) {
    throw new Error(`Research audit requires exactly 5 brand scenarios; found ${projects.length} in ${options.projectsDir}`)
  }

  const formats = [...AD_FORMAT_CATALOG]
  const outDir = path.resolve(options.outDir)
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })

  const records: ResearchValidationRecord[] = []
  const adaptiveSvgs = new Map<string, { scenarioId: string; format: FormatRuleSet; svg: string }>()

  for (const loaded of projects) {
    for (const format of formats) {
      for (const method of METHODS) {
        const rendered = renderMethod(loaded.project, format, method)
        records.push(buildResearchValidationRecord({
          scenarioId: loaded.scenarioId,
          method,
          project: loaded.project,
          format,
          scene: rendered.scene,
          exportOk: rendered.exportOk,
          exportError: rendered.exportError,
        }))

        if (method === 'adaptiveLayout' && rendered.svg) {
          adaptiveSvgs.set(`${loaded.scenarioId}:${format.key}`, {
            scenarioId: loaded.scenarioId,
            format,
            svg: rendered.svg,
          })
        }
      }
    }
  }

  const pngArtifacts = options.skipPng
    ? unavailablePngArtifacts(projects, formats, 'PNG generation skipped by --skip-png')
    : await writeAdaptivePngArtifacts(outDir, projects, formats, adaptiveSvgs)

  const report = {
    ...buildResearchReport(records),
    audit: {
      scenarioCount: projects.length,
      formatCount: formats.length,
      methodCount: METHODS.length,
      expectedCaseCount: projects.length * formats.length * METHODS.length,
      reproducedCaseCount: records.length,
      methods: METHODS,
      scenarioFiles: projects.map((project) => ({ scenarioId: project.scenarioId, fileName: project.fileName })),
      pngArtifacts,
    },
  }

  await writeFile(path.join(outDir, 'validation-summary.csv'), researchRecordsToCsv(records), 'utf8')
  await writeFile(path.join(outDir, 'validation-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(path.join(outDir, 'experiment-summary.md'), renderAuditMarkdown(report), 'utf8')

  console.log(`Research scenarios: ${projects.length}`)
  console.log(`Target formats: ${formats.length}`)
  console.log(`Research results: ${records.length}`)
  console.log(`Expected cases: ${report.audit.expectedCaseCount}`)
  console.log(`Ready/needsFix/critical: ${report.summary.ready.count}/${report.summary.needsFix.count}/${report.summary.critical.count}`)
  console.log(`Adaptive PNG created: ${pngArtifacts.created}/${pngArtifacts.requested}`)
  console.log(`Adaptive ZIP files: ${pngArtifacts.zipCount}`)
  console.log(`Report: ${outDir}`)
}

function parseArgs(argv: string[]): CliOptions {
  const map = new Map<string, string>()
  let skipPng = false
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--skip-png') {
      skipPng = true
      continue
    }
    if (!token.startsWith('--')) continue
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for argument: ${token}`)
    map.set(token, value)
    i++
  }
  return {
    projectsDir: map.get('--projects-dir') ?? DEFAULT_PROJECTS_DIR,
    outDir: map.get('--out') ?? DEFAULT_OUT_DIR,
    skipPng,
  }
}

async function loadProjectDir(projectsDir: string): Promise<LoadedProject[]> {
  const entries = await readdir(projectsDir, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  const projects: LoadedProject[] = []
  for (let index = 0; index < files.length; index++) {
    const fileName = files[index]
    if (!fileName) continue
    const raw = await readFile(path.join(projectsDir, fileName), 'utf8')
    const parsed: unknown = JSON.parse(raw)
    const result = projectSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error(`Project ${fileName} does not match projectSchema: ${result.error.issues[0]?.message ?? 'unknown issue'}`)
    }
    projects.push({
      scenarioId: `scenario-${String(index + 1).padStart(2, '0')}`,
      fileName,
      project: result.data as Project,
    })
  }
  return projects
}

function renderMethod(project: Project, format: FormatRuleSet, method: ResearchAuditMethod): AuditRender {
  try {
    const inputScene = createInputScene(project, format.key)
    const scene = method === 'simpleScale'
      ? simpleScaleScene(inputScene)
      : method === 'fixedTemplate'
        ? fixedTemplateScene(project, inputScene, format)
        : adaptiveLayoutScene(project, inputScene, format)
    const svg = renderSceneSvg(scene, format, project)
    const exportOk = isRenderableSvg(svg, format)
    return {
      scene,
      svg,
      exportOk,
      exportError: exportOk ? undefined : 'SVG renderer did not create a valid root element',
    }
  } catch (error: unknown) {
    return {
      scene: null,
      svg: null,
      exportOk: false,
      exportError: error instanceof Error ? error.message : String(error),
    }
  }
}

function simpleScaleScene(inputScene: Scene): Scene {
  return {
    ...inputScene,
    layoutPolicy: {
      formatKind: 'simple-scale',
      source: { type: 'manual', name: 'Research audit baseline' },
      appliedRules: ['simple scale baseline'],
    },
  }
}

function fixedTemplateScene(project: Project, inputScene: Scene, format: FormatRuleSet): Scene {
  const built = buildScene(inputScene, format.key, project.brandKit, project.enabled, {
    override: DEFAULT_COMPOSITION_BY_FORMAT[String(format.key)] ?? undefined,
    assetHint: project.assetHint,
    locale: project.activeLocale,
    customFormats: project.customFormats,
  })
  return {
    ...built,
    layoutPolicy: {
      ...(built.layoutPolicy ?? {
        formatKind: 'fixed-template',
        source: { type: 'manual', name: 'Research audit fixed template' },
        appliedRules: [],
      }),
      appliedRules: [...(built.layoutPolicy?.appliedRules ?? []), 'fixed template baseline'],
    },
  }
}

function adaptiveLayoutScene(project: Project, inputScene: Scene, format: FormatRuleSet): Scene {
  const built = buildScene(inputScene, format.key, project.brandKit, project.enabled, {
    override: project.formatOverrides?.[format.key],
    assetHint: project.assetHint,
    blockOverrides: project.blockOverrides?.[format.key],
    locale: project.activeLocale,
    customFormats: project.customFormats,
    density: project.formatDensities?.[format.key] ?? project.layoutDensity,
  })
  return fixLayout(built, format)
}

function createInputScene(project: Project, formatKey: FormatKey): Scene {
  const next: Scene = {
    ...project.master,
    title: project.master.title ? { ...project.master.title } : undefined,
    subtitle: project.master.subtitle ? { ...project.master.subtitle } : undefined,
    cta: project.master.cta ? { ...project.master.cta } : undefined,
    badge: project.master.badge ? { ...project.master.badge } : undefined,
    logo: project.master.logo ? { ...project.master.logo } : undefined,
    image: project.master.image ? { ...project.master.image } : undefined,
  }

  if (next.image) {
    next.image.src = getActiveImageSrc(project, formatKey)
    const focal = project.imageFocals?.[formatKey]
    if (focal) {
      next.image.focalX = focal.x
      next.image.focalY = focal.y
    }
  }
  if (next.logo) next.logo.src = project.logoSrc ?? next.logo.src
  return next
}

function renderSceneSvg(scene: Scene, format: FormatRuleSet, project: Project): string {
  return renderToStaticMarkup(
    createElement(SceneRenderer, {
      scene,
      rules: format,
      displayFont: project.brandKit.displayFont,
      textFont: project.brandKit.textFont,
      brandInitials: project.brandKit.brandName,
      brandColor: project.brandKit.palette.accent,
      imageAspectRatio: project.assetHint?.aspectRatio ?? null,
    }),
  )
}

function isRenderableSvg(svg: string, format: FormatRuleSet): boolean {
  const svgTag = svg.match(/<svg\b[^>]*>/i)?.[0]
  if (!svgTag) return false
  return svgTag.includes(`width="${format.width}"`) && svgTag.includes(`height="${format.height}"`)
}

async function writeAdaptivePngArtifacts(
  outDir: string,
  projects: LoadedProject[],
  formats: FormatRuleSet[],
  adaptiveSvgs: Map<string, { scenarioId: string; format: FormatRuleSet; svg: string }>,
): Promise<PngArtifactSummary> {
  const requested = projects.length * formats.length
  const unavailable: PngArtifactSummary['unavailable'] = []
  let created = 0
  let zipCount = 0
  const pngRoot = path.join(outDir, 'adaptive-png')
  const zipRoot = path.join(outDir, 'adaptive-zips')
  await mkdir(pngRoot, { recursive: true })
  await mkdir(zipRoot, { recursive: true })

  let browser: Awaited<ReturnType<typeof import('playwright').chromium.launch>> | null = null
  try {
    const { chromium } = await import('playwright')
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    for (const project of projects) {
      const zip = new JSZip()
      const scenarioDir = path.join(pngRoot, project.scenarioId)
      await mkdir(scenarioDir, { recursive: true })

      for (const format of formats) {
        const key = `${project.scenarioId}:${format.key}`
        const rendered = adaptiveSvgs.get(key)
        if (!format.supportsPng) {
          unavailable.push({ scenarioId: project.scenarioId, formatId: String(format.key), reason: 'unavailable: format does not support PNG export' })
          continue
        }
        if (!rendered?.svg) {
          unavailable.push({ scenarioId: project.scenarioId, formatId: String(format.key), reason: 'unavailable: adaptive SVG was not rendered' })
          continue
        }

        const bytes = await svgToPngBytes(page, rendered.svg, format.width, format.height)
        const fileName = `${safeSegment(project.scenarioId)}__${safeSegment(String(format.key))}.png`
        await writeFile(path.join(scenarioDir, fileName), bytes)
        zip.file(fileName, bytes)
        created++
      }

      const zipBytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
      await writeFile(path.join(zipRoot, `${safeSegment(project.scenarioId)}.zip`), zipBytes)
      zipCount++
    }
  } catch (error: unknown) {
    const reason = `unavailable: PNG export failed in headless browser (${error instanceof Error ? error.message : String(error)})`
    for (const project of projects) {
      for (const format of formats) {
        unavailable.push({ scenarioId: project.scenarioId, formatId: String(format.key), reason })
      }
    }
  } finally {
    await browser?.close()
  }

  return { requested, created, zipCount, unavailable }
}

async function svgToPngBytes(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof import('playwright').chromium.launch>>['newPage']>>,
  svg: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ({ svg, width, height }) => {
      const image = new Image()
      const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Could not load SVG into image'))
        image.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get 2d context')
      ctx.drawImage(image, 0, 0, width, height)
      return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
    },
    { svg, width, height },
  )
  return Buffer.from(base64, 'base64')
}

function unavailablePngArtifacts(projects: LoadedProject[], formats: FormatRuleSet[], reason: string): PngArtifactSummary {
  return {
    requested: projects.length * formats.length,
    created: 0,
    zipCount: 0,
    unavailable: projects.flatMap((project) =>
      formats.map((format) => ({ scenarioId: project.scenarioId, formatId: String(format.key), reason })),
    ),
  }
}

function renderAuditMarkdown(report: ReturnType<typeof buildResearchReport> & {
  audit: {
    scenarioCount: number
    formatCount: number
    methodCount: number
    expectedCaseCount: number
    reproducedCaseCount: number
    methods: ResearchAuditMethod[]
    scenarioFiles: Array<{ scenarioId: string; fileName: string }>
    pngArtifacts: PngArtifactSummary
  }
}): string {
  const base = researchReportToMarkdown(report)
  const pngUnavailable = report.audit.pngArtifacts.unavailable.length
  const reproduced = report.audit.reproducedCaseCount === report.audit.expectedCaseCount
  return `${base}
## Audit Matrix

| Metric | Value |
| --- | ---: |
| Brand scenarios | ${report.audit.scenarioCount} |
| Target formats | ${report.audit.formatCount} |
| Methods | ${report.audit.methodCount} |
| Expected validation cases | ${report.audit.expectedCaseCount} |
| Reproduced validation cases | ${report.audit.reproducedCaseCount} |

## Method Counts

${report.audit.methods.map((method) => `- ${method}: ${report.summary.byMethod[method].total}`).join('\n')}

## Critical Comparison

| Method | Critical cases |
| --- | ---: |
| simpleScale | ${report.summary.byMethod.simpleScale.critical.count} |
| fixedTemplate | ${report.summary.byMethod.fixedTemplate.critical.count} |
| adaptiveLayout | ${report.summary.byMethod.adaptiveLayout.critical.count} |

AdaptiveLayout critical is ${report.summary.byMethod.adaptiveLayout.critical.count < report.summary.byMethod.simpleScale.critical.count ? 'below' : 'not below'} simpleScale critical.

## Adaptive PNG / ZIP Export

| Metric | Value |
| --- | ---: |
| Requested adaptive PNG artifacts | ${report.audit.pngArtifacts.requested} |
| Created adaptive PNG artifacts | ${report.audit.pngArtifacts.created} |
| Created adaptive ZIP archives | ${report.audit.pngArtifacts.zipCount} |
| Unavailable PNG artifacts | ${pngUnavailable} |

PNG unavailable means the format does not declare PNG support or the browser export path could not create a PNG. Unavailable artifacts are recorded in validation-report.json and are not replaced with invented results.

## Source Scenario Files

${report.audit.scenarioFiles.map((item) => `- ${item.scenarioId}: ${item.fileName}`).join('\n')}

## Reproducibility Note

${reproduced
  ? 'The full 5 x 126 x 3 validation matrix was reproduced: 1890 technical validation cases.'
  : `The full matrix was not reproduced: ${report.audit.reproducedCaseCount} of ${report.audit.expectedCaseCount} validation cases were created.`}

## Brief Diploma Conclusion

The experiment checks technical suitability of generated advertising layouts without changing the generation algorithm or manually correcting outputs. The adaptive complex can be compared against simple scaling and fixed templates using the same validator fields and the same target format catalog. Critical cases indicate blocking technical defects; needsFix cases indicate generated materials that exist but require local review; ready cases pass the automatic technical checks.
`
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim()
  return cleaned.length > 0 ? cleaned : 'item'
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Research report generation failed: ${message}`)
  process.exitCode = 1
})
