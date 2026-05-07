import { chromium } from '@playwright/test'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

type Row = {
  fileName: string
  changed: boolean
  reason: string
  originalSize: string
  extendedSize: string
  backgroundUniformity: number
  subjectBounds: string
  outputPath: string
}

const root = process.cwd()
const inputDir = path.join(root, 'experiment', 'assets', 'background-extension')
const outputDir = path.join(root, 'experiment', 'results', 'background-extension')

await mkdir(inputDir, { recursive: true })
await mkdir(outputDir, { recursive: true })

const files = (await readdir(inputDir)).filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
const rows: Row[] = []

if (files.length > 0) {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent('<!doctype html><html><body></body></html>')
    for (const fileName of files) {
      const inputPath = path.join(inputDir, fileName)
      const bytes = await readFile(inputPath)
      const mime = mimeFor(fileName)
      const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`
      const result = await page.evaluate(browserExtend, dataUrl)
      const safeName = fileName.replace(/\.[^.]+$/, '')
      const outputName = `${safeName}${result.changed ? '-extended' : '-original'}.png`
      const outputPath = path.join(outputDir, outputName)
      await writeFile(outputPath, Buffer.from(result.imageSrc.split(',')[1] ?? '', 'base64'))
      rows.push({
        fileName,
        changed: result.changed,
        reason: result.reason,
        originalSize: `${result.originalSize.width}x${result.originalSize.height}`,
        extendedSize: `${result.extendedSize.width}x${result.extendedSize.height}`,
        backgroundUniformity: result.backgroundUniformity,
        subjectBounds: result.subjectBounds
          ? `${result.subjectBounds.x},${result.subjectBounds.y},${result.subjectBounds.w},${result.subjectBounds.h}`
          : '',
        outputPath,
      })
    }
  } finally {
    await browser.close()
  }
}

const summary = [
  '# Background Extension Summary',
  '',
  'Deterministic background extension for uniform backgrounds. This is a limited engineering MVP, not AI outpainting.',
  '',
  `Input files: ${files.length}`,
  `Changed: ${rows.filter((row) => row.changed).length}`,
  '',
  '| fileName | changed | reason | original size | extended size | backgroundUniformity | subjectBounds | output |',
  '|---|---:|---|---:|---:|---:|---|---|',
  ...rows.map((row) =>
    `| ${row.fileName} | ${row.changed} | ${row.reason} | ${row.originalSize} | ${row.extendedSize} | ${row.backgroundUniformity.toFixed(4)} | ${row.subjectBounds} | ${row.outputPath} |`,
  ),
  '',
].join('\n')

await writeFile(path.join(outputDir, 'summary.md'), summary, 'utf8')

console.log(`Background extension input files: ${files.length}`)
console.log(`Changed: ${rows.filter((row) => row.changed).length}`)
console.log(`Summary: ${path.join(outputDir, 'summary.md')}`)

function mimeFor(fileName: string): string {
  if (/\.jpe?g$/i.test(fileName)) return 'image/jpeg'
  if (/\.webp$/i.test(fileName)) return 'image/webp'
  return 'image/png'
}

function browserExtend(imageSrc: string) {
  const paddingPercent = 0.14
  const maxExpansionPercent = 0.45
  const uniformityThreshold = 0.78

  return new Promise<{
    imageSrc: string
    changed: boolean
    reason: string
    originalSize: { width: number; height: number }
    extendedSize: { width: number; height: number }
    subjectBounds?: { x: number; y: number; w: number; h: number }
    backgroundUniformity: number
  }>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        resolve(base('canvas-unavailable', imageSrc, img.naturalWidth, img.naturalHeight, 0))
        return
      }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const edge = Math.max(1, Math.round(Math.min(canvas.width, canvas.height) * 0.06))
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (!(x < edge || y < edge || x >= canvas.width - edge || y >= canvas.height - edge)) continue
          const i = (y * canvas.width + x) * 4
          r += data[i] ?? 0
          g += data[i + 1] ?? 0
          b += data[i + 2] ?? 0
          count += 1
        }
      }
      const bg = { r: r / count, g: g / count, b: b / count }
      let variance = 0
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (!(x < edge || y < edge || x >= canvas.width - edge || y >= canvas.height - edge)) continue
          const i = (y * canvas.width + x) * 4
          const dr = (data[i] ?? 0) - bg.r
          const dg = (data[i + 1] ?? 0) - bg.g
          const db = (data[i + 2] ?? 0) - bg.b
          variance += dr * dr + dg * dg + db * db
        }
      }
      const stdev = Math.sqrt(variance / Math.max(1, count))
      const uniformity = Math.max(0, Math.min(1, 1 - stdev / 128))
      if (uniformity < uniformityThreshold) {
        resolve(base('background-not-uniform', imageSrc, canvas.width, canvas.height, uniformity))
        return
      }
      let minX = canvas.width
      let minY = canvas.height
      let maxX = -1
      let maxY = -1
      const threshold = Math.max(28, stdev * 2.2)
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const i = (y * canvas.width + x) * 4
          const dr = (data[i] ?? 0) - bg.r
          const dg = (data[i + 1] ?? 0) - bg.g
          const db = (data[i + 2] ?? 0) - bg.b
          if (Math.sqrt(dr * dr + dg * dg + db * db) < threshold) continue
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
      if (maxX < minX || maxY < minY) {
        resolve(base('no-subject-detected', imageSrc, canvas.width, canvas.height, uniformity))
        return
      }
      const subjectBounds = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
      const marginX = Math.min(subjectBounds.x, canvas.width - subjectBounds.x - subjectBounds.w) / canvas.width
      const marginY = Math.min(subjectBounds.y, canvas.height - subjectBounds.y - subjectBounds.h) / canvas.height
      if (marginX >= paddingPercent && marginY >= paddingPercent) {
        resolve({ ...base('no-extension-needed', imageSrc, canvas.width, canvas.height, uniformity), subjectBounds })
        return
      }
      const maxW = Math.round(canvas.width * (1 + maxExpansionPercent))
      const maxH = Math.round(canvas.height * (1 + maxExpansionPercent))
      const nextW = Math.min(maxW, Math.max(canvas.width, Math.ceil(subjectBounds.w / (1 - paddingPercent * 2))))
      const nextH = Math.min(maxH, Math.max(canvas.height, Math.ceil(subjectBounds.h / (1 - paddingPercent * 2))))
      const out = document.createElement('canvas')
      out.width = nextW
      out.height = nextH
      const outCtx = out.getContext('2d')!
      outCtx.fillStyle = `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`
      outCtx.fillRect(0, 0, out.width, out.height)
      outCtx.drawImage(canvas, Math.round((nextW - canvas.width) / 2), Math.round((nextH - canvas.height) / 2))
      resolve({
        imageSrc: out.toDataURL('image/png'),
        changed: true,
        reason: 'extended',
        originalSize: { width: canvas.width, height: canvas.height },
        extendedSize: { width: nextW, height: nextH },
        subjectBounds,
        backgroundUniformity: uniformity,
      })
    }
    img.onerror = () => resolve(base('load-failed', imageSrc, 0, 0, 0))
    img.src = imageSrc
  })

  function base(reason: string, src: string, width: number, height: number, uniformity: number) {
    return {
      imageSrc: src,
      changed: false,
      reason,
      originalSize: { width, height },
      extendedSize: { width, height },
      backgroundUniformity: uniformity,
    }
  }
}
