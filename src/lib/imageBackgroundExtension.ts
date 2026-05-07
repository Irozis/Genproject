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
  maxWidthExpansionPercent?: number
  maxHeightExpansionPercent?: number
  minSubjectWidthCoverage?: number
  minSubjectHeightCoverage?: number
  backgroundUniformityThreshold?: number
  targetAspectRatio?: number
  targetWidth?: number
  targetHeight?: number
  targetFormatKey?: string
}

export type BackgroundExtensionReason =
  | 'extended'
  | 'background-not-uniform'
  | 'object-not-detected'
  | 'extension-would-over-shrink-subject'
  | 'extension-exceeds-max-expansion'
  | 'extension-would-distort-image'
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
  objectBounds?: Bounds
  subjectBounds?: Bounds
  targetAspectRatio?: number
  targetAspectRatioRaw?: number
  targetAspectRatioUsed?: number
  targetFormatKey?: string
  subjectCoverageBefore?: { width: number; height: number }
  subjectCoverageAfter?: { width: number; height: number }
  maxExpansionApplied?: boolean
  originalAspectRatio?: number
  drawnAspectRatio?: number
  aspectRatioPreserved?: boolean
  drawScaleX?: number
  drawScaleY?: number
  drawOffsetX?: number
  drawOffsetY?: number
  backgroundUniformity: number
}

export const DEFAULT_BACKGROUND_EXTENSION_OPTIONS = {
  paddingPercent: 0.14,
  mode: 'auto' as BackgroundExtensionMode,
  maxExpansionPercent: 0.5,
  maxWidthExpansionPercent: 0.5,
  maxHeightExpansionPercent: 0.5,
  minSubjectWidthCoverage: 0.25,
  minSubjectHeightCoverage: 0.45,
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

export const estimateObjectBounds = estimateSubjectBounds

export type FitAwareCanvas = {
  width: number
  height: number
  offsetX: number
  offsetY: number
  changed: boolean
  maxExpansionApplied: boolean
  exceededMaxExpansion: boolean
  subjectCoverageBefore: { width: number; height: number }
  subjectCoverageAfter: { width: number; height: number }
  targetAspectRatioRaw: number
  targetAspectRatioUsed: number
  originalAspectRatio: number
  drawnAspectRatio: number
  aspectRatioPreserved: boolean
  drawScaleX: number
  drawScaleY: number
  drawOffsetX: number
  drawOffsetY: number
}

export function calculateFitAwareCanvas(
  imageSize: { width: number; height: number },
  objectBounds: Bounds,
  targetAspectRatio: number,
  paddingRatio = 0.08,
  maxExpansionPercent = DEFAULT_BACKGROUND_EXTENSION_OPTIONS.maxExpansionPercent,
  maxWidthExpansionPercent = maxExpansionPercent,
  maxHeightExpansionPercent = maxExpansionPercent,
): FitAwareCanvas {
  const safePadding = Math.max(0, Math.min(0.45, paddingRatio))
  const targetAspectRatioRaw = Number.isFinite(targetAspectRatio) && targetAspectRatio > 0
    ? targetAspectRatio
    : imageSize.width / imageSize.height
  const targetAspectRatioUsed = clamp(targetAspectRatioRaw, 0.75, 1.8)
  const aspect = targetAspectRatioUsed
  const safeObjW = objectBounds.w / Math.max(0.1, 1 - 2 * safePadding)
  const safeObjH = objectBounds.h / Math.max(0.1, 1 - 2 * safePadding)
  const objectCenterX = objectBounds.x + objectBounds.w / 2
  const objectCenterY = objectBounds.y + objectBounds.h / 2
  const centeredW = 2 * Math.max(objectCenterX, imageSize.width - objectCenterX)
  const centeredH = 2 * Math.max(objectCenterY, imageSize.height - objectCenterY)
  let canvasW = Math.max(imageSize.width, Math.ceil(safeObjW), Math.ceil(safeObjH * aspect))
  let canvasH = Math.max(imageSize.height, Math.ceil(canvasW / aspect), Math.ceil(safeObjH))
  canvasW = Math.max(canvasW, Math.ceil(centeredW))
  canvasH = Math.max(canvasH, Math.ceil(centeredH))
  canvasW = Math.max(canvasW, Math.ceil(canvasH * aspect))

  const requestedW = canvasW
  const requestedH = canvasH
  const maxW = Math.round(imageSize.width * (1 + maxWidthExpansionPercent))
  const maxH = Math.round(imageSize.height * (1 + maxHeightExpansionPercent))
  canvasW = Math.min(maxW, requestedW)
  canvasH = Math.min(maxH, requestedH)
  const maxExpansionApplied = canvasW < requestedW || canvasH < requestedH
  const exceededMaxExpansion = requestedW > maxW || requestedH > maxH

  const idealOffsetX = canvasW / 2 - objectCenterX
  const idealOffsetY = canvasH / 2 - objectCenterY
  const offsetX = Math.round(clamp(idealOffsetX, 0, canvasW - imageSize.width))
  const offsetY = Math.round(clamp(idealOffsetY, 0, canvasH - imageSize.height))
  const drawScaleX = 1
  const drawScaleY = 1
  const originalAspectRatio = imageSize.width / imageSize.height
  const drawnAspectRatio = (imageSize.width * drawScaleX) / (imageSize.height * drawScaleY)
  const aspectRatioPreserved = nearlyEqual(originalAspectRatio, drawnAspectRatio) && nearlyEqual(drawScaleX, drawScaleY)
  const changed = canvasW > imageSize.width || canvasH > imageSize.height || offsetX !== 0 || offsetY !== 0
  return {
    width: canvasW,
    height: canvasH,
    offsetX,
    offsetY,
    changed,
    maxExpansionApplied,
    exceededMaxExpansion,
    subjectCoverageBefore: coverage(objectBounds, imageSize.width, imageSize.height),
    subjectCoverageAfter: coverage(objectBounds, canvasW, canvasH),
    targetAspectRatioRaw,
    targetAspectRatioUsed,
    originalAspectRatio,
    drawnAspectRatio,
    aspectRatioPreserved,
    drawScaleX,
    drawScaleY,
    drawOffsetX: offsetX,
    drawOffsetY: offsetY,
  }
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
    return emptyResult(imageSrc, 'canvas-unavailable', 0, 0, options.targetFormatKey)
  }
  try {
    const img = await loadImage(imageSrc)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return emptyResult(imageSrc, 'canvas-unavailable', img.naturalWidth, img.naturalHeight, options.targetFormatKey)
    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    return extendImageDataToDataUrl(imageSrc, imageData, options)
  } catch {
    return emptyResult(imageSrc, 'load-failed', 0, 0, options.targetFormatKey)
  }
}

