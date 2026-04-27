// Export pipeline. Boundary code: side effects allowed here.
// SVG → canvas (no html-to-image needed), then bundled into ZIP / PDF.
// pdf-lib is dynamically imported to keep it out of the main bundle.

import JSZip from 'jszip'
import { getFormat } from './formats'
import type { FormatKey, FormatRuleSet } from './types'

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
): Promise<void> {
  const zip = new JSZip()
  const safe = projectName.replace(/[^a-z0-9_-]/gi, '_') || 'project'

  for (const k of formatKeys) {
    const svg = svgNodes[k]
    if (!svg) continue
    const { width, height } = getFormat(k, customFormats)
    // sequential to avoid GPU contention
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await svgToPngDataUrl(svg, width, height)
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    zip.file(`${safe}__${k}.png`, base64, { base64: true })
  }

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
