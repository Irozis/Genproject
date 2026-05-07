// Deterministic background extension for simple product photos with uniform
// backgrounds. This is not AI outpainting: it only uses edge-color statistics
// and a rough subject bbox heuristic, and it deliberately refuses complex
// backgrounds.

export type Rgb = { r: number; g: number; b: number }
export type Bounds = { x: number; y: number; w: number; h: number }
export type PixelSource = { width: number; height: number; data: Uint8ClampedArray }

export type EdgeBackgroundAnalysis = {
  averageColor: Rgb
  variance: number
  standardDeviation: number
  uniformity: number
  sampleCount: number
}

export type BackgroundExtensionMode = 'auto' | 'solid' | 'edge-stretch'

export type BackgroundExtensionOptions = {
  paddingPercent?: number
  mode?: BackgroundExtensionMode
  maxExpansionPercent?: number
  backgroundUniformityThreshold?: number
  targetAspectRatio?: number
  targetWidth?: number
  targetHeight?: number
}

export type BackgroundExtensionReason =
  | 'extended'
  | 'background-not-uniform'
  | 'no-subject-detected'
  | 'no-extension-needed'
  | 'canvas-unavailable'
  | 'load-failed'

export type BackgroundExtensionResult = {
  imageSrc: string
  changed: boolean
  reason: BackgroundExtensionReason
  originalSize: { width: number; height: number }
  extendedSize: { width: number; height: number }
  subjectBounds?: Bounds
  backgroundUniformity: number
}

export const DEFAULT_BACKGROUND_EXTENSION_OPTIONS = {
  paddingPercent: 0.14,
  mode: 'auto' as BackgroundExtensionMode,
  maxExpansionPercent: 0.45,
  backgroundUniformityThreshold: 0.78,
}

export function analyzeEdgeBackground(source: PixelSource, edgePercent = 0.06): EdgeBackgroundAnalysis {
  const edge = Math.max(1, Math.round(Math.min(source.width, source.height) * edgePercent))
  const samples: Rgb[] = []
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const onEdge = x < edge || y < edge || x >= source.width - edge || y >= source.height - edge
      if (!onEdge) continue
      const c = pixelAt(source, x, y)
      if (c) samples.push(c)
    }
  }
  return summarizeColors(samples)
}

export function canExtendBackground(
  analysis: EdgeBackgroundAnalysis,
  threshold = DEFAULT_BACKGROUND_EXTENSION_OPTIONS.backgroundUniformityThreshold,
): boolean {
  return analysis.uniformity >= threshold
}

export function estimateSubjectBounds(
  source: PixelSource,
  backgroundColor: Rgb,
  options: { colorDistanceThreshold?: number; minAlpha?: number } = {},
): Bounds | undefined {
  const threshold = options.colorDistanceThreshold ?? 34
  const minAlpha = options.minAlpha ?? 16
  let minX = source.width
  let minY = source.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const i = (y * source.width + x) * 4
      const a = source.data[i + 3] ?? 255
      if (a < minAlpha) continue
      const r = source.data[i] ?? 0
      const g = source.data[i + 1] ?? 0
      const b = source.data[i + 2] ?? 0
      if (colorDistance({ r, g, b }, backgroundColor) < threshold) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < minX || maxY < minY) return undefined
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export function needsBackgroundExtension(
  source: { width: number; height: number },
  subjectBounds: Bounds,
  options: BackgroundExtensionOptions = {},
): boolean {
  const padding = options.paddingPercent ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.paddingPercent
  const targetAspect = resolveTargetAspect(source.width, source.height, options)
  const aspectDelta = Math.abs(source.width / source.height - targetAspect)
  const minHorizontalMargin = Math.min(subjectBounds.x, source.width - subjectBounds.x - subjectBounds.w) / source.width
  const minVerticalMargin = Math.min(subjectBounds.y, source.height - subjectBounds.y - subjectBounds.h) / source.height
  return minHorizontalMargin < padding || minVerticalMargin < padding || aspectDelta > 0.04
}

export async function extendImageBackground(
  imageSrc: string,
  options: BackgroundExtensionOptions = {},
): Promise<BackgroundExtensionResult> {
  if (typeof document === 'undefined') {
    return emptyResult(imageSrc, 'canvas-unavailable')
  }
  try {
    const img = await loadImage(imageSrc)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return emptyResult(imageSrc, 'canvas-unavailable', img.naturalWidth, img.naturalHeight)
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return extendImageDataToDataUrl(imageSrc, imageData, options)
  } catch {
    return emptyResult(imageSrc, 'load-failed')
  }
}

