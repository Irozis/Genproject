import { describe, expect, it } from 'vitest'
import { buildCandidateSelectionCandidates } from './runResearch'
import { getMinElementGap } from './rules'
import { selectBestLayoutCandidate } from './selectBestCandidate'
import { validateLayoutCandidate } from './validateCandidate'
import type {
  FormatSpecV2,
  LayoutCandidate,
  LayoutElement,
  LayoutElementRole,
  LayoutRect,
  SourceMaterialV2,
} from './types'

const regressionSource: SourceMaterialV2 = {
  id: 'layout-adaptation-regression-source',
  elements: [
    {
      id: 'background',
      role: 'background',
      priority: 'required',
      rect: { x: 0, y: 0, width: 600, height: 600 },
      visible: true,
      canHide: false,
      canScale: true,
      canCrop: true,
    },
    {
      id: 'image',
      role: 'image',
      priority: 'important',
      rect: { x: 300, y: 80, width: 240, height: 300 },
      visible: true,
      minWidth: 40,
      minHeight: 40,
      canHide: false,
      canScale: true,
      canCrop: true,
    },
    {
      id: 'headline',
      role: 'headline',
      priority: 'required',
      rect: { x: 48, y: 80, width: 260, height: 96 },
      visible: true,
      text: 'Adaptive offer headline',
      fontSize: 40,
      minFontSize: 10,
      minWidth: 80,
      minHeight: 28,
      canHide: false,
      canScale: true,
      canCrop: false,
    },
    {
      id: 'badge',
      role: 'badge',
      priority: 'optional',
      rect: { x: 48, y: 48, width: 110, height: 28 },
      visible: true,
      text: 'New',
      fontSize: 14,
      minFontSize: 8,
      minWidth: 50,
      minHeight: 18,
      canHide: true,
      canScale: true,
      canCrop: false,
    },
    {
      id: 'subtitle',
      role: 'subtitle',
      priority: 'optional',
      rect: { x: 48, y: 190, width: 240, height: 56 },
      visible: true,
      text: 'Optional supporting copy',
      fontSize: 20,
      minFontSize: 9,
      minWidth: 80,
      minHeight: 24,
      canHide: true,
      canScale: true,
      canCrop: false,
    },
    {
      id: 'cta',
      role: 'cta',
      priority: 'optional',
      rect: { x: 48, y: 270, width: 130, height: 44 },
      visible: true,
      text: 'Shop now',
      fontSize: 18,
      minFontSize: 9,
      minWidth: 76,
      minHeight: 28,
      canHide: true,
      canScale: true,
      canCrop: false,
    },
    {
      id: 'logo',
      role: 'logo',
      priority: 'optional',
      rect: { x: 48, y: 500, width: 90, height: 36 },
      visible: true,
      minWidth: 40,
      minHeight: 20,
      canHide: true,
      canScale: true,
      canCrop: false,
    },
  ],
}

function format(id: string, width: number, height: number, group: FormatSpecV2['group']): FormatSpecV2 {
  const inset = Math.max(4, Math.round(Math.min(width, height) * 0.04))

  return {
    id,
    name: id,
    width,
    height,
    aspectRatio: width / height,
    group,
    safeArea: { top: inset, right: inset, bottom: inset, left: inset },
  }
}

function elementByRole(candidate: LayoutCandidate, role: LayoutElementRole): LayoutElement {
  const element = candidate.elements.find((item) => item.role === role)

  if (!element) {
    throw new Error(`Missing element role: ${role}`)
  }

  return element
}

function rectIntersectionArea(a: LayoutRect, b: LayoutRect): number {
  const left = Math.max(a.x, b.x)
  const top = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)

  return Math.max(0, right - left) * Math.max(0, bottom - top)
}

function rectDistance(a: LayoutRect, b: LayoutRect): number {
  if (rectIntersectionArea(a, b) > 0) {
    return 0
  }

  const horizontalGap = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0)
  const verticalGap = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0)

  if (horizontalGap === 0) {
    return verticalGap
  }

  if (verticalGap === 0) {
    return horizontalGap
  }

  return Math.sqrt(horizontalGap ** 2 + verticalGap ** 2)
}

function selectedFor(target: FormatSpecV2, source: SourceMaterialV2 = regressionSource): LayoutCandidate {
  return selectBestLayoutCandidate(buildCandidateSelectionCandidates(source, target), target).selected.candidate
}

function requiredCtaSource(): SourceMaterialV2 {
  return {
    ...regressionSource,
    elements: regressionSource.elements.map((element) =>
      element.role === 'cta'
        ? {
            ...element,
            priority: 'required',
            minWidth: 220,
            canHide: false,
          }
        : element,
    ),
  }
}

function oversizedOptionalCtaSource(): SourceMaterialV2 {
  return {
    ...regressionSource,
    elements: regressionSource.elements.map((element) =>
      element.role === 'cta'
        ? {
            ...element,
            minWidth: 220,
          }
        : element,
    ),
  }
}