export async function extendImageBackgroundForFormat(input: {
  imageSrc: string
  targetWidth: number
  targetHeight: number
  targetFormatKey: string
  paddingRatio?: number
  maxExpansionPercent?: number
  maxWidthExpansionPercent?: number
  maxHeightExpansionPercent?: number
  minSubjectWidthCoverage?: number
  minSubjectHeightCoverage?: number
  backgroundUniformityThreshold?: number
}): Promise<BackgroundExtensionResult> {
  return extendImageBackground(input.imageSrc, {
    targetWidth: input.targetWidth,
    targetHeight: input.targetHeight,
    targetFormatKey: input.targetFormatKey,
    paddingPercent: input.paddingRatio,
    maxExpansionPercent: input.maxExpansionPercent,
    maxWidthExpansionPercent: input.maxWidthExpansionPercent,
    maxHeightExpansionPercent: input.maxHeightExpansionPercent,
    minSubjectWidthCoverage: input.minSubjectWidthCoverage,
    minSubjectHeightCoverage: input.minSubjectHeightCoverage,
    backgroundUniformityThreshold: input.backgroundUniformityThreshold,
  })
}

export function extendImageDataToDataUrl(
  originalSrc: string,
  imageData: ImageData,
  options: BackgroundExtensionOptions = {},
): BackgroundExtensionResult {
  if (typeof document === 'undefined') {
    return emptyResult(originalSrc, 'canvas-unavailable', imageData.width, imageData.height, options.targetFormatKey)
  }
  const source = { width: imageData.width, height: imageData.height, data: imageData.data }
  const analysis = analyzeEdgeBackground(source)
  const threshold = options.backgroundUniformityThreshold ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.backgroundUniformityThreshold
  const targetAspectRatio = resolveTargetAspect(source.width, source.height, options)
  if (!canExtendBackground(analysis, threshold)) {
    return unchanged(originalSrc, 'background-not-uniform', source, analysis.uniformity, undefined, targetAspectRatio, undefined, options.targetFormatKey)
  }
  const subjectBounds = estimateSubjectBounds(source, analysis.averageColor, {
    colorDistanceThreshold: Math.max(28, analysis.standardDeviation * 2.2),
  })
  if (!subjectBounds) return unchanged(originalSrc, 'object-not-detected', source, analysis.uniformity, undefined, targetAspectRatio, undefined, options.targetFormatKey)
  if (!needsBackgroundExtension(source, subjectBounds, options)) {
    return unchanged(originalSrc, 'no-extension-needed', source, analysis.uniformity, subjectBounds, targetAspectRatio, undefined, options.targetFormatKey)
  }

  const size = calculateFitAwareCanvas(
    { width: source.width, height: source.height },
    subjectBounds,
    targetAspectRatio,
    options.paddingPercent ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.paddingPercent,
    options.maxExpansionPercent ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.maxExpansionPercent,
    options.maxWidthExpansionPercent ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.maxWidthExpansionPercent,
    options.maxHeightExpansionPercent ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.maxHeightExpansionPercent,
  )
  const minWidthCoverage = options.minSubjectWidthCoverage ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.minSubjectWidthCoverage
  const minHeightCoverage = options.minSubjectHeightCoverage ?? DEFAULT_BACKGROUND_EXTENSION_OPTIONS.minSubjectHeightCoverage
  if (size.exceededMaxExpansion) {
    return unchanged(originalSrc, 'extension-exceeds-max-expansion', source, analysis.uniformity, subjectBounds, targetAspectRatio, size, options.targetFormatKey)
  }
  if (!size.aspectRatioPreserved) {
    return unchanged(originalSrc, 'extension-would-distort-image', source, analysis.uniformity, subjectBounds, targetAspectRatio, size, options.targetFormatKey)
  }
  if (size.subjectCoverageAfter.width < minWidthCoverage || size.subjectCoverageAfter.height < minHeightCoverage) {
    return unchanged(originalSrc, 'extension-would-over-shrink-subject', source, analysis.uniformity, subjectBounds, targetAspectRatio, size, options.targetFormatKey)
  }
  if (!size.changed) {
    return unchanged(originalSrc, 'no-extension-needed', source, analysis.uniformity, subjectBounds, targetAspectRatio, undefined, options.targetFormatKey)
  }

  const out = document.createElement('canvas')
  out.width = size.width
  out.height = size.height
  const ctx = out.getContext('2d')
  if (!ctx) return unchanged(originalSrc, 'canvas-unavailable', source, analysis.uniformity, subjectBounds, targetAspectRatio, undefined, options.targetFormatKey)
  ctx.fillStyle = rgbCss(analysis.averageColor)
  ctx.fillRect(0, 0, out.width, out.height)
  const original = document.createElement('canvas')
  original.width = source.width
  original.height = source.height
  original.getContext('2d')?.putImageData(imageData, 0, 0)
  ctx.drawImage(original, size.offsetX, size.offsetY)

  return {
    imageSrc: out.toDataURL('image/png'),
    changed: true,
    reason: 'extended',
    originalSize: { width: source.width, height: source.height },
    extendedSize: { width: out.width, height: out.height },
    objectBounds: subjectBounds,
    subjectBounds,
    targetAspectRatio,
    targetAspectRatioRaw: size.targetAspectRatioRaw,
    targetAspectRatioUsed: size.targetAspectRatioUsed,
    targetFormatKey: options.targetFormatKey,
    subjectCoverageBefore: size.subjectCoverageBefore,
    subjectCoverageAfter: size.subjectCoverageAfter,
    maxExpansionApplied: size.maxExpansionApplied,
    originalAspectRatio: size.originalAspectRatio,
    drawnAspectRatio: size.drawnAspectRatio,
    aspectRatioPreserved: size.aspectRatioPreserved,
    drawScaleX: size.drawScaleX,
    drawScaleY: size.drawScaleY,
    drawOffsetX: size.drawOffsetX,
    drawOffsetY: size.drawOffsetY,
    backgroundUniformity: analysis.uniformity,
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
  targetAspectRatio = source.width / source.height,
  fit?: FitAwareCanvas,
  targetFormatKey?: string,
): BackgroundExtensionResult {
  return {
    imageSrc,
    changed: false,
    reason,
    originalSize: { width: source.width, height: source.height },
    extendedSize: { width: source.width, height: source.height },
    objectBounds: subjectBounds,
    subjectBounds,
    targetAspectRatio,
    targetAspectRatioRaw: fit?.targetAspectRatioRaw ?? targetAspectRatio,
    targetAspectRatioUsed: fit?.targetAspectRatioUsed ?? clamp(targetAspectRatio, 0.75, 1.8),
    targetFormatKey,
    subjectCoverageBefore: fit?.subjectCoverageBefore ?? (subjectBounds ? coverage(subjectBounds, source.width, source.height) : undefined),
    subjectCoverageAfter: fit?.subjectCoverageAfter ?? (subjectBounds ? coverage(subjectBounds, source.width, source.height) : undefined),
    maxExpansionApplied: fit?.maxExpansionApplied ?? false,
    originalAspectRatio: fit?.originalAspectRatio ?? source.width / source.height,
    drawnAspectRatio: fit?.drawnAspectRatio ?? source.width / source.height,
    aspectRatioPreserved: fit?.aspectRatioPreserved ?? true,
    drawScaleX: fit?.drawScaleX ?? 1,
    drawScaleY: fit?.drawScaleY ?? 1,
    drawOffsetX: fit?.drawOffsetX ?? 0,
    drawOffsetY: fit?.drawOffsetY ?? 0,
    backgroundUniformity,
  }
}

function coverage(bounds: Bounds, width: number, height: number): { width: number; height: number } {
  return { width: bounds.w / width, height: bounds.h / height }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9
}

function emptyResult(
  imageSrc: string,
  reason: BackgroundExtensionReason,
  width = 0,
  height = 0,
  targetFormatKey?: string,
): BackgroundExtensionResult {
  return {
    imageSrc,
    changed: false,
    reason,
    originalSize: { width, height },
    extendedSize: { width, height },
    originalAspectRatio: height > 0 ? width / height : undefined,
    drawnAspectRatio: height > 0 ? width / height : undefined,
    aspectRatioPreserved: true,
    drawScaleX: 1,
    drawScaleY: 1,
    drawOffsetX: 0,
    drawOffsetY: 0,
    targetFormatKey,
    backgroundUniformity: 0,
  }
}
