import { describe, expect, it } from 'vitest'
import { sampleFormats, sampleSourceMaterial } from './fixtures'
import { runResearch } from './runResearch'

describe('runResearch', () => {
  it('runs all three methods for all sample formats', () => {
    const result = runResearch()

    expect(result.projectId).toBe(sampleSourceMaterial.id)
    expect(result.formatCount).toBe(sampleFormats.length)
    expect(result.formats).toEqual(sampleFormats)
    expect(result.methods).toEqual(['scaling', 'fixedLayout', 'candidateSelection'])
    expect(result.reports.length).toBe(sampleFormats.length * 3)
  })

  it('creates a summary row for each method', () => {
    const result = runResearch()

    expect(result.summary.map((item) => item.method)).toEqual(['scaling', 'fixedLayout', 'candidateSelection'])

    for (const summary of result.summary) {
      expect(summary.totalFormats).toBe(sampleFormats.length)
      expect(summary.averageScore).toBeGreaterThanOrEqual(0)
      expect(summary.totalScore).toBeGreaterThanOrEqual(0)
      expect(summary.clean + summary.warningOnly + summary.critical).toBe(sampleFormats.length)
      expect(summary.withoutCritical).toBe(summary.clean + summary.warningOnly)
    }
  })

  it('creates CSV containing all methods', () => {
    const result = runResearch()

    expect(result.csv).toContain('scaling')
    expect(result.csv).toContain('fixedLayout')
    expect(result.csv).toContain('candidateSelection')
  })

  it('is deterministic for the same inputs', () => {
    const first = runResearch()
    const second = runResearch()

    expect(second).toEqual(first)
  })

  it('can run only candidateSelection when requested', () => {
    const result = runResearch({
      methods: ['candidateSelection'],
    })

    expect(result.methods).toEqual(['candidateSelection'])
    expect(result.reports.length).toBe(sampleFormats.length)
    expect(result.summary).toHaveLength(1)
    expect(result.summary[0]?.method).toBe('candidateSelection')
  })

  it('can run on a subset of formats', () => {
    const result = runResearch({
      formats: [sampleFormats[0]!, sampleFormats[1]!],
    })

    expect(result.formatCount).toBe(2)
    expect(result.reports.length).toBe(2 * 3)
  })
})
