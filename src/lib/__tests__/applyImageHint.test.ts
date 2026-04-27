import { describe, expect, it } from 'vitest'
import { applyImageHint } from '../applyImageHint'
import { newProject } from '../defaults'
import type { AssetHint } from '../types'

const hint: AssetHint = {
  width: 1200,
  height: 1200,
  aspectRatio: 1,
  dominantColors: ['#111111', '#ff3300', '#f0f0f0'],
  isDarkBackground: false,
  bottomBandBrightness: 0.42,
}

describe('applyImageHint', () => {
  it('applyImageHint_locked_keeps_palette', () => {
    const p = { ...newProject(), paletteLocked: true }
    const beforePalette = p.brandKit.palette
    const beforeGradient = p.brandKit.gradient
    const beforeBg = p.master.background

    const out = applyImageHint(p, hint)

    expect(out.assetHint).toEqual(hint)
    expect(out.brandKit.palette).toEqual(beforePalette)
    expect(out.brandKit.gradient).toEqual(beforeGradient)
    expect(out.master.background).toEqual(beforeBg)
  })
})