export function extendImageDataToDataUrl(
  originalSrc: string,
  imageData: ImageData,
  options: BackgroundExtensionOptions = {},
): BackgroundExtensionResult {
  if (typeof document === 'undefined') {
    return emptyResult(originalSrc, 'canvas-unavailable', imageData.width, imageData.height)
  }
  const source = { width: imageData.width, height: imageData.height, data: imageData.data }
  const analysis = analyzeEdgeBackground(source)
  const threshold = options.backgroundUniformityThreshold ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.backgroundUniformityThreshold
  if (!canExtendBackground(analysis, threshold)) {
    return unchanged(originalSrc, 'background-not-uniform', source, analysis.uniformity)
  }
  const subjectBounds = estimateSubjectBounds(source, analysis.averageColor, {
    colorDistanceThreshold: Math.max(28, analysis.standardDeviation * 2.2),
  })
  if (!subjectBounds) return unchanged(originalSrc, 'no-subject-detected', source, analysis.uniformity)
  if (!needsBackgroundExtension(source, subjectBounds, options)) {
    return unchanged(originalSrc, 'no-extension-needed', source, analysis.uniformity, subjectBounds)
  }

  const size = computeExtendedSize(source.width, source.height, subjectBounds, options)
  if (size.width === source.width && size.height === source.height) {
    return unchanged(originalSrc, 'no-extension-needed', source, analysis.uniformity, subjectBounds)
  }

  const out = document.createElement('canvas')
  out.width = size.width
  out.height = size.height
  const ctx = out.getContext('2d')
  if (!ctx) return unchanged(originalSrc, 'canvas-unavailable', source, analysis.uniformity, subjectBounds)
  ctx.fillStyle = rgbCss(analysis.averageColor)
  ctx.fillRect(0, 0, out.width, out.height)
  const original = document.createElement('canvas')
  original.width = source.width
  original.height = source.height
  original.getContext('2d')?.putImageData(imageData, 0, 0)
  const dx = Math.round((out.width - source.width) / 2)
  const dy = Math.round((out.height - source.height) / 2)
  ctx.drawImage(original, dx, dy)

  return {
    imageSrc: out.toDataURL('image/png'),
    changed: true,
    reason: 'extended',
    originalSize: { width: source.width, height: source.height },
    extendedSize: { width: out.width, height: out.height },
    subjectBounds,
    backgroundUniformity: analysis.uniformity,
  }
}

function computeExtendedSize(
  width: number,
  height: number,
  subject: Bounds,
  options: BackgroundExtensionOptions,
): { width: number; height: number } {
  const padding = options.paddingPercent ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.paddingPercent
  const maxExpansion = options.maxExpansionPercent ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.maxExpansionPercent
  const targetAspect = resolveTargetAspect(width, height, options)
  const maxW = Math.round(width * (1 + maxExpansion))
  const maxH = Math.round(height * (1 + maxExpansion))
  let nextW = width
  let nextH = height

  if (targetAspect > width / height) nextW = Math.max(nextW, Math.ceil(height * targetAspect))
  if (targetAspect < width / height) nextH = Math.max(nextH, Math.ceil(width / targetAspect))

  const neededW = Math.ceil(subject.w / Math.max(0.1, 1 - padding * 2))
  const neededH = Math.ceil(subject.h / Math.max(0.1, 1 - padding * 2))
  nextW = Math.max(nextW, neededW)
  nextH = Math.max(nextH, neededH)

  if (nextW / nextH < targetAspect) nextW = Math.ceil(nextH * targetAspect)
  if (nextW / nextH > targetAspect) nextH = Math.ceil(nextW / targetAspect)

  return {
    width: Math.max(width, Math.min(maxW, nextW)),
    height: Math.max(height, Math.min(maxH, nextH)),
  }
}

function resolveTargetAspect(width: number, height: number, options: BackgroundExtensionOptions): number {
  if (options.targetAspectRatio && Number.isFinite(options.targetAspectRatio)) return options.targetAspectRatio
  if (options.targetWidth && options.targetHeight) return options.targetWidth / options.targetHeight
  return width / height
}

function summarizeColors(samples: Rgb[]): EdgeBackgroundAnalysis {
  if (samples.length === 0) {
    return { averageColor: { r: 255, g: 255, b: 255 }, variance: 0, standardDeviation: 0, uniformity: 1, sampleCount: 0 }
  }
  const averageColor = samples.reduce(
    (acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b }),
    { r: 0, g: 0, b: 0 },
  )
  averageColor.r /= samples.length
  averageColor.g /= samples.length
  averageColor.b /= samples.length
  const variance = samples.reduce((sum, c) => sum + colorDistance(c, averageColor) ** 2, 0) / samples.length
  const standardDeviation = Math.sqrt(variance)
  const uniformity = Math.max(0, Math.min(1, 1 - standardDeviation / 128))
  return { averageColor, variance, standardDeviation, uniformity, sampleCount: samples.length }
}

function pixelAt(source: PixelSource, x: number, y: number): Rgb | null {
  const i = (y * source.width + x) * 4
  const a = source.data[i + 3] ?? 255
  if (a < 16) return null
  return { r: source.data[i] ?? 0, g: source.data[i + 1] ?? 0, b: source.data[i + 2] ?? 0 }
}

function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

function rgbCss(c: Rgb): string {
  return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = src
  })
}

function unchanged(
  imageSrc: string,
  reason: BackgroundExtensionReason,
  source: { width: number; height: number },
  backgroundUniformity: number,
  subjectBounds?: Bounds,
): BackgroundExtensionResult {
  return {
    imageSrc,
    changed: false,
    reason,
    originalSize: { width: source.width, height: source.height },
    extendedSize: { width: source.width, height: source.height },
    subjectBounds,
    backgroundUniformity,
  }
}

function emptyResult(
  imageSrc: string,
  reason: BackgroundExtensionReason,
  width = 0,
  height = 0,
): BackgroundExtensionResult {
  return {
    imageSrc,
    changed: false,
    reason,
    originalSize: { width, height },
    extendedSize: { width, height },
    backgroundUniformity: 0,
  }
}
