import { describe, expect, it } from 'vitest'
import { generateLayoutCandidates } from './generateCandidates'
import { getDefaultProjectSourceMaterial } from './defaultProjectSource'
import { runCatalogResearch } from './runCatalogResearch'
import { sampleFormats } from './fixtures'

describe('defaultProjectSource', () => {
  it('adapts DEFAULT_MASTER to SourceMaterialV2', () => {
    const source = getDefaultProjectSourceMaterial()

    expect(source.id).toBe('default-project-source')
    expect(source.elements.length).toBeGreaterThan(0)
    expect(source.elements.some((element) => element.role === 'background')).toBe(true)
    expect(source.elements.some((element) => element.role === 'headline')).toBe(true)

    for (const element of source.elements) {
      expect(element.rect.width).toBeGreaterThan(0)
      expect(element.rect.height).toBeGreaterThan(0)
    }
  })

  it('can generate candidates from DEFAULT_MASTER source', () => {
    const source = getDefaultProjectSourceMaterial()
    const format = sampleFormats.find((item) => item.id === 'horizontal-1200x628')

    if (!format) {
      throw new Error('Missing horizontal-1200x628 fixture format.')
    }

    const candidates = generateLayoutCandidates(source, format)

    expect(candidates.length).toBeGreaterThan(0)
  })

  it('can run catalog research on DEFAULT_MASTER source', () => {
    const source = getDefaultProjectSourceMaterial()
    const result = runCatalogResearch({
      source,
      methods: ['candidateSelection'],
      limit: 10,
    })

    expect(result.projectId).toBe('default-project-source')
    expect(result.formatCount).toBeGreaterThan(0)
    expect(result.formatCount).toBeLessThanOrEqual(10)
    expect(result.methods).toEqual(['candidateSelection'])
    expect(result.reports.length).toBe(result.formatCount)
    expect(result.summary).toHaveLength(1)
    expect(result.summary[0]?.method).toBe('candidateSelection')
  })
})