function importantStackSource(): SourceMaterialV2 {
  return {
    ...regressionSource,
    elements: regressionSource.elements.map((element) => {
      if (element.role === 'badge' || element.role === 'subtitle' || element.role === 'cta' || element.role === 'image') {
        return {
          ...element,
          priority: 'important',
        }
      }

      return element
    }),
  }
}

function requiredStackSource(): SourceMaterialV2 {
  return {
    ...regressionSource,
    elements: regressionSource.elements.map((element) => {
      if (element.role === 'headline' || element.role === 'cta' || element.role === 'image') {
        return {
          ...element,
          priority: 'required',
          canHide: false,
        }
      }

      return element
    }),
  }
}

function expectNoIntersection(first: LayoutElement, second: LayoutElement): void {
  if (!first.visible || !second.visible) {
    return
  }

  expect(rectIntersectionArea(first.rect, second.rect)).toBe(0)
}

function expectTextStackOrder(candidate: LayoutCandidate): void {
  const badge = elementByRole(candidate, 'badge')
  const headline = elementByRole(candidate, 'headline')
  const subtitle = elementByRole(candidate, 'subtitle')
  const cta = elementByRole(candidate, 'cta')

  if (badge.visible) {
    expect(badge.rect.y + badge.rect.height).toBeLessThanOrEqual(headline.rect.y)
  }

  if (subtitle.visible) {
    expect(headline.rect.y + headline.rect.height).toBeLessThanOrEqual(subtitle.rect.y)
  }

  if (cta.visible) {
    const previous = subtitle.visible ? subtitle : headline

    expect(previous.rect.y + previous.rect.height).toBeLessThanOrEqual(cta.rect.y)
  }

  for (const first of [badge, headline, subtitle]) {
    for (const second of [headline, subtitle, cta]) {
      if (first.id !== second.id) {
        expectNoIntersection(first, second)
      }
    }
  }
}

