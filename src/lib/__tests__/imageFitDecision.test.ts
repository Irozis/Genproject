import { describe, expect, it } from 'vitest'
import { computeVisibleSourceRectForCover, computeVisibleSourceRectForContain, isObjectCropped, isObjectFullyVisible, resolveImageFitDecisionForFormat } from '../imageFitDecision'
import type { BackgroundExtensionMetadata } from '../types'

function metadata(input: Partial<BackgroundExtensionMetadata>): BackgroundExtensionMetadata {
  return {
    changed: false,
    reason: 'no-extension-needed',
    originalSize: { width: 100, height: 100 },
    extendedSize: { width: 100, height: 100 },
    backgroundUniformity: 1,
    ...input,
  }
}

describe('image fit decision', () => {
  it('uses original cover when the object fits the cover viewport', () => {
    const decision = resolveImageFitDecisionForFormat({
      originalImageSrc: 'original',
      originalMetadata: metadata({ objectBounds: { x: 30, y: 30, w: 40, h: 40 } }),
      formatKey: 'wide',
      imageBoxWidth: 200,
      imageBoxHeight: 100,
      preference: 'auto',
    })

    expect(decision).toMatchObject({ usedSource: 'original', fitMode: 'cover', reason: 'original-cover-ok' })
    expect(decision.objectFullyVisible).toBe(true)
  })

  it('uses extended cover when original cover crops but extension fits', () => {
    const decision = resolveImageFitDecisionForFormat({
      originalImageSrc: 'original',
      extendedImageSrc: 'extended',
      originalMetadata: metadata({ objectBounds: { x: 10, y: 10, w: 80, h: 80 } }),
      extendedMetadata: metadata({
        changed: true,
        reason: 'extended',
        objectBounds: { x: 10, y: 10, w: 80, h: 80 },
        originalSize: { width: 100, height: 100 },
        extendedSize: { width: 200, height: 100 },
        drawOffsetX: 60,
        drawOffsetY: 0,
      }),
      formatKey: 'wide',
      imageBoxWidth: 200,
      imageBoxHeight: 100,
      preference: 'auto',
    })

    expect(decision).toMatchObject({ usedSource: 'extended', fitMode: 'cover', reason: 'extended-cover-ok' })
  })

  it('switches to contain when original and extended cover both crop', () => {
    const decision = resolveImageFitDecisionForFormat({
      originalImageSrc: 'original',
      extendedImageSrc: 'extended',
      originalMetadata: metadata({ objectBounds: { x: 10, y: 10, w: 80, h: 80 } }),
      extendedMetadata: metadata({
        changed: true,
        reason: 'extended',
        objectBounds: { x: 10, y: 10, w: 80, h: 80 },
        originalSize: { width: 100, height: 100 },
        extendedSize: { width: 120, height: 100 },
        drawOffsetX: 10,
        drawOffsetY: 0,
      }),
      formatKey: 'wide',
      imageBoxWidth: 200,
      imageBoxHeight: 100,
      preference: 'auto',
    })

    expect(decision).toMatchObject({ usedSource: 'original', fitMode: 'contain', reason: 'forced-contain-object-cropped' })
    expect(decision.objectFullyVisible).toBe(true)
  })

  it('manual cover overrides auto analysis', () => {
    const decision = resolveImageFitDecisionForFormat({
      originalImageSrc: 'original',
      originalMetadata: metadata({ objectBounds: { x: 10, y: 10, w: 80, h: 80 } }),
      formatKey: 'wide',
      imageBoxWidth: 200,
      imageBoxHeight: 100,
      preference: 'cover',
    })

    expect(decision).toMatchObject({ usedSource: 'original', fitMode: 'cover', reason: 'manual-cover' })
  })

  it('manual contain overrides auto analysis', () => {
    const decision = resolveImageFitDecisionForFormat({
      originalImageSrc: 'original',
      originalMetadata: metadata({ objectBounds: { x: 30, y: 30, w: 40, h: 40 } }),
      formatKey: 'wide',
      imageBoxWidth: 200,
      imageBoxHeight: 100,
      preference: 'contain',
    })

    expect(decision).toMatchObject({ usedSource: 'original', fitMode: 'contain', reason: 'manual-contain' })
  })

  it('falls back when object bounds are missing', () => {
    const decision = resolveImageFitDecisionForFormat({
      originalImageSrc: 'original',
      originalMetadata: metadata({}),
      formatKey: 'wide',
      imageBoxWidth: 200,
      imageBoxHeight: 100,
      preference: 'auto',
    })

    expect(decision).toMatchObject({ usedSource: 'original', fitMode: 'cover', reason: 'no-object-bounds' })
  })

  it('exposes visible rect helpers for cover and contain', () => {
    const coverRect = computeVisibleSourceRectForCover(100, 100, 200, 100)
    const containRect = computeVisibleSourceRectForContain(100, 100)

    expect(coverRect).toEqual({ x: 0, y: 25, width: 100, height: 50 })
    expect(containRect).toEqual({ x: 0, y: 0, width: 100, height: 100 })
    expect(isObjectFullyVisible({ x: 20, y: 30, w: 40, h: 20 }, coverRect)).toBe(true)
    expect(isObjectCropped({ x: 20, y: 10, w: 40, h: 80 }, coverRect)).toBe(true)
  })
})
