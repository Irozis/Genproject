import { describe, expect, it } from 'vitest'
import { runCompliance } from '../compliance'
import { getFormat } from '../formats'
import { DEFAULT_BRAND_KIT } from '../defaults'
import type { Scene } from '../types'

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
})
