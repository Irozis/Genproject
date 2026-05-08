import type { BackgroundExtensionMetadata, ImageFitDecision, ImageFitMode, ImageFitPreference } from './types'

type Bounds = { x: number; y: number; w: number; h: number }
type SourceSize = { width: number; height: number }
type SourceRect = { x: number; y: number; width: number; height: number }

export type ResolveImageFitDecisionInput = {
  originalImageSrc?: string | null
  extendedImageSrc?: string | null
  originalMetadata?: BackgroundExtensionMetadata | null
  extendedMetadata?: BackgroundExtensionMetadata | null
  formatKey: string
  imageBoxWidth: number
  imageBoxHeight: number
  preference?: ImageFitPreference
}

export function resolveImageFitDecisionForFormat({
  extendedImageSrc,
  originalMetadata,
  extendedMetadata,
  imageBoxWidth,
  imageBoxHeight,
  preference = 'auto',
}: ResolveImageFitDecisionInput): ImageFitDecision {
  const original = sourceForOriginal(originalMetadata, extendedMetadata)
  const originalBounds = originalMetadata?.objectBounds ?? extendedMetadata?.objectBounds
  const hasExtended = !!extendedImageSrc && !!extendedMetadata?.changed
  const extended = sourceForExtended(extendedMetadata)
  const extendedBounds = boundsForExtended(extendedMetadata)

  if (preference === 'cover') {
    const objectFullyVisible = fitsCover(original, originalBounds, imageBoxWidth, imageBoxHeight)
    return decision('original', 'cover', objectFullyVisible, 'manual-cover')
  }

  if (preference === 'contain') {
    return decision('original', 'contain', true, 'manual-contain')
  }

  if (!original || !originalBounds) {
    return decision('original', 'cover', false, 'no-object-bounds')
  }

  if (fitsCover(original, originalBounds, imageBoxWidth, imageBoxHeight)) {
    return decision('original', 'cover', true, 'original-cover-ok')
  }

  if (hasExtended && fitsCover(extended, extendedBounds, imageBoxWidth, imageBoxHeight)) {
    return decision('extended', 'cover', true, 'extended-cover-ok')
  }

  return decision('original', 'contain', true, 'forced-contain-object-cropped')
}

export function computeVisibleSourceRectForCover(
  sourceWidth: number,
  sourceHeight: number,
  imageBoxWidth: number,
  imageBoxHeight: number,
): SourceRect {
  if (!validSize(sourceWidth, sourceHeight) || !validSize(imageBoxWidth, imageBoxHeight)) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const sourceAspect = sourceWidth / sourceHeight
  const boxAspect = imageBoxWidth / imageBoxHeight
  if (sourceAspect >= boxAspect) {
    const width = sourceHeight * boxAspect
    return { x: (sourceWidth - width) / 2, y: 0, width, height: sourceHeight }
  }
  const height = sourceWidth / boxAspect
  return { x: 0, y: (sourceHeight - height) / 2, width: sourceWidth, height }
}

export function computeVisibleSourceRectForContain(sourceWidth: number, sourceHeight: number): SourceRect {
  return { x: 0, y: 0, width: Math.max(0, sourceWidth), height: Math.max(0, sourceHeight) }
}

export function isObjectFullyVisible(objectBounds: Bounds | undefined, visibleRect: SourceRect, epsilon = 0.5): boolean {
  if (!objectBounds) return false
  return (
    objectBounds.x >= visibleRect.x - epsilon &&
    objectBounds.y >= visibleRect.y - epsilon &&
    objectBounds.x + objectBounds.w <= visibleRect.x + visibleRect.width + epsilon &&
    objectBounds.y + objectBounds.h <= visibleRect.y + visibleRect.height + epsilon
  )
}

export function isObjectCropped(objectBounds: Bounds | undefined, visibleRect: SourceRect): boolean {
  return !isObjectFullyVisible(objectBounds, visibleRect)
}

function fitsCover(
  source: SourceSize | null,
  objectBounds: Bounds | undefined,
  imageBoxWidth: number,
  imageBoxHeight: number,
): boolean {
  if (!source || !objectBounds) return false
  return isObjectFullyVisible(
    objectBounds,
    computeVisibleSourceRectForCover(source.width, source.height, imageBoxWidth, imageBoxHeight),
  )
}

function sourceForOriginal(
  originalMetadata: BackgroundExtensionMetadata | null | undefined,
  extendedMetadata: BackgroundExtensionMetadata | null | undefined,
): SourceSize | null {
  const size = originalMetadata?.originalSize ?? extendedMetadata?.originalSize
  return validMetadataSize(size) ? size : null
}

function sourceForExtended(metadata: BackgroundExtensionMetadata | null | undefined): SourceSize | null {
  const size = metadata?.extendedSize
  return validMetadataSize(size) ? size : null
}

function boundsForExtended(metadata: BackgroundExtensionMetadata | null | undefined): Bounds | undefined {
  const bounds = metadata?.objectBounds
  if (!bounds) return undefined
  const scaleX = metadata?.drawScaleX ?? 1
  const scaleY = metadata?.drawScaleY ?? 1
  return {
    x: bounds.x * scaleX + (metadata?.drawOffsetX ?? 0),
    y: bounds.y * scaleY + (metadata?.drawOffsetY ?? 0),
    w: bounds.w * scaleX,
    h: bounds.h * scaleY,
  }
}

function decision(
  usedSource: ImageFitDecision['usedSource'],
  fitMode: ImageFitMode,
  objectFullyVisible: boolean,
  reason: ImageFitDecision['reason'],
): ImageFitDecision {
  return {
    usedSource,
    fitMode,
    objectFullyVisible,
    objectCropped: !objectFullyVisible,
    reason,
  }
}

function validMetadataSize(size: SourceSize | undefined): size is SourceSize {
  return !!size && validSize(size.width, size.height)
}

function validSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
}
