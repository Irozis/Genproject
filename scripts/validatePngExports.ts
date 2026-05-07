import { inflateSync } from 'node:zlib'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { FORMAT_KEYS, getFormat } from '../src/lib/formats'
import { groupOf } from '../src/lib/formatGroups'
import type { FormatKey } from '../src/lib/types'

type TechnicalStatus = 'technicalReady' | 'technicalWarning' | 'technicalFail'

type PngValidationResult = {
  zipFile: string
  fileName: string
  projectId: string | null
  group: string | null
  formatKey: FormatKey | null
  width: number | null
  height: number | null
  fileSize: number
  isReadable: boolean
  expectedWidth: number | null
  expectedHeight: number | null
  dimensionMatch: boolean | null
  averageLuma: number | null
  darkPixelRatio: number | null
  lightPixelRatio: number | null
  approximateContrastNotes: string[]
  autoStatus: TechnicalStatus
  autoNotes: string[]
  previewPath: string | null
}

type DecodedPng = {
  width: number
  height: number
  rgba: Uint8Array
}

const PNG_ZIPS_DIRS = [path.resolve('experiment/exports'), path.resolve('experiment/png-zips')]
const RESULTS_DIR = path.resolve('experiment/results')
const PNG_RESULTS_DIR = path.join(RESULTS_DIR, 'png')
const JSON_PATH = path.join(RESULTS_DIR, 'png-validation-results.json')
const CSV_PATH = path.join(RESULTS_DIR, 'png-validation-results.csv')
const REPORT_PATH = path.join(RESULTS_DIR, 'png-report.html')
const SUMMARY_PATH = path.join(RESULTS_DIR, 'png-summary.md')
const MANUAL_REVIEW_PATH = path.join(RESULTS_DIR, 'manual-png-review-template.csv')

async function main(): Promise<void> {
  for (const dir of PNG_ZIPS_DIRS) await mkdir(dir, { recursive: true })
  await mkdir(RESULTS_DIR, { recursive: true })
  await rm(PNG_RESULTS_DIR, { recursive: true, force: true })
  await mkdir(PNG_RESULTS_DIR, { recursive: true })

  const zipFiles = await findZipFiles(PNG_ZIPS_DIRS)

  const results: PngValidationResult[] = []
  for (const zipFile of zipFiles) {
    results.push(...(await validateZip(zipFile)))
  }

  await writeFile(JSON_PATH, `${JSON.stringify(results, null, 2)}\n`, 'utf8')
  await writeFile(CSV_PATH, toCsv(results), 'utf8')
  await writeFile(MANUAL_REVIEW_PATH, toManualReviewCsv(results), 'utf8')
  await writeFile(SUMMARY_PATH, toMarkdown(results, zipFiles.length), 'utf8')
  await writeFile(REPORT_PATH, toHtmlReport(results, zipFiles.length), 'utf8')

  const readable = results.filter((result) => result.isReadable).length
  const dimensionMatches = results.filter((result) => result.dimensionMatch === true).length
  console.log(`PNG ZIP files: ${zipFiles.length}`)
  console.log(`PNG files: ${results.length}`)
  console.log(`Readable PNG: ${readable}`)
  console.log(`Dimension matches: ${dimensionMatches}`)
  console.log(`PNG report: ${REPORT_PATH}`)
}

async function findZipFiles(dirs: string[]): Promise<Array<{ dir: string; fileName: string }>> {
  const found: Array<{ dir: string; fileName: string }> = []
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true })
    const files = await readdir(dir)
    for (const fileName of files.filter((file) => file.toLowerCase().endsWith('.zip'))) {
      found.push({ dir, fileName })
    }
  }
  return found.sort((a, b) => `${a.dir}/${a.fileName}`.localeCompare(`${b.dir}/${b.fileName}`))
}

async function validateZip(zipFile: { dir: string; fileName: string }): Promise<PngValidationResult[]> {
  const zipPath = path.join(zipFile.dir, zipFile.fileName)
  const zip = await JSZip.loadAsync(await readFile(zipPath))
  const results: PngValidationResult[] = []

  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const bytes = await entry.async('uint8array')
    const fileName = path.posix.basename(entry.name)
    const outputFile = `${safeSegment(stripExtension(zipFile.fileName))}__${safeSegment(entry.name.replaceAll('/', '__'))}`
    const previewPath = `experiment/results/png/${outputFile}`
    await writeFile(path.join(PNG_RESULTS_DIR, outputFile), bytes)
    results.push(validatePng(zipFile.fileName, fileName, bytes, previewPath))
  }

  return results
}

