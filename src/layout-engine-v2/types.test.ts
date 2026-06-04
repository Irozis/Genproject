import { describe, expect, it } from 'vitest'
import { sampleFormats, sampleSourceMaterial } from './fixtures'

describe('layout-engine-v2 fixtures', () => {
  it('sampleSourceMaterial contains at least one required element', () => {
    expect(sampleSourceMaterial.elements.some((element) => element.priority === 'required')).toBe(true)
  })

  it('sampleFormats contains at least six formats', () => {
    expect(sampleFormats.length).toBeGreaterThanOrEqual(6)
  })

  it('keeps aspectRatio equal to width divided by height for every format', () => {
    for (const format of sampleFormats) {
      expect(format.aspectRatio).toBe(format.width / format.height)
    }
  })

  it('gives every source element a positive rect size', () => {
    for (const element of sampleSourceMaterial.elements) {
      expect(element.rect.width).toBeGreaterThan(0)
      expect(element.rect.height).toBeGreaterThan(0)
    }
  })

  it('keeps all required fixture elements non-hideable', () => {
    const requiredElements = sampleSourceMaterial.elements.filter((element) => element.priority === 'required')

    for (const element of requiredElements) {
      expect(element.canHide).toBe(false)
    }
  })
})
