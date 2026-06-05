import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { buildFixedLayoutCandidate } from '../src/layout-engine-v2/fixedLayoutBaseline'
import { getDefaultProjectSourceMaterial } from '../src/layout-engine-v2/defaultProjectSource'
import { getCatalogFormatsV2 } from '../src/layout-engine-v2/runCatalogResearch'
import { buildCandidateSelectionCandidates, buildScalingCandidate } from '../src/layout-engine-v2/runResearch'
import { selectBestLayoutCandidate } from '../src/layout-engine-v2/selectBestCandidate'
import {
  assertVisualReviewPngNames,
  expectedVisualReviewPngNames,
  parseVisualReviewKeyCsv,
  type VisualReviewKeyCsvRow,
} from '../src/layout-engine-v2/visualReviewKey'
import type {
  FormatSpecV2,
  LayoutCandidate,
  LayoutDecision,
  LayoutElement,
  SourceMaterialV2,
} from '../src/layout-engine-v2/types'

const VISUAL_REVIEW_DIR = path.resolve(process.cwd(), 'research-results', 'visual-review')
const KEY_CSV_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-key.csv')
const PNG_DIR = path.join(VISUAL_REVIEW_DIR, 'png')
const SVG_DIR = path.join(VISUAL_REVIEW_DIR, 'svg')
const GALLERY_PATH = path.join(VISUAL_REVIEW_DIR, 'visual-review-gallery.html')
const EXPECTED_CASE_COUNT = 90

interface RenderedCase {
  row: VisualReviewKeyCsvRow
  format: FormatSpecV2
  candidate: LayoutCandidate
  svg: string
}

function escapeXml(value: string | number | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function metadataString(element: LayoutElement, key: string): string | undefined {
  const value = element.metadata?.[key]

  return typeof value === 'string' ? value : undefined
}

function isColor(value: string | undefined): value is string {
  return typeof value === 'string' && /^(#[0-9a-f]{3,8}|rgb\(|rgba\()/i.test(value)
}

function backgroundFill(source: SourceMaterialV2, element: LayoutElement | undefined): string {
  const metadataColor = element ? metadataString(element, 'color') : undefined

  if (isColor(metadataColor)) {
    return metadataColor
  }

  if (isColor(source.brand?.secondaryColor)) {
    return source.brand.secondaryColor
  }

  return '#f4f1ea'
}

function textFill(source: SourceMaterialV2): string {
  return isColor(source.brand?.primaryColor) ? source.brand.primaryColor : '#111827'
}

function accentFill(source: SourceMaterialV2): string {
  return isColor(source.brand?.secondaryColor) ? source.brand.secondaryColor : '#ffb020'
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word

    if (next.length <= maxChars) {
      current = next
      continue
    }

    if (current) {
      lines.push(current)
      current = word
    } else {
      lines.push(word.slice(0, maxChars))
      current = word.slice(maxChars)
    }

    if (lines.length === maxLines) {
      break
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current)
  }

  return lines.length > 0 ? lines : ['']
}

function renderTextElement(element: LayoutElement, fill: string, weight: number): string {
  const fontSize = clamp(element.fontSize ?? element.rect.height * 0.34, 8, Math.max(8, element.rect.height * 0.7))
  const maxChars = Math.max(4, Math.floor(element.rect.width / Math.max(4, fontSize * 0.56)))
  const maxLines = Math.max(1, Math.floor(element.rect.height / Math.max(8, fontSize * 1.18)))
  const lines = wrapText(element.text ?? '', maxChars, maxLines)
  const lineHeight = fontSize * 1.16
  const textY = element.rect.y + fontSize

  return [
    `<clipPath id="clip-${escapeXml(element.id)}"><rect x="${element.rect.x}" y="${element.rect.y}" width="${element.rect.width}" height="${element.rect.height}" /></clipPath>`,
    `<text clip-path="url(#clip-${escapeXml(element.id)})" x="${element.rect.x}" y="${textY}" fill="${fill}" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="${weight}">`,
    ...lines.map((line, index) => `<tspan x="${element.rect.x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`),
    '</text>',
  ].join('')
}

function renderElement(element: LayoutElement, source: SourceMaterialV2, index: number): string {
  const rect = element.rect

  if (element.role === 'background') {
    return ''
  }

  if (element.role === 'image') {
    return [
      `<defs><linearGradient id="image-grad-${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dbeafe" /><stop offset="100%" stop-color="#93c5fd" /></linearGradient></defs>`,
      `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${Math.min(rect.width, rect.height) * 0.08}" fill="url(#image-grad-${index})" />`,
      `<circle cx="${rect.x + rect.width * 0.68}" cy="${rect.y + rect.height * 0.34}" r="${Math.min(rect.width, rect.height) * 0.18}" fill="#ffffff" opacity="0.38" />`,
      `<path d="M ${rect.x + rect.width * 0.12} ${rect.y + rect.height * 0.78} C ${rect.x + rect.width * 0.32} ${rect.y + rect.height * 0.52}, ${rect.x + rect.width * 0.58} ${rect.y + rect.height * 0.92}, ${rect.x + rect.width * 0.9} ${rect.y + rect.height * 0.58}" fill="none" stroke="#1d4ed8" stroke-width="${Math.max(2, Math.min(rect.width, rect.height) * 0.035)}" opacity="0.55" />`,
    ].join('')
  }

  if (element.role === 'headline') {
    return renderTextElement(element, textFill(source), 800)
  }

  if (element.role === 'subtitle') {
    return renderTextElement(element, '#374151', 500)
  }

  if (element.role === 'cta') {
    const radius = Math.min(rect.width, rect.height) * 0.35
    const fontSize = clamp(element.fontSize ?? rect.height * 0.36, 8, rect.height * 0.62)

    return [
      `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${radius}" fill="${accentFill(source)}" />`,
      `<text x="${rect.x + rect.width / 2}" y="${rect.y + rect.height / 2}" fill="#111827" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="800" text-anchor="middle" dominant-baseline="central">${escapeXml(element.text ?? '')}</text>`,
    ].join('')
  }

  if (element.role === 'logo') {
    const radius = Math.min(rect.width, rect.height) * 0.18
    const fontSize = clamp(Math.min(rect.width, rect.height) * 0.38, 8, 42)

    return [
      `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${radius}" fill="#111827" />`,
      `<text x="${rect.x + rect.width / 2}" y="${rect.y + rect.height / 2}" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="${fontSize}" font-weight="900" text-anchor="middle" dominant-baseline="central">AG</text>`,
    ].join('')
  }

  if (element.text) {
    return renderTextElement(element, textFill(source), 700)
  }

  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${Math.min(rect.width, rect.height) * 0.12}" fill="${accentFill(source)}" opacity="0.72" />`
}

function renderCandidateSvg(candidate: LayoutCandidate, format: FormatSpecV2, source: SourceMaterialV2): string {
  const visibleElements = candidate.elements.filter((element) => element.visible && element.rect.width > 0 && element.rect.height > 0)
  const background = visibleElements.find((element) => element.role === 'background')
  const body = visibleElements.map((element, index) => renderElement(element, source, index)).join('\n')

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${format.width}" height="${format.height}" viewBox="0 0 ${format.width} ${format.height}" role="img">`,
    `<rect x="0" y="0" width="${format.width}" height="${format.height}" fill="${backgroundFill(source, background)}" />`,
    body,
    '</svg>',
  ].join('\n')
}

