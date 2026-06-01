import { describe, expect, it } from 'vitest'
import { computeImageFitDecisions } from '../../App'
import { newProject } from '../defaults'
import { getFormat } from '../formats'
import {
  analyzeImageDimensions,
  recommendFormatsForImage,
  selectedStrategyFromRecommendation,
} from '../imageFormatRecommendations'
import type { FormatKey } from '../types'

function recommendationsFor(width: number, height: number, keys: FormatKey[]) {
  const analysis = analyzeImageDimensions(width, height)
  return recommendFormatsForImage(analysis, keys.map((key) => getFormat(key)))
}

describe('image-aware format recommendations', () => {
  it('recommends square and 4:5-like formats for a square image', () => {
    const recs = recommendationsFor(1200, 1200, ['vk-square', 'vk-vertical', 'vk-landscape', 'instagram-story'])
    const top = recs.slice(0, 2).map((item) => item.formatId)

    expect(top).toContain('vk-square')
    expect(recs.find((item) => item.formatId === 'vk-vertical')!.score).toBeGreaterThan(
      recs.find((item) => item.formatId === 'instagram-story')!.score,
    )
  })

  it('recommends wide banners for a horizontal image', () => {
    const recs = recommendationsFor(1600, 900, ['vk-landscape', 'yandex-rsy-728x90', 'vk-square', 'instagram-story'])
    const top = recs.slice(0, 2).map((item) => item.formatId)

    expect(top).toContain('vk-landscape')
    expect(recs.find((item) => item.formatId === 'instagram-story')!.level).toMatch(/risky|not_recommended/)
  })

  it('recommends stories and vertical cards for a vertical image', () => {
    const recs = recommendationsFor(900, 1600, ['instagram-story', 'vk-vertical', 'vk-landscape', 'yandex-rsy-728x90'])
    const top = recs.slice(0, 2).map((item) => item.formatId)

    expect(top).toContain('instagram-story')
    expect(recs.find((item) => item.formatId === 'yandex-rsy-728x90')!.level).toMatch(/risky|not_recommended/)
  })

  it('marks strongly mismatched aspect ratios as risky and avoids hero mode for micro banners', () => {
    const recs = recommendationsFor(900, 1600, ['yandex-rsy-728x90'])
    const banner = recs[0]!

    expect(banner.level).toMatch(/risky|not_recommended/)
    expect(banner.recommendedImageMode).toBe('thumbnail')
  })

  it('stores selected recommendation metadata and uses it for image fit decisions', () => {
    const analysis = analyzeImageDimensions(900, 1600)
    const recommendation = recommendFormatsForImage(analysis, [getFormat('yandex-rsy-728x90')])[0]!
    const strategy = selectedStrategyFromRecommendation(recommendation)
    const project = {
      ...newProject('strategy'),
      imageSrc: 'data:image/png;base64,img',
      selectedFormats: ['yandex-rsy-728x90'] as FormatKey[],
      imageAnalysis: analysis,
      selectedFormatImageStrategy: {
        'yandex-rsy-728x90': strategy,
      },
      backgroundExtensionByFormat: {
        'yandex-rsy-728x90': {
          changed: false,
          reason: 'test',
          originalSize: { width: 900, height: 1600 },
          extendedSize: { width: 900, height: 1600 },
          backgroundUniformity: 0,
        },
      },
    }

    expect(strategy.formatId).toBe('yandex-rsy-728x90')
    expect(strategy.recommendedImageMode).toBe('thumbnail')
    expect(computeImageFitDecisions(project)['yandex-rsy-728x90']?.fitMode).toBe('contain')
  })
})
