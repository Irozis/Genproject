import { describe, expect, it } from 'vitest'
import { sampleFormats, sampleSourceMaterial } from './fixtures'
import { generateLayoutCandidates } from './generateCandidates'
import { validateLayoutCandidate } from './validateCandidate'
import type { FormatSpecV2, LayoutCandidate, LayoutElement } from './types'

function formatById(id: string): FormatSpecV2 {
  const format = sampleFormats.find((item) => item.id === id)

  if (!format) {
    throw new Error(`Missing test format: ${id}`)
  }

  return format
}

function candidateFor(formatId: string, candidateName: LayoutCandidate['name']): LayoutCandidate {
  const format = formatById(formatId)
  const candidates = generateLayoutCandidates(sampleSourceMaterial, format)
  const candidate = candidates.find((item) => item.name === candidateName)

  if (!candidate) {
    throw new Error(`Missing candidate "${candidateName}" for format "${formatId}".`)
  }

  return candidate
}

function replaceElement(candidate: LayoutCandidate, elementId: string, patch: Partial<LayoutElement>): LayoutCandidate {
  return {
    ...candidate,
    elements: candidate.elements.map((element) => (element.id === elementId ? { ...element, ...patch } : element)),
  }
}

describe('validateLayoutCandidate', () => {
  it('does not report out_of_bounds for generated sample candidates', () => {
    for (const format of sampleFormats) {
      const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

      for (const candidate of candidates) {
        const issues = validateLayoutCandidate(candidate, format)

        expect(issues.some((issue) => issue.type === 'out_of_bounds')).toBe(false)
      }
    }
  })

  it('reports missing_required when a required element is hidden', () => {
    const format = formatById('horizontal-1200x628')
    const candidate = candidateFor('horizontal-1200x628', 'split')
    const broken = replaceElement(candidate, 'headline', {
      visible: false,
      rect: { x: 0, y: 0, width: 0, height: 0 },
    })

    const issues = validateLayoutCandidate(broken, format)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'missing_required',
          severity: 'critical',
          elementId: 'headline',
        }),
      ]),
    )
  })

  it('reports out_of_bounds when a visible element leaves the canvas', () => {
    const format = formatById('horizontal-1200x628')
    const candidate = candidateFor('horizontal-1200x628', 'split')
    const broken = replaceElement(candidate, 'headline', {
      rect: { x: -10, y: 20, width: 100, height: 40 },
    })

    const issues = validateLayoutCandidate(broken, format)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'out_of_bounds',
          elementId: 'headline',
        }),
      ]),
    )
  })

  it('reports unsafe_zone when an important element is outside the safe area', () => {
    const format = formatById('horizontal-1200x628')
    const candidate = candidateFor('horizontal-1200x628', 'split')
    const broken = replaceElement(candidate, 'logo', {
      rect: { x: 0, y: 0, width: 120, height: 40 },
    })

    const issues = validateLayoutCandidate(broken, format)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'unsafe_zone',
          elementId: 'logo',
        }),
      ]),
    )
  })

  it('reports text_too_small when a visible text element is below its minimum font size', () => {
    const format = formatById('horizontal-1200x628')
    const candidate = candidateFor('horizontal-1200x628', 'split')
    const broken = replaceElement(candidate, 'headline', {
      fontSize: 1,
    })

    const issues = validateLayoutCandidate(broken, format)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'text_too_small',
          elementId: 'headline',
        }),
      ]),
    )
  })

  it('reports overlap for intersecting important or required layout elements', () => {
    const format = formatById('horizontal-1200x628')
    const candidate = candidateFor('horizontal-1200x628', 'split')
    const broken = replaceElement(candidate, 'logo', {
      rect: { x: 80, y: 80, width: 220, height: 100 },
    })
    const alsoBroken = replaceElement(broken, 'headline', {
      rect: { x: 100, y: 90, width: 240, height: 120 },
    })

    const issues = validateLayoutCandidate(alsoBroken, format)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'overlap',
        }),
      ]),
    )
  })

  it('reports hidden_optional when an optional element is hidden', () => {
    const format = formatById('logo-200x200')
    const candidate = candidateFor('logo-200x200', 'logoOnly')

    const issues = validateLayoutCandidate(candidate, format)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'hidden_optional',
          severity: 'warning',
          elementId: 'cta',
        }),
      ]),
    )
  })

  it('reports excessive_crop when image cropRatio metadata is too high', () => {
    const format = formatById('horizontal-1200x628')
    const candidate = candidateFor('horizontal-1200x628', 'split')
    const broken = replaceElement(candidate, 'product-image', {
      metadata: {
        cropRatio: 0.6,
      },
    })

    const issues = validateLayoutCandidate(broken, format)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'excessive_crop',
          severity: 'critical',
          elementId: 'product-image',
        }),
      ]),
    )
  })

  it('returns deterministic issues for identical inputs', () => {
    const format = formatById('horizontal-1200x628')
    const candidate = candidateFor('horizontal-1200x628', 'split')

    expect(validateLayoutCandidate(candidate, format)).toEqual(validateLayoutCandidate(candidate, format))
  })
})