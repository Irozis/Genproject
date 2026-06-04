import { describe, expect, it } from 'vitest'
import { sampleSourceMaterial } from './fixtures'
import { getCatalogFormatsV2, runCatalogResearch } from './runCatalogResearch'

describe('runCatalogResearch', () => {
  it('adapts real catalog formats to FormatSpecV2', () => {
    const formats = getCatalogFormatsV2()

    expect(formats.length).toBeGreaterThan(0)

    for (const format of formats) {
      expect(format.id).toBeTruthy()
      expect(format.name).toBeTruthy()
      expect(format.width).toBeGreaterThan(0)
      expect(format.height).toBeGreaterThan(0)
      expect(format.aspectRatio).toBe(format.width / format.height)
      expect(format.safeArea.top).toBeGreaterThanOrEqual(0)
      expect(format.safeArea.right).toBeGreaterThanOrEqual(0)
      expect(format.safeArea.bottom).toBeGreaterThanOrEqual(0)
      expect(format.safeArea.left).toBeGreaterThanOrEqual(0)
    }
  })

  it('runs candidateSelection research on a limited real catalog subset', () => {
    const result = runCatalogResearch({
      source: sampleSourceMaterial,
      methods: ['candidateSelection'],
      limit: 10,
    })

    expect(result.projectId).toBe(sampleSourceMaterial.id)
    expect(result.formatCount).toBeGreaterThan(0)
    expect(result.formatCount).toBeLessThanOrEqual(10)
    expect(result.methods).toEqual(['candidateSelection'])
    expect(result.reports.length).toBe(result.formatCount)
    expect(result.summary).toHaveLength(1)
    expect(result.summary[0]?.method).toBe('candidateSelection')
  })

  it('runs all research methods on a limited real catalog subset', () => {
    const result = runCatalogResearch({
      source: sampleSourceMaterial,
      limit: 5,
    })

    expect(result.methods).toEqual(['scaling', 'fixedLayout', 'candidateSelection'])
    expect(result.formatCount).toBeGreaterThan(0)
    expect(result.formatCount).toBeLessThanOrEqual(5)
    expect(result.reports.length).toBe(result.formatCount * 3)
    expect(result.csv).toContain('scaling')
    expect(result.csv).toContain('fixedLayout')
    expect(result.csv).toContain('candidateSelection')
  })

  it('is deterministic for the same limited catalog input', () => {
    const first = runCatalogResearch({
      source: sampleSourceMaterial,
      limit: 5,
    })
    const second = runCatalogResearch({
      source: sampleSourceMaterial,
      limit: 5,
    })

    expect(second).toEqual(first)
  })
})