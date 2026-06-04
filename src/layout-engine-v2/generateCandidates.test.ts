import { describe, expect, it } from 'vitest'
import { sampleFormats, sampleSourceMaterial } from './fixtures'
import { generateLayoutCandidates } from './generateCandidates'
import type { FormatSpecV2, LayoutCandidate, LayoutCandidateName, LayoutElementRole } from './types'

function formatById(id: string): FormatSpecV2 {
  const format = sampleFormats.find((item) => item.id === id)

  if (!format) {
    throw new Error(`Missing test format: ${id}`)
  }

  return format
}

function candidateByName(candidates: LayoutCandidate[], name: LayoutCandidateName): LayoutCandidate {
  const candidate = candidates.find((item) => item.name === name)

  if (!candidate) {
    throw new Error(`Missing candidate: ${name}`)
  }

  return candidate
}

function elementByRole(candidate: LayoutCandidate, role: LayoutElementRole) {
  const element = candidate.elements.find((item) => item.role === role)

  if (!element) {
    throw new Error(`Missing element role: ${role}`)
  }

  return element
}

describe('generateLayoutCandidates', () => {
  it('returns at least one candidate for every sample format', () => {
    for (const format of sampleFormats) {
      const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

      expect(candidates.length).toBeGreaterThan(0)
    }
  })

  it('returns at least three candidates for horizontal-1200x628', () => {
    const candidates = generateLayoutCandidates(sampleSourceMaterial, formatById('horizontal-1200x628'))

    expect(candidates.length).toBeGreaterThanOrEqual(3)
  })

  it('includes split for horizontal-1200x628', () => {
    const candidates = generateLayoutCandidates(sampleSourceMaterial, formatById('horizontal-1200x628'))

    expect(candidates.some((candidate) => candidate.name === 'split')).toBe(true)
  })

  it('includes imageTop for vertical-1080x1920', () => {
    const candidates = generateLayoutCandidates(sampleSourceMaterial, formatById('vertical-1080x1920'))

    expect(candidates.some((candidate) => candidate.name === 'imageTop')).toBe(true)
  })

  it('includes compact and logoOnly for small-320x50', () => {
    const candidates = generateLayoutCandidates(sampleSourceMaterial, formatById('small-320x50'))

    expect(candidates.some((candidate) => candidate.name === 'compact')).toBe(true)
    expect(candidates.some((candidate) => candidate.name === 'logoOnly')).toBe(true)
  })

  it('includes logoOnly for logo-200x200', () => {
    const candidates = generateLayoutCandidates(sampleSourceMaterial, formatById('logo-200x200'))

    expect(candidates.some((candidate) => candidate.name === 'logoOnly')).toBe(true)
  })

  it('sets formatId to the target format id for every candidate', () => {
    const format = formatById('horizontal-1200x628')
    const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

    for (const candidate of candidates) {
      expect(candidate.formatId).toBe(format.id)
    }
  })

  it('uses deterministic candidate ids', () => {
    const format = formatById('horizontal-1200x628')
    const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

    for (const candidate of candidates) {
      expect(candidate.id).toBe(`${format.id}:${candidate.name}`)
    }
  })

  it('keeps non-negative rect sizes for every element in every candidate', () => {
    for (const format of sampleFormats) {
      const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

      for (const candidate of candidates) {
        for (const element of candidate.elements) {
          expect(element.rect.width).toBeGreaterThanOrEqual(0)
          expect(element.rect.height).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })

  it('keeps positive rect sizes for every visible element in every sample-format candidate', () => {
    for (const format of sampleFormats) {
      const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

      for (const candidate of candidates) {
        for (const element of candidate.elements) {
          if (element.visible) {
            expect(element.rect.width).toBeGreaterThan(0)
            expect(element.rect.height).toBeGreaterThan(0)
          }
        }
      }
    }
  })

  it('keeps every visible element inside the target format canvas', () => {
    for (const format of sampleFormats) {
      const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

      for (const candidate of candidates) {
        for (const element of candidate.elements) {
          if (element.visible) {
            expect(element.rect.x).toBeGreaterThanOrEqual(0)
            expect(element.rect.y).toBeGreaterThanOrEqual(0)
            expect(element.rect.x + element.rect.width).toBeLessThanOrEqual(format.width)
            expect(element.rect.y + element.rect.height).toBeLessThanOrEqual(format.height)
          }
        }
      }
    }
  })

  it('does not hide required elements in any sample-format candidate', () => {
    for (const format of sampleFormats) {
      const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

      for (const candidate of candidates) {
        for (const element of candidate.elements) {
          if (element.priority === 'required') {
            expect(element.visible).toBe(true)
            expect(element.rect.width).toBeGreaterThan(0)
            expect(element.rect.height).toBeGreaterThan(0)
            expect(element.rect.x).toBeGreaterThanOrEqual(0)
            expect(element.rect.y).toBeGreaterThanOrEqual(0)
            expect(element.rect.x + element.rect.width).toBeLessThanOrEqual(format.width)
            expect(element.rect.y + element.rect.height).toBeLessThanOrEqual(format.height)
          }
        }
      }
    }
  })

  it('returns identical output for identical arguments', () => {
    const format = formatById('horizontal-1200x628')
    const first = generateLayoutCandidates(sampleSourceMaterial, format)
    const second = generateLayoutCandidates(sampleSourceMaterial, format)

    expect(second).toEqual(first)
  })

  it('does not mutate sampleSourceMaterial', () => {
    const before = structuredClone(sampleSourceMaterial)

    generateLayoutCandidates(sampleSourceMaterial, formatById('horizontal-1200x628'))

    expect(sampleSourceMaterial).toEqual(before)
  })

  it('hides subtitle for the small compact candidate', () => {
    const candidates = generateLayoutCandidates(sampleSourceMaterial, formatById('small-320x50'))
    const compact = candidateByName(candidates, 'compact')

    expect(elementByRole(compact, 'subtitle').visible).toBe(false)
  })

  it('places split image to the right of headline', () => {
    const candidates = generateLayoutCandidates(sampleSourceMaterial, formatById('horizontal-1200x628'))
    const split = candidateByName(candidates, 'split')

    expect(elementByRole(split, 'image').rect.x).toBeGreaterThan(elementByRole(split, 'headline').rect.x)
  })

  it('hides cta and image for logoOnly', () => {
    const candidates = generateLayoutCandidates(sampleSourceMaterial, formatById('logo-200x200'))
    const logoOnly = candidateByName(candidates, 'logoOnly')

    expect(elementByRole(logoOnly, 'cta').visible).toBe(false)
    expect(elementByRole(logoOnly, 'image').visible).toBe(false)
  })

  it('keeps required headline visible for logoOnly candidates', () => {
    const formats = [formatById('small-320x50'), formatById('logo-200x200')]

    for (const format of formats) {
      const candidates = generateLayoutCandidates(sampleSourceMaterial, format)
      const logoOnly = candidateByName(candidates, 'logoOnly')
      const headline = elementByRole(logoOnly, 'headline')

      expect(headline.priority).toBe('required')
      expect(headline.visible).toBe(true)
      expect(headline.rect.width).toBeGreaterThan(0)
      expect(headline.rect.height).toBeGreaterThan(0)
    }
  })

  it('adds metadata notes to every candidate', () => {
    const candidates = generateLayoutCandidates(sampleSourceMaterial, formatById('horizontal-1200x628'))

    for (const candidate of candidates) {
      expect(candidate.metadata?.notes?.length).toBeGreaterThanOrEqual(1)
    }
  })
})