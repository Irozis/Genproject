// Export pipeline. Boundary code: side effects allowed here.
// SVG → canvas (no html-to-image needed), then bundled into ZIP / PDF.
// pdf-lib is dynamically imported to keep it out of the main bundle.

import JSZip from 'jszip'
import { getFormat } from './formats'
import type { FormatKey, FormatRuleSet, RuleSource, RuleSourceType, Scene } from './types'

// ---------------------------------------------------------------------------
// Core: SVGSVGElement → PNG data URL at exact format resolution
// ---------------------------------------------------------------------------

export async function svgToPngDataUrl(
  svgEl: SVGSVGElement,
  width: number,
  height: number,
): Promise<string> {
  // Clone so we can set explicit px dimensions without mutating the live DOM
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const xml = new XMLSerializer().serializeToString(clone)
  // Encode special chars so the SVG can be used as an img src
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2d context')
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------------------------------------------------------------------------
// Public: export all selected formats as a single ZIP download
// ---------------------------------------------------------------------------

export async function exportZip(
  svgNodes: Partial<Record<FormatKey, SVGSVGElement>>,
  formatKeys: FormatKey[],
  projectName: string,
  customFormats?: FormatRuleSet[],
  options: { scenesByFormat?: Partial<Record<FormatKey, Scene>> } = {},
): Promise<void> {
  const zip = new JSZip()
  const safe = projectName.replace(/[^a-z0-9_-]/gi, '_') || 'project'

  for (const k of formatKeys) {
    const svg = svgNodes[k]
    if (!svg) continue
    const format = getFormat(k, customFormats)
    const { width, height } = format
    // sequential to avoid GPU contention
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await svgToPngDataUrl(svg, width, height)
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    zip.file(`${safe}__${k}.png`, base64, { base64: true })
  }

  const formats = formatKeys.map((key) => getFormat(key, customFormats))
  zip.file('ad-format-manifest.json', JSON.stringify(formats, null, 2))
  const report = buildExportReport(formats, options.scenesByFormat)
  zip.file('export-report.json', JSON.stringify(report, null, 2))
  zip.file('export-report.txt', renderExportReportText(report))

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  triggerDownload(URL.createObjectURL(blob), `${safe}.zip`)
}

// ---------------------------------------------------------------------------
// Public: export all selected formats as a single PDF (one page per format)
// ---------------------------------------------------------------------------

export async function exportPdf(
  svgNodes: Partial<Record<FormatKey, SVGSVGElement>>,
  formatKeys: FormatKey[],
  projectName: string,
  customFormats?: FormatRuleSet[],
): Promise<void> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const safe = projectName.replace(/[^a-z0-9_-]/gi, '_') || 'project'

  for (const k of formatKeys) {
    const svg = svgNodes[k]
    if (!svg) continue
    const { width, height } = getFormat(k, customFormats)
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await svgToPngDataUrl(svg, width, height)
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    const bytes = base64ToBytes(base64)
    // eslint-disable-next-line no-await-in-loop
    const png = await doc.embedPng(bytes)
    const page = doc.addPage([width, height])
    page.drawImage(png, { x: 0, y: 0, width, height })
  }

  const pdfBytes = await doc.save()
  // pdf-lib returns Uint8Array<ArrayBufferLike>; Blob() needs an ArrayBuffer
  const buffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength,
  ) as ArrayBuffer
  const blob = new Blob([buffer], { type: 'application/pdf' })
  triggerDownload(URL.createObjectURL(blob), `${safe}.pdf`)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // small delay before revoking so the browser can start the download
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export type ExportRuleSourceStatus =
  | 'official_match'
  | 'partially_official'
  | 'derived_from_geometry'
  | 'heuristic_only'
  | 'needs_manual_review'

export type ExportFormatRuleSources = {
  formatId: string
  formatName: string
  platformName?: string
  placementName?: string
  ruleConfidence?: FormatRuleSet['ruleConfidence']
  officialRequirementsUsed: string[]
  derivedRulesUsed: string[]
  heuristicRulesUsed: string[]
  unknownRulesUsed: string[]
  needsManualReview: boolean
  status: ExportRuleSourceStatus
}

export type ExportReport = {
  generatedAt: string
  formatCount: number
  formatRuleSources: ExportFormatRuleSources[]
}

const LAYOUT_SOURCE_EXPLANATION =
  'Часть правил компоновки является эвристической. Официальные требования площадок обычно задают размеры, вес файла, типы файлов, safe zones, зоны маркировки и отдельные ограничения по тексту. Они, как правило, не задают точное процентное расположение изображения, текста и CTA. Поэтому процентные зоны image/text/CTA используются как внутренние инженерные правила приложения для обеспечения читаемости и устойчивости автоматической адаптации.'

export function buildExportReport(
  formats: FormatRuleSet[],
  scenesByFormat: Partial<Record<FormatKey, Scene>> = {},
  now = new Date(),
): ExportReport {
  return {
    generatedAt: now.toISOString(),
    formatCount: formats.length,
    formatRuleSources: formats.map((format) => buildFormatRuleSourceReport(format, scenesByFormat[format.key])),
  }
}

