import { describe, expect, it } from 'vitest'
import { buildFixedLayoutCandidate } from './fixedLayoutBaseline'
import { sampleFormats, sampleSourceMaterial } from './fixtures'
import { generateLayoutCandidates } from './generateCandidates'
import type { FormatSpecV2, LayoutElement } from './types'

function formatById(id: string): FormatSpecV2 {
  const format = sampleFormats.find((item) => item.id === id)

  if (!format) {
    throw new Error(`Missing test format: ${id}`)
  }

  return format
}

function requiredElements(): LayoutElement[] {
  return sampleSourceMaterial.elements.filter((element) => element.priority === 'required')
}

describe('buildFixedLayoutCandidate', () => {
  it('creates one fixedLayout candidate with predefined-template metadata', () => {
    const format = formatById('horizontal-1200x628')
    const candidate = buildFixedLayoutCandidate(sampleSourceMaterial, format)

    expect(candidate.name).toBe('fixedLayout')
    expect(candidate.metadata?.methodFamily).toBe('fixedLayout')
    expect(candidate.metadata?.candidateCount).toBe(1)
    expect(candidate.metadata?.decisionMode).toBe('predefined-template')
    expect(candidate.id).toBe('horizontal-1200x628:fixedLayout:split')
    expect(candidate.metadata?.notes).toEqual([expect.stringContaining('predefined "split" template')])
  })

  it.each([
    ['horizontal-1200x628', 'split'],
    ['vertical-1080x1920', 'imageTop'],
    ['small-320x50', 'compact'],
  ])('selects %s fixedLayout template as %s', (formatId, templateName) => {
    const candidate = buildFixedLayoutCandidate(sampleSourceMaterial, formatById(formatId))

    expect(candidate.metadata?.templateName).toBe(templateName)
    expect(candidate.metadata?.sourceCandidateName).toBe(templateName)
    expect(candidate.id).toBe(`${formatId}:fixedLayout:${templateName}`)
  })

  it('keeps fixedLayout as one predefined candidate while candidateSelection has multiple candidates', () => {
    const format = formatById('horizontal-1200x628')
    const generatedCandidates = generateLayoutCandidates(sampleSourceMaterial, format)
    const fixedCandidate = buildFixedLayoutCandidate(sampleSourceMaterial, format)

    expect(generatedCandidates.length).toBeGreaterThan(1)
    expect(fixedCandidate.metadata?.candidateCount).toBe(1)
  })

  it('does not hide required elements', () => {
    const candidate = buildFixedLayoutCandidate(sampleSourceMaterial, formatById('small-320x50'))

    for (const required of requiredElements()) {
      const element = candidate.elements.find((item) => item.id === required.id)

      expect(element?.visible).toBe(true)
    }
  })

  it('gives visible required elements positive rects', () => {
    const candidate = buildFixedLayoutCandidate(sampleSourceMaterial, formatById('horizontal-1200x628'))

    for (const required of requiredElements()) {
      const element = candidate.elements.find((item) => item.id === required.id)

      expect(element?.visible).toBe(true)
      expect(element?.rect.width).toBeGreaterThan(0)
      expect(element?.rect.height).toBeGreaterThan(0)
    }
  })

  it('is deterministic for the same inputs', () => {
    const format = formatById('vertical-1080x1920')
    const first = buildFixedLayoutCandidate(sampleSourceMaterial, format)
    const second = buildFixedLayoutCandidate(sampleSourceMaterial, format)

    expect(second).toEqual(first)
  })
})
