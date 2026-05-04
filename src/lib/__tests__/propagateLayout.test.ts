import { describe, expect, it } from 'vitest'
import { projectBlockOverride, projectOverrides } from '../propagateLayout'
import { getFormat } from '../formats'

const SQUARE = getFormat('vk-square')
const STORY = getFormat('vk-stories')
const LANDSCAPE = getFormat('vk-landscape')

describe('projectBlockOverride — anchor preservation', () => {
  it('left-anchored title stays anchored to the target left safe edge', () => {
    const src = { x: SQUARE.safeZone.left + 2, y: 50, w: 60 }
    const out = projectBlockOverride(src, SQUARE, STORY, 12)
    // Same offset from safe-left edge in target.
    expect(out.x).toBeCloseTo(STORY.safeZone.left + 2, 1)
  })

  it('right-anchored title moves to the target right safe edge', () => {
    const src = {
      x: 100 - SQUARE.safeZone.right - 30 - 2,
      y: 10,
      w: 30,
    }
    const out = projectBlockOverride(src, SQUARE, STORY, 12)
    const targetSafeRight = 100 - STORY.safeZone.right
    // Block's right edge sits 2% from target safe-right edge (same as source).
    expect(out.x! + out.w!).toBeCloseTo(targetSafeRight - 2, 1)
  })

  it('center-anchored block stays centered in the target', () => {
    const w = 40
    const src = { x: (100 - w) / 2, y: 40, w }
    const out = projectBlockOverride(src, SQUARE, LANDSCAPE, 12)
    // Symmetric distance from both target safe edges.
    const targetSafeLeft = LANDSCAPE.safeZone.left
    const targetSafeRight = 100 - LANDSCAPE.safeZone.right
    const dLeft = out.x! - targetSafeLeft
    const dRight = targetSafeRight - (out.x! + out.w!)
    expect(Math.abs(dLeft - dRight)).toBeLessThan(0.5)
  })

  it('top-anchored block stays anchored to the target top safe edge', () => {
    const src = { x: 30, y: SQUARE.safeZone.top + 1, w: 30, h: 8 }
    const out = projectBlockOverride(src, SQUARE, STORY, 8)
    expect(out.y).toBeCloseTo(STORY.safeZone.top + 1, 1)
  })

  it('bottom-anchored CTA stays anchored to the target bottom safe edge', () => {
    const ctaH = 7
    const src = {
      x: 6,
      y: 100 - SQUARE.safeZone.bottom - ctaH - 0,
      w: 30,
      h: ctaH,
    }
    const out = projectBlockOverride(src, SQUARE, STORY, ctaH)
    const targetSafeBottom = 100 - STORY.safeZone.bottom
    expect(out.y! + (out.h ?? ctaH)).toBeCloseTo(targetSafeBottom, 1)
  })
})

describe('projectBlockOverride — safety', () => {
  it('clamps width to fit inside target safe zone', () => {
    const src = { x: 10, y: 10, w: 99 }
    const out = projectBlockOverride(src, LANDSCAPE, STORY, 8)
    const targetInnerW = 100 - STORY.safeZone.left - STORY.safeZone.right
    expect(out.w!).toBeLessThanOrEqual(targetInnerW + 0.01)
  })

  it('keeps the projected block strictly inside the target safe zone', () => {
    const src = { x: 5, y: 80, w: 30, h: 12 }
    const out = projectBlockOverride(src, SQUARE, STORY, 12)
    expect(out.x!).toBeGreaterThanOrEqual(STORY.safeZone.left - 0.01)
    expect(out.x! + out.w!).toBeLessThanOrEqual(100 - STORY.safeZone.right + 0.01)
    expect(out.y!).toBeGreaterThanOrEqual(STORY.safeZone.top - 0.01)
    expect(out.y! + (out.h ?? 12)).toBeLessThanOrEqual(100 - STORY.safeZone.bottom + 0.01)
  })

  it('does not emit h when source omitted it (preserves auto-grow text blocks)', () => {
    const src = { x: 6, y: 10, w: 60 }
    const out = projectBlockOverride(src, SQUARE, STORY, 12)
    expect(out.h).toBeUndefined()
  })

  it('preserves non-geometry fields (text, fontSize, fill)', () => {
    const src = {
      x: 6,
      y: 10,
      w: 60,
      text: 'Hello',
      fontSize: 8,
      fill: '#FF00AA',
    }
    const out = projectBlockOverride(src, SQUARE, STORY, 12)
    expect(out.text).toBe('Hello')
    expect(out.fontSize).toBe(8)
    expect(out.fill).toBe('#FF00AA')
  })

  it('returns block unchanged (no x/y/w) — nothing to project', () => {
    const src = { fontSize: 7 }
    const out = projectBlockOverride(src, SQUARE, STORY, 12)
    expect(out.fontSize).toBe(7)
    expect(out.x).toBeUndefined()
  })
})

describe('projectOverrides — whole record', () => {
  it('projects every block in the source record', () => {
    const src = {
      title: { x: 6, y: 10, w: 60 },
      cta: { x: 6, y: 78, w: 30, h: 7 },
    }
    const out = projectOverrides(src, SQUARE, STORY)
    expect(out.title).toBeDefined()
    expect(out.cta).toBeDefined()
    expect(out.title!.x).toBeCloseTo(STORY.safeZone.left + (6 - SQUARE.safeZone.left), 1)
  })

  it('skips empty blocks', () => {
    const out = projectOverrides({}, SQUARE, STORY)
    expect(Object.keys(out)).toHaveLength(0)
  })
})