function buildFormatRuleSourceReport(format: FormatRuleSet, scene: Scene | undefined): ExportFormatRuleSources {
  const officialRequirementsUsed = collectSourceRules(format, 'official')
  const derivedRulesUsed = collectSourceRules(format, 'derived')
  const heuristicRulesUsed = collectSourceRules(format, 'heuristic')
  const unknownRulesUsed = [
    ...collectSourceRules(format, 'unknown'),
    ...collectSourceRules(format, 'manual'),
  ]

  derivedRulesUsed.push(...derivedGeometryRules(format, scene))
  heuristicRulesUsed.push(...heuristicLayoutRules(format, scene))

  const fallbackApplied = scene?.layoutPolicy?.appliedRules.includes('manual-review-fallback') ?? false
  const layoutNotOfficial = format.ruleSources?.layoutDefaults?.type !== 'official'
  const needsManualReview =
    format.ruleConfidence === 'low' ||
    unknownRulesUsed.length > 0 ||
    fallbackApplied ||
    heuristicRulesUsed.length > 0 ||
    layoutNotOfficial

  return {
    formatId: format.key,
    formatName: format.label,
    platformName: format.platformName,
    placementName: format.placementName,
    ruleConfidence: format.ruleConfidence,
    officialRequirementsUsed: unique(officialRequirementsUsed),
    derivedRulesUsed: unique(derivedRulesUsed),
    heuristicRulesUsed: unique(heuristicRulesUsed),
    unknownRulesUsed: unique(unknownRulesUsed),
    needsManualReview,
    status: ruleSourceStatus({
      officialCount: officialRequirementsUsed.length,
      derivedCount: derivedRulesUsed.length,
      heuristicCount: heuristicRulesUsed.length,
      unknownCount: unknownRulesUsed.length,
      needsManualReview,
      layoutNotOfficial,
    }),
  }
}

function collectSourceRules(format: FormatRuleSet, sourceType: RuleSourceType): string[] {
  const sources = format.ruleSources
  if (!sources) return sourceType === 'unknown' ? ['rule source metadata missing'] : []

  const entries: Array<[keyof NonNullable<FormatRuleSet['ruleSources']>, RuleSource]> = Object.entries(sources) as Array<[
    keyof NonNullable<FormatRuleSet['ruleSources']>,
    RuleSource,
  ]>

  return entries.flatMap(([key, source]) => {
    if (source.type !== sourceType) return []
    return sourceRuleLabels(format, key)
  })
}

function sourceRuleLabels(format: FormatRuleSet, key: keyof NonNullable<FormatRuleSet['ruleSources']>): string[] {
  if (key === 'size') return ['size']
  if (key === 'fileConstraints') {
    const labels: string[] = []
    if (format.allowedFileTypes?.length) labels.push('file type')
    if (format.maxFileSizeKb) labels.push('max file size')
    return labels.length > 0 ? labels : ['file constraints']
  }
  if (key === 'safeArea') return ['safe zones']
  if (key === 'overlayZones') return ['overlay zones']
  if (key === 'layoutDefaults') return ['default layout mode']
  if (key === 'typographyLimits') return ['text limits']
  if (key === 'ctaLimits') return ['CTA limits']
  return ['other official constraints']
}

function derivedGeometryRules(format: FormatRuleSet, scene: Scene | undefined): string[] {
  const kind = scene?.layoutPolicy?.formatKind ?? classifyFormatGeometry(format)
  const rules = [`${kind} layout derived from format geometry`, 'headline/body height limits derived from canvas geometry']
  if (kind === 'tinySmall') {
    rules.push('compact layout for small formats')
    rules.push('body/headline visibility adjusted by small canvas geometry')
    if (format.height < 180) rules.push('compact CTA due to small height')
  }
  return rules
}

function heuristicLayoutRules(format: FormatRuleSet, scene: Scene | undefined): string[] {
  const kind = scene?.layoutPolicy?.formatKind ?? classifyFormatGeometry(format)
  const rules = [
    'image/text/CTA percentage regions',
    'default layout mode',
    'no-gradient by default',
    'visual balance rules',
  ]
  if (kind === 'tinySmall') {
    rules.push('CTA hide by default for tiny')
    rules.push('body hide for tiny/small')
  }
  if (scene?.layoutPolicy?.appliedRules.includes('manual-review-fallback')) rules.push('fallback layout mode')
  return rules
}

function classifyFormatGeometry(format: FormatRuleSet): string {
  const area = format.width * format.height
  if (format.aspectRatio < 0.55) return 'tallVertical'
  if (format.width < 400 || format.height < 180 || area < 90000) return 'tinySmall'
  if (format.aspectRatio >= 1.6) return 'horizontal'
  if (format.aspectRatio <= 0.75) return 'vertical'
  if (format.aspectRatio >= 0.85 && format.aspectRatio <= 1.2) return 'square'
  return 'landscape'
}

function ruleSourceStatus(input: {
  officialCount: number
  derivedCount: number
  heuristicCount: number
  unknownCount: number
  needsManualReview: boolean
  layoutNotOfficial: boolean
}): ExportRuleSourceStatus {
  if (input.needsManualReview && input.unknownCount > 0) return 'needs_manual_review'
  if (input.officialCount > 0 && !input.layoutNotOfficial && input.derivedCount === 0 && input.heuristicCount === 0 && input.unknownCount === 0) {
    return 'official_match'
  }
  if (input.officialCount > 0) return 'partially_official'
  if (input.derivedCount > 0 && input.heuristicCount === 0 && input.unknownCount === 0) return 'derived_from_geometry'
  if (input.heuristicCount > 0) return input.needsManualReview ? 'needs_manual_review' : 'heuristic_only'
  return input.needsManualReview ? 'needs_manual_review' : 'heuristic_only'
}

function renderExportReportText(report: ExportReport): string {
  const lines = [
    'Export report',
    `Generated at: ${report.generatedAt}`,
    `Formats: ${report.formatCount}`,
    '',
    LAYOUT_SOURCE_EXPLANATION,
    '',
    'Format rule source status:',
  ]

  for (const item of report.formatRuleSources) {
    lines.push(`- ${item.formatName} (${item.formatId}): ${item.status}${item.needsManualReview ? ' / needs manual review' : ''}`)
  }

  return `${lines.join('\n')}\n`
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.filter(Boolean)))
}
