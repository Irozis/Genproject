import { describe, expect, it } from 'vitest'
import { runCompliance } from '../compliance'
import { getFormat } from '../formats'
import { DEFAULT_BRAND_KIT } from '../defaults'
import type { FormatRuleSet, Scene } from '../types'

const format = getFormat('yandex-market-banner')

function checkStatus(scene: Scene, rule: string): 'pass' | 'warn' | 'fail' {
  const result = runCompliance(scene, format, DEFAULT_BRAND_KIT)
  const check = result.checks.find((item) => item.rule === rule)
  if (!check) throw new Error(`Missing check: ${rule}`)
  return check.status
}

describe('runCompliance', () => {
  it('all pass', () => {
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#FF0000',
      title: {
        text: 'Title',
        x: 10, y: 10, w: 60, h: 12,
        fontSize: 7, charsPerLine: 18, maxLines: 2,
        weight: 800, fill: '#111111',
      },
      cta: {
        text: 'Buy',
        x: 10, y: 30, w: 24, h: 10,
        fontSize: 4, charsPerLine: 12, maxLines: 1,
        weight: 700, fill: '#111111',
        bg: '#FF0000', rx: 12,
      },
    }

    const result = runCompliance(scene, format, DEFAULT_BRAND_KIT)
    expect(result.checks.every((c) => c.status === 'pass')).toBe(true)
  })

  it('contrast fail', () => {
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#FF0000',
      title: {
        text: 'Low contrast',
        x: 10, y: 10, w: 60, h: 12,
        fontSize: 7, charsPerLine: 18, maxLines: 2,
        weight: 800, fill: '#F9F9F9',
      },
      cta: {
        text: 'Buy',
        x: 10, y: 30, w: 24, h: 10,
        fontSize: 4, charsPerLine: 12, maxLines: 1,
        weight: 700, fill: '#111111',
        bg: '#FF0000', rx: 12,
      },
    }

    expect(checkStatus(scene, 'WCAG AA contrast')).toBe('fail')
  })

  it('missing element', () => {
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#FF0000',
      title: {
        text: 'Only title',
        x: 10, y: 10, w: 60, h: 12,
        fontSize: 7, charsPerLine: 18, maxLines: 2,
        weight: 800, fill: '#111111',
      },
    }

    expect(checkStatus(scene, 'required elements')).toBe('fail')
  })

  it('detects text and CTA outside canvas', () => {
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#FF0000',
      title: {
        text: 'Outside',
        x: 96, y: 10, w: 20, h: 12,
        fontSize: 7, charsPerLine: 18, maxLines: 2,
        weight: 800, fill: '#111111',
      },
      cta: {
        text: 'Buy',
        x: 10, y: 96, w: 24, h: 10,
        fontSize: 4, charsPerLine: 12, maxLines: 1,
        weight: 700, fill: '#111111',
        bg: '#FF0000', rx: 12,
      },
    }

    expect(checkStatus(scene, 'overflow')).toBe('fail')
  })

  it('detects safe area and overlay zone violations', () => {
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#FF0000',
      title: {
        text: 'Unsafe',
        x: 0, y: 0, w: 24, h: 8,
        fontSize: 5, charsPerLine: 12, maxLines: 1,
        weight: 800, fill: '#111111',
      },
      cta: {
        text: 'Buy',
        x: 84, y: 1, w: 14, h: 8,
        fontSize: 4, charsPerLine: 12, maxLines: 1,
        weight: 700, fill: '#111111',
        bg: '#FF0000', rx: 12,
      },
    }

    expect(checkStatus(scene, 'safe zone')).toBe('fail')
    const overlayResult = runCompliance(scene, getFormat('ozon-card'), DEFAULT_BRAND_KIT)
    expect(overlayResult.checks.find((item) => item.rule === 'overlay zones')?.status).toBe('fail')
  })

  it('reports platform text limit and estimated export size warnings', () => {
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#FF0000',
      title: {
        text: 'A very long marketplace title that exceeds the practical platform limits for this placement',
        x: 10, y: 10, w: 60, h: 12,
        fontSize: 7, charsPerLine: 18, maxLines: 1,
        weight: 800, fill: '#111111',
      },
      cta: {
        text: 'Buy',
        x: 10, y: 30, w: 24, h: 10,
        fontSize: 4, charsPerLine: 12, maxLines: 1,
        weight: 700, fill: '#111111',
        bg: '#FF0000', rx: 12,
      },
    }

    const constrainedFormat: FormatRuleSet = {
      ...format,
      textLimits: { titleMaxChars: 24, descriptionMaxChars: 24 },
      maxFileSizeKb: 1,
    }
    const result = runCompliance(scene, constrainedFormat, DEFAULT_BRAND_KIT)

    expect(['warn', 'fail']).toContain(result.checks.find((item) => item.rule === 'platform text limits')?.status)
    expect(result.checks.find((item) => item.rule === 'estimated export size')?.status).toBe('warn')
  })

  it('keeps internal safe zone failures out of official errors without official source', () => {
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#FF0000',
      title: {
        text: 'Unsafe',
        x: 0, y: 0, w: 24, h: 8,
        fontSize: 5, charsPerLine: 12, maxLines: 1,
        weight: 800, fill: '#111111',
      },
      cta: {
        text: 'Buy',
        x: 84, y: 1, w: 14, h: 8,
        fontSize: 4, charsPerLine: 12, maxLines: 1,
        weight: 700, fill: '#111111',
        bg: '#FF0000', rx: 12,
      },
    }

    const result = runCompliance(scene, format, DEFAULT_BRAND_KIT)

    expect(result.checks.find((item) => item.rule === 'safe zone')?.status).toBe('fail')
    expect(result.officialErrors.some((item) => item.code === 'officialSafeZoneViolation')).toBe(false)
  })

  it('promotes safe zone failures to official errors only when the rule source is official', () => {
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#FF0000',
      title: {
        text: 'Unsafe',
        x: 0, y: 0, w: 24, h: 8,
        fontSize: 5, charsPerLine: 12, maxLines: 1,
        weight: 800, fill: '#111111',
      },
      cta: {
        text: 'Buy',
        x: 84, y: 1, w: 14, h: 8,
        fontSize: 4, charsPerLine: 12, maxLines: 1,
        weight: 700, fill: '#111111',
        bg: '#FF0000', rx: 12,
      },
    }
    const officialFormat: FormatRuleSet = {
      ...format,
      ruleSources: format.ruleSources
        ? {
            ...format.ruleSources,
            safeArea: { type: 'official', name: 'Test official safe area' },
          }
        : undefined,
    }

    const result = runCompliance(scene, officialFormat, DEFAULT_BRAND_KIT)

    expect(result.officialErrors.some((item) => item.code === 'officialSafeZoneViolation')).toBe(true)
  })

  it('separates layout warnings from heuristic source warnings', () => {
    const scene: Scene = {
      background: { kind: 'gradient', stops: ['#FFFFFF', '#F4F4F4', '#FFFFFF'] },
      accent: '#FF0000',
      image: {
        src: null,
        x: 82, y: 10, w: 8, h: 20,
        rx: 8, fit: 'cover',
      },
      title: {
        text: 'Wide text',
        x: 8, y: 12, w: 72, h: 12,
        fontSize: 2.6, charsPerLine: 18, maxLines: 1,
        weight: 800, fill: '#111111',
      },
      cta: {
        text: 'Buy',
        x: 8, y: 72, w: 18, h: 9,
        fontSize: 4, charsPerLine: 12, maxLines: 1,
        weight: 700, fill: '#111111',
        bg: '#FF0000', rx: 12,
      },
      layoutPolicy: {
        formatKind: 'horizontal',
        source: { type: 'heuristic', name: 'Test layout policy' },
        appliedRules: ['demo-safe-layout-policy', 'manual-review-fallback'],
        needsManualReview: true,
      },
    }

    const result = runCompliance(scene, getFormat('yandex-rsy-728x90'), DEFAULT_BRAND_KIT)

    expect(result.layoutWarnings.map((item) => item.code)).toEqual(
      expect.arrayContaining(['imageTooSmall', 'splitImageTooSmall', 'splitCollapsedToTextOnly', 'largeEmptyAreaDetected', 'textTooSmall', 'layoutFallbackApplied', 'horizontalModeNeedsCompactFallback']),
    )
    expect(result.heuristicWarnings.map((item) => item.code)).toEqual(
      expect.arrayContaining(['heuristicRuleApplied', 'derivedRuleApplied', 'needsManualReview', 'layoutNotOfficiallySpecified', 'percentageRegionsAreInternalModel', 'gradientRuleIsHeuristic']),
    )
    expect(result.officialErrors).toEqual([])
  })

  it('warns when vertical CTA is detached from the text block', () => {
    const scene: Scene = {
      background: { kind: 'solid', color: '#FFFFFF' },
      accent: '#FF0000',
      image: {
        src: null,
        x: 0, y: 0, w: 100, h: 48,
        rx: 0, fit: 'cover',
      },
      title: {
        text: 'Story',
        x: 8, y: 54, w: 84, h: 12,
        fontSize: 6, charsPerLine: 18, maxLines: 2,
        weight: 800, fill: '#111111',
      },
      cta: {
        text: 'Buy',
        x: 8, y: 92, w: 28, h: 8,
        fontSize: 4, charsPerLine: 12, maxLines: 1,
        weight: 700, fill: '#111111',
        bg: '#FF0000', rx: 12,
      },
      layoutPolicy: {
        formatKind: 'vertical',
        source: { type: 'heuristic', name: 'Test layout policy' },
        appliedRules: ['demo-safe-layout-policy'],
      },
    }

    const result = runCompliance(scene, getFormat('instagram-story'), DEFAULT_BRAND_KIT)

    expect(result.layoutWarnings.some((item) => item.code === 'ctaDetachedFromText')).toBe(true)
  })

  it('maps check statuses to ready, warning, and error buckets', () => {
    expect(toValidatorStatus('pass')).toBe('ready')
    expect(toValidatorStatus('warn')).toBe('warning')
    expect(toValidatorStatus('fail')).toBe('error')
  })
})

function toValidatorStatus(status: 'pass' | 'warn' | 'fail'): 'ready' | 'warning' | 'error' {
  if (status === 'pass') return 'ready'
  if (status === 'warn') return 'warning'
  return 'error'
}
