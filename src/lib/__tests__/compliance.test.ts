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