describe('layout adaptation regressions', () => {
  it('keeps headline and CTA separated in 300x250 medium rectangles', () => {
    const target = format('medium-rectangle-300x250', 300, 250, 'horizontal')
    const candidate = selectedFor(target)
    const headline = elementByRole(candidate, 'headline')
    const cta = elementByRole(candidate, 'cta')

    expect(cta.visible).toBe(true)
    expect(rectIntersectionArea(headline.rect, cta.rect)).toBe(0)
    expect(rectDistance(headline.rect, cta.rect)).toBeGreaterThanOrEqual(getMinElementGap(target, 'headlineCta'))
  })

  it('does not overlap headline and CTA in 319x57 compact banners', () => {
    const target = format('compact-319x57', 319, 57, 'small')
    const candidate = selectedFor(target)
    const headline = elementByRole(candidate, 'headline')
    const cta = elementByRole(candidate, 'cta')

    expect(headline.visible).toBe(true)
    expectNoIntersection(headline, cta)
  })

  it('keeps headline and CTA gap above minimum in 320x100 compact banners', () => {
    const target = format('compact-320x100', 320, 100, 'small')
    const candidate = selectedFor(target)
    const headline = elementByRole(candidate, 'headline')
    const cta = elementByRole(candidate, 'cta')

    if (cta.visible) {
      expect(rectDistance(headline.rect, cta.rect)).toBeGreaterThanOrEqual(getMinElementGap(target, 'headlineCta'))
    }
  })

  it('keeps CTA out of headline in 320x240 compact rectangles', () => {
    const target = format('compact-320x240', 320, 240, 'horizontal')
    const candidate = selectedFor(target)

    expectNoIntersection(elementByRole(candidate, 'headline'), elementByRole(candidate, 'cta'))
  })

  it('keeps CTA out of headline in 300x300 square formats', () => {
    const target = format('square-300x300', 300, 300, 'square')
    const candidate = selectedFor(target)

    expectNoIntersection(elementByRole(candidate, 'headline'), elementByRole(candidate, 'cta'))
  })

  it('keeps image, headline, CTA order and canvas bounds in 240x400 vertical banners', () => {
    const target = format('vertical-banner-240x400', 240, 400, 'vertical')
    const candidate = selectedFor(target)
    const image = elementByRole(candidate, 'image')
    const headline = elementByRole(candidate, 'headline')
    const cta = elementByRole(candidate, 'cta')

    expect(image.visible).toBe(true)
    expect(headline.visible).toBe(true)
    expect(cta.visible).toBe(true)
    expect(image.rect.y + image.rect.height).toBeLessThanOrEqual(headline.rect.y)
    expect(headline.rect.y + headline.rect.height).toBeLessThanOrEqual(cta.rect.y)

    for (const element of [image, headline, cta]) {
      expect(element.rect.x).toBeGreaterThanOrEqual(0)
      expect(element.rect.y).toBeGreaterThanOrEqual(0)
      expect(element.rect.x + element.rect.width).toBeLessThanOrEqual(target.width)
      expect(element.rect.y + element.rect.height).toBeLessThanOrEqual(target.height)
    }
  })

  it('avoids critical defects and headline/CTA overlap in 300x500 vertical banners', () => {
    const target = format('vertical-banner-300x500', 300, 500, 'vertical')
    const decision = selectBestLayoutCandidate(buildCandidateSelectionCandidates(regressionSource, target), target)
    const headline = elementByRole(decision.selected.candidate, 'headline')
    const cta = elementByRole(decision.selected.candidate, 'cta')

    expect(decision.selected.criticalCount).toBe(0)
    expect(cta.visible).toBe(true)
    expect(rectIntersectionArea(headline.rect, cta.rect)).toBe(0)
  })

  it('keeps badge out of headline and description in 640x960 vertical formats', () => {
    const target = format('vertical-640x960', 640, 960, 'vertical')
    const candidate = selectedFor(target, importantStackSource())
    const badge = elementByRole(candidate, 'badge')

    expect(badge.visible).toBe(true)
    expectNoIntersection(badge, elementByRole(candidate, 'headline'))
    expectNoIntersection(badge, elementByRole(candidate, 'subtitle'))
  })

  it('keeps badge out of headline and description in 960x1440 tall vertical formats', () => {
    const target = format('vertical-960x1440', 960, 1440, 'vertical')
    const candidate = selectedFor(target, importantStackSource())
    const badge = elementByRole(candidate, 'badge')

    expect(badge.visible).toBe(true)
    expectNoIntersection(badge, elementByRole(candidate, 'headline'))
    expectNoIntersection(badge, elementByRole(candidate, 'subtitle'))
  })

  it('keeps badge, headline, description and CTA as a text stack in 300x600 vertical banners', () => {
    const target = format('vertical-300x600', 300, 600, 'vertical')
    const candidate = selectedFor(target, importantStackSource())

    expectTextStackOrder(candidate)
  })

  it('keeps required elements visible in 240x600 vertical banners', () => {
    const target = format('vertical-240x600', 240, 600, 'vertical')
    const candidate = selectedFor(target, requiredStackSource())

    expect(elementByRole(candidate, 'headline').visible).toBe(true)
    expect(elementByRole(candidate, 'image').visible).toBe(true)
    expect(elementByRole(candidate, 'cta').visible).toBe(true)
  })

  it('avoids badge overlap in 160x600 tall compact banners', () => {
    const target = format('tall-160x600', 160, 600, 'vertical')
    const candidate = selectedFor(target, importantStackSource())
    const badge = elementByRole(candidate, 'badge')

    expectNoIntersection(badge, elementByRole(candidate, 'headline'))
    expectNoIntersection(badge, elementByRole(candidate, 'subtitle'))
  })

  it('allows optional CTA to be hidden in 200x200 compact formats without critical defects', () => {
    const target = format('compact-200x200', 200, 200, 'small')
    const source = oversizedOptionalCtaSource()
    const decision = selectBestLayoutCandidate(buildCandidateSelectionCandidates(source, target), target)
    const cta = elementByRole(decision.selected.candidate, 'cta')

    expect(cta.priority).toBe('optional')
    expect(cta.visible).toBe(false)
    expect(decision.selected.criticalCount).toBe(0)
  })

  it('reports missing_required when required CTA is hidden in 200x200 compact formats', () => {
    const target = format('compact-200x200-required-cta', 200, 200, 'small')
    const candidate = selectedFor(target, requiredCtaSource())
    const issues = validateLayoutCandidate(candidate, target)

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'missing_required',
          severity: 'critical',
          elementId: 'cta',
        }),
      ]),
    )
  })

  it('allows optional CTA to be hidden in 145x165 compact mode without critical defects', () => {
    const target = format('compact-145x165', 145, 165, 'small')
    const source = oversizedOptionalCtaSource()
    const decision = selectBestLayoutCandidate(buildCandidateSelectionCandidates(source, target), target)
    const cta = elementByRole(decision.selected.candidate, 'cta')

    expect(cta.priority).toBe('optional')
    expect(cta.visible).toBe(false)
    expect(decision.selected.criticalCount).toBe(0)
  })

  it('reports missing_required when a required CTA is hidden in 145x165 compact mode', () => {
    const target = format('compact-145x165-required-cta', 145, 165, 'small')
    const candidate = selectedFor(target, requiredCtaSource())
    const cta = elementByRole(candidate, 'cta')
    const issues = validateLayoutCandidate(candidate, target)

    expect(cta.priority).toBe('required')
    expect(cta.visible).toBe(false)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'missing_required',
          severity: 'critical',
          elementId: 'cta',
        }),
      ]),
    )
  })
})