function validatePng(zipFile: string, fileName: string, bytes: Uint8Array, previewPath: string): PngValidationResult {
  const parsedName = parseExportFileName(fileName)
  const rules = parsedName.formatKey ? getKnownFormat(parsedName.formatKey) : null
  const autoNotes: string[] = []
  const approximateContrastNotes: string[] = []

  let decoded: DecodedPng | null = null
  try {
    decoded = decodePng(bytes)
  } catch (error: unknown) {
    autoNotes.push(`PNG decode failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  if (!parsedName.formatKey) autoNotes.push('formatKey could not be inferred from filename')
  if (parsedName.formatKey && !rules) autoNotes.push(`formatKey is not a known built-in format: ${parsedName.formatKey}`)
  if (bytes.byteLength === 0) autoNotes.push('PNG file is empty')

  const dimensionMatch =
    decoded && rules ? decoded.width === rules.width && decoded.height === rules.height : rules ? false : null
  if (decoded && rules && !dimensionMatch) {
    autoNotes.push(`dimension mismatch: ${decoded.width}x${decoded.height}, expected ${rules.width}x${rules.height}`)
  }

  const pixelMetrics = decoded ? measurePixels(decoded.rgba) : null
  if (pixelMetrics) {
    if (pixelMetrics.averageLuma < 0.02) autoNotes.push('suspicious pixel metric: almost fully black image')
    if (pixelMetrics.averageLuma > 0.98) autoNotes.push('suspicious pixel metric: almost fully white image')
    if (pixelMetrics.darkPixelRatio > 0.98) autoNotes.push('suspicious pixel metric: very high dark pixel ratio')
    if (pixelMetrics.lightPixelRatio > 0.98) autoNotes.push('suspicious pixel metric: very high light pixel ratio')
    approximateContrastNotes.push(
      `Average luma ${round(pixelMetrics.averageLuma)}, dark pixels ${round(pixelMetrics.darkPixelRatio)}, light pixels ${round(pixelMetrics.lightPixelRatio)}. This is a whole-image technical signal, not a design contrast verdict.`,
    )
  }

  const autoStatus = resolveStatus({
    isReadable: !!decoded,
    fileSize: bytes.byteLength,
    formatKnown: !!rules,
    dimensionMatch,
    suspiciousMetric: autoNotes.some((note) => note.startsWith('suspicious pixel metric')),
  })

  return {
    zipFile,
    fileName,
    projectId: parsedName.projectId,
    group: parsedName.formatKey ? groupOf(parsedName.formatKey) : null,
    formatKey: parsedName.formatKey,
    width: decoded?.width ?? null,
    height: decoded?.height ?? null,
    fileSize: bytes.byteLength,
    isReadable: !!decoded,
    expectedWidth: rules?.width ?? null,
    expectedHeight: rules?.height ?? null,
    dimensionMatch,
    averageLuma: pixelMetrics ? round(pixelMetrics.averageLuma) : null,
    darkPixelRatio: pixelMetrics ? round(pixelMetrics.darkPixelRatio) : null,
    lightPixelRatio: pixelMetrics ? round(pixelMetrics.lightPixelRatio) : null,
    approximateContrastNotes,
    autoStatus,
    autoNotes,
    previewPath,
  }
}

function parseExportFileName(fileName: string): { projectId: string | null; formatKey: FormatKey | null } {
  const base = stripExtension(fileName)
  const known = [...FORMAT_KEYS].sort((a, b) => b.length - a.length)
  for (const key of known) {
    const suffix = `__${key}`
    if (base.endsWith(suffix)) {
      return {
        projectId: base.slice(0, -suffix.length) || null,
        formatKey: key,
      }
    }
  }
  return { projectId: base || null, formatKey: null }
}

function getKnownFormat(formatKey: FormatKey) {
  try {
    return getFormat(formatKey)
  } catch {
    return null
  }
}

function resolveStatus(input: {
  isReadable: boolean
  fileSize: number
  formatKnown: boolean
  dimensionMatch: boolean | null
  suspiciousMetric: boolean
}): TechnicalStatus {
  if (!input.isReadable || input.fileSize <= 0) return 'technicalFail'
  if (input.dimensionMatch === false) return 'technicalFail'
  if (!input.formatKnown || input.suspiciousMetric) return 'technicalWarning'
  return 'technicalReady'
}

function decodePng(bytes: Uint8Array): DecodedPng {
  assertPngSignature(bytes)
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idatParts: Uint8Array[] = []

  while (offset < bytes.byteLength) {
    const length = readUint32(bytes, offset)
    offset += 4
    const type = ascii(bytes.subarray(offset, offset + 4))
    offset += 4
    const data = bytes.subarray(offset, offset + length)
    offset += length + 4

    if (type === 'IHDR') {
      width = readUint32(data, 0)
      height = readUint32(data, 4)
      bitDepth = data[8] ?? 0
      colorType = data[9] ?? 0
      const compression = data[10] ?? 0
      const filter = data[11] ?? 0
      const interlace = data[12] ?? 0
      if (bitDepth !== 8) throw new Error(`unsupported bit depth ${bitDepth}`)
      if (![0, 2, 4, 6].includes(colorType)) throw new Error(`unsupported color type ${colorType}`)
      if (compression !== 0 || filter !== 0 || interlace !== 0) throw new Error('unsupported PNG compression/filter/interlace settings')
    } else if (type === 'IDAT') {
      idatParts.push(data)
    } else if (type === 'IEND') {
      break
    }
  }

  if (width <= 0 || height <= 0) throw new Error('missing or invalid IHDR')
  const channels = channelsFor(colorType)
  const inflated = inflateSync(Buffer.concat(idatParts.map((part) => Buffer.from(part))))
  const raw = unfilterPng(new Uint8Array(inflated), width, height, channels)
  return { width, height, rgba: toRgba(raw, colorType) }
}

function assertPngSignature(bytes: Uint8Array): void {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  for (let i = 0; i < signature.length; i++) {
    if (bytes[i] !== signature[i]) throw new Error('invalid PNG signature')
  }
}

function unfilterPng(data: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const stride = width * channels
  const out = new Uint8Array(height * stride)
  let source = 0
  for (let y = 0; y < height; y++) {
    const filterType = data[source]
    source += 1
    const rowStart = y * stride
    for (let x = 0; x < stride; x++) {
      const raw = data[source++] ?? 0
      const left = x >= channels ? out[rowStart + x - channels] ?? 0 : 0
      const up = y > 0 ? out[rowStart + x - stride] ?? 0 : 0
      const upLeft = y > 0 && x >= channels ? out[rowStart + x - stride - channels] ?? 0 : 0
      out[rowStart + x] = (raw + filterValue(filterType ?? 0, left, up, upLeft)) & 0xff
    }
  }
  return out
}

function filterValue(filterType: number, left: number, up: number, upLeft: number): number {
  if (filterType === 0) return 0
  if (filterType === 1) return left
  if (filterType === 2) return up
  if (filterType === 3) return Math.floor((left + up) / 2)
  if (filterType === 4) return paeth(left, up, upLeft)
  throw new Error(`unsupported PNG filter type ${filterType}`)
}

function toRgba(raw: Uint8Array, colorType: number): Uint8Array {
  const channels = channelsFor(colorType)
  const pixels = raw.byteLength / channels
  const rgba = new Uint8Array(pixels * 4)
  for (let i = 0, j = 0; i < raw.byteLength; i += channels, j += 4) {
    if (colorType === 0) {
      const g = raw[i] ?? 0
      rgba[j] = g
      rgba[j + 1] = g
      rgba[j + 2] = g
      rgba[j + 3] = 255
    } else if (colorType === 2) {
      rgba[j] = raw[i] ?? 0
      rgba[j + 1] = raw[i + 1] ?? 0
      rgba[j + 2] = raw[i + 2] ?? 0
      rgba[j + 3] = 255
    } else if (colorType === 4) {
      const g = raw[i] ?? 0
      rgba[j] = g
      rgba[j + 1] = g
      rgba[j + 2] = g
      rgba[j + 3] = raw[i + 1] ?? 255
    } else {
      rgba[j] = raw[i] ?? 0
      rgba[j + 1] = raw[i + 1] ?? 0
      rgba[j + 2] = raw[i + 2] ?? 0
      rgba[j + 3] = raw[i + 3] ?? 255
    }
  }
  return rgba
}

function measurePixels(rgba: Uint8Array): { averageLuma: number; darkPixelRatio: number; lightPixelRatio: number } {
  let lumaSum = 0
  let dark = 0
  let light = 0
  const pixels = rgba.byteLength / 4
  for (let i = 0; i < rgba.byteLength; i += 4) {
    const alpha = (rgba[i + 3] ?? 255) / 255
    const r = ((rgba[i] ?? 0) * alpha + 255 * (1 - alpha)) / 255
    const g = ((rgba[i + 1] ?? 0) * alpha + 255 * (1 - alpha)) / 255
    const b = ((rgba[i + 2] ?? 0) * alpha + 255 * (1 - alpha)) / 255
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    lumaSum += luma
    if (luma < 0.18) dark += 1
    if (luma > 0.82) light += 1
  }
  return {
    averageLuma: pixels > 0 ? lumaSum / pixels : 0,
    darkPixelRatio: pixels > 0 ? dark / pixels : 0,
    lightPixelRatio: pixels > 0 ? light / pixels : 0,
  }
}

function channelsFor(colorType: number): number {
  if (colorType === 0) return 1
  if (colorType === 2) return 3
  if (colorType === 4) return 2
  if (colorType === 6) return 4
  throw new Error(`unsupported color type ${colorType}`)
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft
  const pa = Math.abs(p - left)
  const pb = Math.abs(p - up)
  const pc = Math.abs(p - upLeft)
  if (pa <= pb && pa <= pc) return left
  if (pb <= pc) return up
  return upLeft
}

function toCsv(results: PngValidationResult[]): string {
  const headers: Array<keyof PngValidationResult> = [
    'zipFile',
    'fileName',
    'projectId',
    'group',
    'formatKey',
    'width',
    'height',
    'fileSize',
    'isReadable',
    'expectedWidth',
    'expectedHeight',
    'dimensionMatch',
    'averageLuma',
    'darkPixelRatio',
    'lightPixelRatio',
    'approximateContrastNotes',
    'autoStatus',
    'autoNotes',
    'previewPath',
  ]
  return `${headers.join(',')}\n${results.map((result) => headers.map((header) => csvCell(csvValue(result[header]))).join(',')).join('\n')}\n`
}

function toManualReviewCsv(results: PngValidationResult[]): string {
  const headers = [
    'fileName',
    'projectId',
    'formatKey',
    'width',
    'height',
    'dimensionMatch',
    'autoNotes',
    'humanStatus',
    'validatorCorrect',
    'notes',
    'previewPath',
  ]
  const rows = results.map((result) =>
    [
      result.fileName,
      result.projectId ?? '',
      result.formatKey ?? '',
      String(result.width ?? ''),
      String(result.height ?? ''),
      String(result.dimensionMatch ?? ''),
      result.autoNotes.join(' | '),
      '',
      '',
      '',
      result.previewPath ?? '',
    ]
      .map(csvCell)
      .join(','),
  )
  return `${headers.join(',')}\n${rows.join('\n')}\n`
}

function toMarkdown(results: PngValidationResult[], zipCount: number): string {
  const readable = results.filter((result) => result.isReadable).length
  const dimensionMatches = results.filter((result) => result.dimensionMatch === true).length
  const ready = results.filter((result) => result.autoStatus === 'technicalReady').length
  const warning = results.filter((result) => result.autoStatus === 'technicalWarning').length
  const fail = results.filter((result) => result.autoStatus === 'technicalFail').length
  return `# PNG Export Validation Summary

| Metric | Value |
| --- | ---: |
| ZIP files | ${zipCount} |
| PNG files | ${results.length} |
| Readable PNG | ${readable} |
| Dimension matches | ${dimensionMatches} |
| technicalReady | ${ready} |
| technicalWarning | ${warning} |
| technicalFail | ${fail} |

Visual report: experiment/results/png-report.html

Note: this validator checks technical export properties only. Final ready/minor/fail design quality is reserved for manual expert review.
`
}

function toHtmlReport(results: PngValidationResult[], zipCount: number): string {
  const readable = results.filter((result) => result.isReadable).length
  const dimensionMatches = results.filter((result) => result.dimensionMatch === true).length
  const cards = results.length > 0 ? results.map(renderCard).join('\n') : '<p class="empty">No PNG files found in experiment/exports/*.zip or experiment/png-zips/*.zip.</p>'
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PNG Export Validation Report</title>
  <style>
    :root { --ok:#15803d; --ok-bg:#dcfce7; --warn:#a16207; --warn-bg:#fef3c7; --fail:#b91c1c; --fail-bg:#fee2e2; --ink:#111827; --muted:#6b7280; --line:#e5e7eb; --page:#f8fafc; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--page); color:var(--ink); font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    header { padding:28px 32px 18px; background:linear-gradient(135deg,#0f172a,#334155); color:white; }
    h1 { margin:0 0 14px; }
    .metrics { display:flex; flex-wrap:wrap; gap:10px; }
    .metric { border:1px solid rgba(255,255,255,.2); border-radius:12px; padding:10px 12px; background:rgba(255,255,255,.1); }
    .metric b { display:block; font-size:20px; }
    main { padding:24px 32px 32px; }
    .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(360px,1fr)); gap:18px; }
    .card { background:white; border:1px solid var(--line); border-radius:18px; overflow:hidden; box-shadow:0 16px 40px rgba(15,23,42,.08); }
    .card.technicalReady { border-color:#bbf7d0; } .card.technicalWarning { border-color:#fde68a; } .card.technicalFail { border-color:#fecaca; }
    .head { display:flex; justify-content:space-between; gap:12px; padding:14px 16px; border-bottom:1px solid var(--line); }
    .head strong { display:block; overflow-wrap:anywhere; } .head small { color:var(--muted); }
    .status { align-self:start; border-radius:999px; padding:5px 10px; font-size:12px; font-weight:800; }
    .technicalReady .status { background:var(--ok-bg); color:var(--ok); } .technicalWarning .status { background:var(--warn-bg); color:var(--warn); } .technicalFail .status { background:var(--fail-bg); color:var(--fail); }
    .preview { display:grid; place-items:center; min-height:260px; padding:16px; background:#f1f5f9; }
    .preview img { max-width:100%; max-height:340px; border-radius:10px; background:white; box-shadow:0 8px 20px rgba(15,23,42,.12); }
    .meta { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:14px 16px; border-bottom:1px solid var(--line); color:var(--muted); font-size:13px; }
    .notes { padding:14px 16px 18px; }
    ul { margin:8px 0 0; padding-left:18px; } li { margin:5px 0; }
    .manual { border:1px dashed var(--line); border-radius:12px; padding:10px; color:var(--muted); background:#fff; }
    code { background:#f3f4f6; border-radius:6px; padding:1px 5px; }
    .empty { color:var(--muted); }
  </style>
</head>
<body>
  <header>
    <h1>PNG Export Validation Report</h1>
    <div class="metrics">
      <div class="metric"><span>ZIP files</span><b>${zipCount}</b></div>
      <div class="metric"><span>PNG files</span><b>${results.length}</b></div>
      <div class="metric"><span>Readable</span><b>${readable}</b></div>
      <div class="metric"><span>Dimension matches</span><b>${dimensionMatches}</b></div>
    </div>
  </header>
  <main><div class="grid">${cards}</div></main>
</body>
</html>`
}

function renderCard(result: PngValidationResult): string {
  const previewSrc = result.previewPath ? `./png/${encodeHtmlAttribute(path.basename(result.previewPath))}` : ''
  const expected = result.expectedWidth && result.expectedHeight ? `${result.expectedWidth}x${result.expectedHeight}` : 'unknown'
  const actual = result.width && result.height ? `${result.width}x${result.height}` : 'unreadable'
  const notes = [...result.autoNotes, ...result.approximateContrastNotes]
  return `<article class="card ${result.autoStatus}">
  <div class="head"><div><strong>${escapeHtml(result.fileName)}</strong><small>${escapeHtml(result.projectId ?? 'unknown project')} / <code>${escapeHtml(result.formatKey ?? 'unknown format')}</code></small></div><span class="status">${result.autoStatus}</span></div>
  <div class="preview">${previewSrc ? `<img src="${previewSrc}" alt="${escapeHtml(result.fileName)} preview" />` : '<span>No preview</span>'}</div>
  <div class="meta"><div>size: <strong>${actual}</strong></div><div>expected: <strong>${expected}</strong></div><div>dimensionMatch: <strong>${String(result.dimensionMatch)}</strong></div><div>fileSize: <strong>${result.fileSize}</strong></div><div>avg luma: <strong>${String(result.averageLuma ?? '')}</strong></div><div>dark/light: <strong>${String(result.darkPixelRatio ?? '')}/${String(result.lightPixelRatio ?? '')}</strong></div></div>
  <div class="notes"><strong>autoNotes</strong>${notes.length > 0 ? `<ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : '<p class="empty">No automatic notes.</p>'}<div class="manual"><strong>Manual review:</strong> fill humanStatus, validatorCorrect, notes in manual-png-review-template.csv.</div></div>
</article>`
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)
}

function ascii(bytes: Uint8Array): string {
  return String.fromCharCode(...bytes)
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

function safeSegment(value: string): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim()
  return cleaned.length > 0 ? cleaned : 'item'
}

function csvValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(' | ')
  return String(value ?? '')
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

function encodeHtmlAttribute(value: string): string {
  return encodeURI(value).replaceAll('"', '%22')
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`PNG export validation failed: ${message}`)
  process.exitCode = 1
})
