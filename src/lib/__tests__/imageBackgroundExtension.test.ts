import { describe, expect, it } from 'vitest'
import {
  analyzeEdgeBackground,
  canExtendBackground,
  estimateSubjectBounds,
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
})
