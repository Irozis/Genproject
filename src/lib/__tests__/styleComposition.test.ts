import { describe, expect, it } from 'vitest'
import { buildScene } from '../buildScene'
import { getFormat } from '../formats'
import { applyStyleSettingsToScene, normalizeCompositionSettings } from '../styleSettings'
import { DEFAULT_ENABLED } from '../defaults'
import { testBrandLight, testContentShort } from '../../test/fixtures'

describe('composition spacing settings', () => {
  it('applies density, padding, and group gap through layout groups', () => {
    const format = getFormat('vk-square')
    const base = buildScene(testContentShort, 'vk-square', testBrandLight, DEFAULT_ENABLED)
    const dense = applyStyleSettingsToScene(base, format, undefined, normalizeCompositionSettings({
      density: 'compact',
      canvasPaddingScale: 0.82,
      groupGapScale: 0.72,
      titleBodyGap: 0.75,
      bodyCtaGap: 0.75,
    }))
    const airy = applyStyleSettingsToScene(base, format, undefined, normalizeCompositionSettings({
      density: 'airy',
      canvasPaddingScale: 1.2,
      groupGapScale: 1.3,
      titleBodyGap: 1.4,
      bodyCtaGap: 1.4,
    }))

    expect(dense.title?.x).not.toBe(airy.title?.x)
    expect((airy.subtitle?.y ?? 0) - (airy.title?.y ?? 0)).toBeGreaterThan((dense.subtitle?.y ?? 0) - (dense.title?.y ?? 0))
    expect(airy.cta?.y).not.toBe(dense.cta?.y)
  })

  it('does not synthesize spacing targets for missing objects', () => {
    const format = getFormat('vk-square')
    const scene = buildScene(testContentShort, 'vk-square', testBrandLight, { ...DEFAULT_ENABLED, logo: false, image: false, subtitle: false })
    const styled = applyStyleSettingsToScene(scene, format, undefined, normalizeCompositionSettings({
      logoTitleGap: 2,
      imageTextGap: 2,
      titleBodyGap: 2,
    }))

    expect(styled.logo).toBeUndefined()
    expect(styled.image).toBeUndefined()
    expect(styled.subtitle).toBeUndefined()
    expect(styled.title).toBeDefined()
    expect(styled.cta).toBeDefined()
  })
})