function buildDecisionForMethod(source: SourceMaterialV2, format: FormatSpecV2, row: VisualReviewKeyCsvRow): LayoutDecision {
  if (row.method === 'scaling') {
    return selectBestLayoutCandidate([buildScalingCandidate(source, format)], format)
  }

  if (row.method === 'fixedLayout') {
    return selectBestLayoutCandidate([buildFixedLayoutCandidate(source, format)], format)
  }

  return selectBestLayoutCandidate(buildCandidateSelectionCandidates(source, format), format)
}

function buildRenderedCases(rows: VisualReviewKeyCsvRow[]): RenderedCase[] {
  const source = getDefaultProjectSourceMaterial()
  const formatsById = new Map(getCatalogFormatsV2().map((format) => [format.id, format]))

  return rows.map((row): RenderedCase => {
    const format = formatsById.get(row.formatId)

    if (!format) {
      throw new Error(`Cannot export visual review PNG: format "${row.formatId}" was not found in catalog.`)
    }

    const decision = buildDecisionForMethod(source, format, row)
    const candidate = decision.selected.candidate

    if (candidate.name !== row.selectedLayout) {
      throw new Error(
        `Cannot export visual review PNG: selected layout mismatch for ${row.caseId} (${candidate.name} !== ${row.selectedLayout}).`,
      )
    }

    return {
      row,
      format,
      candidate,
      svg: renderCandidateSvg(candidate, format, source),
    }
  })
}

async function cleanGeneratedFiles(directory: string, extension: string): Promise<void> {
  await mkdir(directory, { recursive: true })
  const files = await readdir(directory)

  await Promise.all(
    files
      .filter((file) => file.toLowerCase().endsWith(extension))
      .map((file) => unlink(path.join(directory, file))),
  )
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

      if (!ctx) {
        throw new Error('Could not get 2d context')
      }

      ctx.drawImage(image, 0, 0, width, height)
      return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
    },
    { svg, width, height },
  )

  return Buffer.from(base64, 'base64')
}

