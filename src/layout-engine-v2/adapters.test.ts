import { describe, expect, it } from 'vitest'
import {
  formatRuleSetToFormatSpecV2,
  projectToSourceMaterialV2,
  sceneToSourceMaterialV2,
} from './adapters'
import { generateLayoutCandidates } from './generateCandidates'
import { runResearch } from './runResearch'

const legacyScene = {
  background: { x: 0, y: 0, w: 100, h: 100, visible: true },
  image: { x: 52, y: 16, w: 40, h: 58, visible: true },
  title: {
    x: 8,
    y: 16,
    w: 48,
    h: 18,
    visible: true,
    text: 'Adapted headline',
    fontSize: 5.5,
  },
  subtitle: {
    x: 8,
    y: 38,
    w: 46,
    h: 10,
    visible: true,
    text: 'Adapted subtitle',
    fontSize: 2.8,
  },
  cta: {
    x: 8,
    y: 54,
    w: 24,
    h: 8,
    visible: true,
    text: 'Open',
    fontSize: 2.6,
  },
  logo: { x: 8, y: 82, w: 16, h: 7, visible: true },
}

describe('layout-engine-v2 adapters', () => {
  it('adapts a legacy scene to SourceMaterialV2', () => {
    const source = sceneToSourceMaterialV2(legacyScene, {
      id: 'legacy-scene',
      sourceWidth: 1080,
      sourceHeight: 1080,
    })

    expect(source.id).toBe('legacy-scene')
    expect(source.elements.some((element) => element.role === 'background')).toBe(true)
    expect(source.elements.some((element) => element.role === 'headline')).toBe(true)
    expect(source.elements.find((element) => element.id === 'headline')?.text).toBe('Adapted headline')

    for (const element of source.elements) {
      expect(element.rect.width).toBeGreaterThan(0)
      expect(element.rect.height).toBeGreaterThan(0)
    }
  })

  it('adapts a project-like object to SourceMaterialV2 with brand data', () => {
    const source = projectToSourceMaterialV2({
      id: 'project-1',
      master: legacyScene,
      brandKit: {
        primaryColor: '#111111',
        secondaryColor: '#eeeeee',
        fontFamily: 'Inter',
      },
    })

    expect(source.id).toBe('project-1')
    expect(source.brand?.primaryColor).toBe('#111111')
    expect(source.brand?.secondaryColor).toBe('#eeeeee')
    expect(source.brand?.fontFamily).toBe('Inter')
  })

  it('throws when project has no usable scene field', () => {
    expect(() => projectToSourceMaterialV2({ id: 'empty' })).toThrow(/no master\/masterScene\/scene/)
  })

  it('adapts a horizontal legacy format to FormatSpecV2', () => {
    const format = formatRuleSetToFormatSpecV2({
      id: 'legacy-horizontal',
      name: 'Legacy Horizontal',
      width: 1200,
      height: 628,
      safeArea: { top: 40, right: 56, bottom: 40, left: 56 },
    })

    expect(format.id).toBe('legacy-horizontal')
    expect(format.name).toBe('Legacy Horizontal')
    expect(format.width).toBe(1200)
    expect(format.height).toBe(628)
    expect(format.group).toBe('horizontal')
    expect(format.safeArea.left).toBe(56)
  })

  it('derives small, wide, logo, vertical and square groups from dimensions', () => {
    expect(formatRuleSetToFormatSpecV2({ width: 320, height: 50 }).group).toBe('small')
    expect(formatRuleSetToFormatSpecV2({ width: 728, height: 90 }).group).toBe('wide')
    expect(formatRuleSetToFormatSpecV2({ width: 200, height: 200 }).group).toBe('logo')
    expect(formatRuleSetToFormatSpecV2({ width: 1080, height: 1920 }).group).toBe('vertical')
    expect(formatRuleSetToFormatSpecV2({ width: 1080, height: 1080 }).group).toBe('square')
  })

  it('adapted data can be used by candidate generation', () => {
    const source = sceneToSourceMaterialV2(legacyScene, {
      id: 'legacy-scene',
      sourceWidth: 1080,
      sourceHeight: 1080,
    })
    const format = formatRuleSetToFormatSpecV2({
      id: 'legacy-horizontal',
      width: 1200,
      height: 628,
    })

    const candidates = generateLayoutCandidates(source, format)

    expect(candidates.length).toBeGreaterThan(0)
  })

  it('adapted data can be used by research mode', () => {
    const source = sceneToSourceMaterialV2(legacyScene, {
      id: 'legacy-scene',
      sourceWidth: 1080,
      sourceHeight: 1080,
    })
    const formats = [
      formatRuleSetToFormatSpecV2({ id: 'format-1', width: 1200, height: 628 }),
      formatRuleSetToFormatSpecV2({ id: 'format-2', width: 320, height: 50 }),
    ]

    const result = runResearch({
      source,
      formats,
      methods: ['candidateSelection'],
    })

    expect(result.projectId).toBe('legacy-scene')
    expect(result.formatCount).toBe(2)
    expect(result.reports).toHaveLength(2)
    expect(result.summary[0]?.method).toBe('candidateSelection')
  })
})