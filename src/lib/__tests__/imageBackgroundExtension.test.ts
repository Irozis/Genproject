import { describe, expect, it } from 'vitest'
import {
  analyzeEdgeBackground,
  calculateFitAwareCanvas,
  canExtendBackground,
  estimateObjectBounds,
  estimateSubjectBounds,
  extendImageBackgroundForFormat,
  needsBackgroundExtension,
  type PixelSource,
} from '../imageBackgroundExtension'

function source(width: number, height: number, fill: [number, number, number]): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0]
    data[i + 1] = fill[1]
    data[i + 2] = fill[2]
    data[i + 3] = 255
  }
  return { width, height, data }
}

function rect(s: PixelSource, x0: number, y0: number, w: number, h: number, fill: [number, number, number]): void {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      const i = (y * s.width + x) * 4
      s.data[i] = fill[0]
      s.data[i + 1] = fill[1]
      s.data[i + 2] = fill[2]
      s.data[i + 3] = 255
    }
  }
}

describe('imageBackgroundExtension pure heuristics', () => {
  it('allows extension for a uniform light background', () => {
    const s = source(100, 80, [245, 245, 242])
    rect(s, 30, 20, 35, 35, [40, 90, 160])
    const analysis = analyzeEdgeBackground(s)

    expect(canExtendBackground(analysis)).toBe(true)
    expect(analysis.uniformity).toBeGreaterThanOrEqual(0.78)
  })

  it('rejects a noisy complex edge background', () => {
    const s = source(80, 80, [245, 245, 245])
    for (let y = 0; y < s.height; y += 1) {
      for (let x = 0; x < s.width; x += 1) {
        const onEdge = x < 8 || y < 8 || x >= s.width - 8 || y >= s.height - 8
        if (!onEdge) continue
        const v = (x * 37 + y * 53) % 255
        rect(s, x, y, 1, 1, [v, 255 - v, (v * 3) % 255])
      }
    }
    const analysis = analyzeEdgeBackground(s, 0.1)

    expect(canExtendBackground(analysis)).toBe(false)
  })

  it('detects that a subject close to the edge needs extension', () => {
    const s = source(120, 90, [250, 250, 248])
    rect(s, 2, 25, 50, 40, [20, 80, 180])
    const analysis = analyzeEdgeBackground(s)
    const bounds = estimateSubjectBounds(s, analysis.averageColor)

    expect(bounds).toBeDefined()
    expect(needsBackgroundExtension(s, bounds!, { paddingPercent: 0.14 })).toBe(true)
  })

  it('keeps an image unchanged when the subject already has enough margins', () => {
    const s = source(120, 90, [250, 250, 248])
    rect(s, 35, 25, 40, 35, [20, 80, 180])
    const analysis = analyzeEdgeBackground(s)
    const bounds = estimateSubjectBounds(s, analysis.averageColor)

    expect(bounds).toBeDefined()
    expect(needsBackgroundExtension(s, bounds!, { paddingPercent: 0.14 })).toBe(false)
  })

  it('is deterministic for identical pixel input', () => {
    const a = source(100, 100, [240, 240, 240])
    const b = source(100, 100, [240, 240, 240])
    rect(a, 4, 30, 35, 35, [30, 40, 50])
    rect(b, 4, 30, 35, 35, [30, 40, 50])

    expect(analyzeEdgeBackground(a)).toEqual(analyzeEdgeBackground(b))
    expect(estimateSubjectBounds(a, analyzeEdgeBackground(a).averageColor)).toEqual(
      estimateSubjectBounds(b, analyzeEdgeBackground(b).averageColor),
    )
  })

  it('estimates object bounds on a uniform background', () => {
    const s = source(100, 80, [250, 250, 250])
    rect(s, 12, 18, 40, 30, [20, 60, 140])
    const analysis = analyzeEdgeBackground(s)

    expect(estimateObjectBounds(s, analysis.averageColor)).toEqual({ x: 12, y: 18, w: 40, h: 30 })
  })

  it('fit-aware calculation leaves an already fitting object unchanged', () => {
    const fit = calculateFitAwareCanvas(
      { width: 200, height: 200 },
      { x: 60, y: 60, w: 80, h: 80 },
      1,
      0.08,
      1,
    )

    expect(fit.changed).toBe(false)
    expect(fit.width).toBe(200)
    expect(fit.height).toBe(200)
  })

  it('fit-aware calculation expands for a too-wide object', () => {
    const fit = calculateFitAwareCanvas(
      { width: 120, height: 120 },
      { x: 1, y: 35, w: 116, h: 40 },
      1,
      0.08,
      1,
    )

    expect(fit.changed).toBe(true)
    expect(fit.width).toBeGreaterThanOrEqual(139)
    expect(fit.height).toBeGreaterThanOrEqual(139)
  })

  it('fit-aware calculation expands for a too-tall object', () => {
    const fit = calculateFitAwareCanvas(
      { width: 120, height: 120 },
      { x: 42, y: 1, w: 36, h: 116 },
      1,
      0.08,
      1,
    )

    expect(fit.changed).toBe(true)
    expect(fit.height).toBeGreaterThanOrEqual(139)
  })

  it('fit-aware calculation adapts a square object to a portrait format', () => {
    const fit = calculateFitAwareCanvas(
      { width: 120, height: 120 },
      { x: 20, y: 20, w: 80, h: 80 },
      1080 / 1920,
      0.08,
      2,
    )

    expect(fit.changed).toBe(true)
    expect(fit.height).toBeGreaterThan(fit.width)
    expect(fit.width / fit.height).toBeCloseTo(0.75, 2)
    expect(fit.targetAspectRatioRaw).toBeCloseTo(1080 / 1920, 4)
    expect(fit.targetAspectRatioUsed).toBe(0.75)
  })

  it('marks portrait extension as over-shrinking when subject coverage gets too small', () => {
    const fit = calculateFitAwareCanvas(
      { width: 120, height: 120 },
      { x: 40, y: 25, w: 40, h: 70 },
      1080 / 1920,
      0.08,
      1,
      1,
      1,
    )

    expect(fit.subjectCoverageAfter.height).toBeLessThan(0.45)
  })

  it('marks excessive expansion when max expansion is too small', () => {
    const fit = calculateFitAwareCanvas(
      { width: 120, height: 120 },
      { x: 1, y: 1, w: 118, h: 118 },
      1,
      0.08,
      0.02,
      0.02,
      0.02,
    )

    expect(fit.maxExpansionApplied).toBe(true)
    expect(fit.exceededMaxExpansion).toBe(true)
  })

  it('keeps ordinary uniform-background extension available', () => {
    const fit = calculateFitAwareCanvas(
      { width: 120, height: 120 },
      { x: 2, y: 28, w: 96, h: 64 },
      1,
      0.08,
      0.5,
      0.5,
      0.5,
    )

    expect(fit.changed).toBe(true)
    expect(fit.exceededMaxExpansion).toBe(false)
    expect(fit.subjectCoverageAfter.height).toBeGreaterThanOrEqual(0.45)
  })

  it('preserves drawn aspect ratio for an 800x600 image after extension', () => {
    const fit = calculateFitAwareCanvas(
      { width: 800, height: 600 },
      { x: 8, y: 160, w: 430, h: 280 },
      1,
      0.08,
      0.5,
      0.5,
      0.5,
    )

    expect(fit.originalAspectRatio).toBeCloseTo(800 / 600, 8)
    expect(fit.drawnAspectRatio).toBeCloseTo(800 / 600, 8)
    expect(fit.aspectRatioPreserved).toBe(true)
  })

  it('uses equal draw scales when scaling metadata is present', () => {
    const fit = calculateFitAwareCanvas(
      { width: 800, height: 600 },
      { x: 8, y: 160, w: 430, h: 280 },
      1,
      0.08,
      0.5,
      0.5,
      0.5,
    )

    expect(fit.drawScaleX).toBe(fit.drawScaleY)
  })

  it('does not scale the original image in the MVP draw plan', () => {
    const fit = calculateFitAwareCanvas(
      { width: 800, height: 600 },
      { x: 8, y: 160, w: 430, h: 280 },
      1,
      0.08,
      0.5,
      0.5,
      0.5,
    )

    expect(fit.drawScaleX).toBe(1)
    expect(fit.drawScaleY).toBe(1)
  })

  it('allows extended canvas aspect ratio to differ without distorting the inserted image', () => {
    const fit = calculateFitAwareCanvas(
      { width: 800, height: 600 },
      { x: 8, y: 160, w: 430, h: 280 },
      0.75,
      0.08,
      0.5,
      0.5,
      0.5,
    )

    expect(fit.width / fit.height).not.toBeCloseTo(fit.drawnAspectRatio, 2)
    expect(fit.aspectRatioPreserved).toBe(true)
  })

  it('keeps object bounds ratio unchanged after extension', () => {
    const object = { x: 4, y: 18, w: 64, h: 64 }
    const fit = calculateFitAwareCanvas(
      { width: 100, height: 100 },
      object,
      0.75,
      0.08,
      0.5,
      0.5,
      0.5,
    )
    const originalObjectRatio = object.w / object.h
    const drawnObjectRatio = (object.w * fit.drawScaleX) / (object.h * fit.drawScaleY)

    expect(drawnObjectRatio).toBeCloseTo(originalObjectRatio, 8)
  })

  it('never uses non-uniform scale in fit-aware calculations', () => {
    const fit = calculateFitAwareCanvas(
      { width: 320, height: 900 },
      { x: 2, y: 20, w: 180, h: 760 },
      1.8,
      0.08,
      0.5,
      0.5,
      0.5,
    )

    expect(fit.drawScaleX).toBe(fit.drawScaleY)
    expect(fit.aspectRatioPreserved).toBe(true)
  })

  it('keeps targetFormatKey in headless metadata', async () => {
    const result = await extendImageBackgroundForFormat({
      imageSrc: 'data:image/png;base64,input',
      targetWidth: 1080,
      targetHeight: 1920,
      targetFormatKey: 'telegram-story',
    })

    expect(result.targetFormatKey).toBe('telegram-story')
    expect(result.aspectRatioPreserved).toBe(true)
    expect(result.drawScaleX).toBe(result.drawScaleY)
  })

  it('calculates independent canvas plans for different format aspects', () => {
    const subject = { x: 2, y: 28, w: 96, h: 64 }
    const square = calculateFitAwareCanvas({ width: 120, height: 120 }, subject, 1, 0.08, 1, 1, 1)
    const portrait = calculateFitAwareCanvas({ width: 120, height: 120 }, subject, 0.75, 0.08, 1, 1, 1)

    expect({ width: square.width, height: square.height }).not.toEqual({ width: portrait.width, height: portrait.height })
    expect(square.aspectRatioPreserved).toBe(true)
    expect(portrait.aspectRatioPreserved).toBe(true)
  })
})