async function writePngFiles(cases: RenderedCase[]): Promise<void> {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()
    await cleanGeneratedFiles(PNG_DIR, '.png')

    for (const testCase of cases) {
      const bytes = await svgToPngBytes(page, testCase.svg, testCase.format.width, testCase.format.height)
      await writeFile(path.join(PNG_DIR, testCase.row.randomFileName), bytes)
    }
  } finally {
    await browser.close()
  }
}

async function writeSvgFallback(cases: RenderedCase[]): Promise<void> {
  await cleanGeneratedFiles(SVG_DIR, '.svg')

  for (const testCase of cases) {
    await writeFile(path.join(SVG_DIR, testCase.row.randomFileName.replace(/\.png$/i, '.svg')), testCase.svg, 'utf8')
  }

  await writeFile(GALLERY_PATH, renderGalleryHtml(cases), 'utf8')
}

function renderGalleryHtml(cases: RenderedCase[]): string {
  const cards = cases.map((testCase) => {
    const svgName = testCase.row.randomFileName.replace(/\.png$/i, '.svg')

    return [
      '<figure>',
      `<img src="./svg/${escapeXml(svgName)}" alt="${escapeXml(testCase.row.caseId)}" />`,
      `<figcaption>${escapeXml(testCase.row.caseId)}</figcaption>`,
      '</figure>',
    ].join('')
  })

  return [
    '<!doctype html>',
    '<html lang="ru">',
    '<head>',
    '<meta charset="utf-8" />',
    '<title>Visual review gallery</title>',
    '<style>',
    'body{margin:24px;font-family:Arial,sans-serif;background:#fff;color:#111}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}',
    'figure{margin:0;border:1px solid #ddd;padding:10px;background:#fafafa}',
    'img{display:block;width:100%;height:220px;object-fit:contain;background:#fff}',
    'figcaption{margin-top:8px;font-size:13px}',
    '</style>',
    '</head>',
    '<body>',
    '<main class="grid">',
    cards.join('\n'),
    '</main>',
    '</body>',
    '</html>',
  ].join('\n')
}

async function verifyPngFiles(rows: VisualReviewKeyCsvRow[]): Promise<number> {
  const expectedNames = expectedVisualReviewPngNames(rows)
  const expected = new Set(expectedNames)
  const files = (await readdir(PNG_DIR)).filter((file) => file.toLowerCase().endsWith('.png')).sort()

  if (files.length !== expectedNames.length) {
    throw new Error(`Expected ${expectedNames.length} PNG files, got ${files.length}.`)
  }

  for (const file of files) {
    if (!expected.has(file)) {
      throw new Error(`Unexpected PNG file: ${file}.`)
    }

    if (/scaling|fixedLayout|candidateSelection/i.test(file)) {
      throw new Error(`PNG file name reveals method: ${file}.`)
    }

    const fileStat = await stat(path.join(PNG_DIR, file))

    if (fileStat.size <= 0) {
      throw new Error(`PNG file is empty: ${file}.`)
    }
  }

  return files.length
}

async function main(): Promise<void> {
  if (!existsSync(KEY_CSV_PATH)) {
    throw new Error(`Missing visual review key CSV: ${KEY_CSV_PATH}`)
  }

  const rows = parseVisualReviewKeyCsv(await readFile(KEY_CSV_PATH, 'utf8'))
  assertVisualReviewPngNames(rows)

  if (rows.length !== EXPECTED_CASE_COUNT) {
    throw new Error(`Expected ${EXPECTED_CASE_COUNT} visual review cases, got ${rows.length}.`)
  }

  const cases = buildRenderedCases(rows)

  try {
    await writePngFiles(cases)
    const pngCount = await verifyPngFiles(rows)

    console.log('visual review PNG export completed')
    console.log(`cases: ${pngCount}`)
    console.log(`output: ${path.relative(process.cwd(), PNG_DIR).replace(/\\/g, '/')}`)
  } catch (error: unknown) {
    await writeSvgFallback(cases)

    console.log('visual review PNG export failed')
    console.log(`reason: ${error instanceof Error ? error.message : String(error)}`)
    console.log(`fallbackSvg: ${path.relative(process.cwd(), SVG_DIR).replace(/\\/g, '/')}`)
    console.log(`fallbackGallery: ${path.relative(process.cwd(), GALLERY_PATH).replace(/\\/g, '/')}`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
