import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { SceneRenderer } from '../SceneRenderer'
import { buildScene } from '../../lib/buildScene'
import { getFormat } from '../../lib/formats'
import { FIXTURE_BRAND_KIT, FIXTURE_ENABLED, FIXTURE_MASTER } from '../../lib/__tests__/fixtures'
import type { CompositionModel, FormatKey, VisualSystemKey } from '../../lib/types'

const combos: Array<[VisualSystemKey, FormatKey, CompositionModel]> = [
  ['product-card', 'vk-square', 'split-right-image'],
  ['product-card', 'vk-landscape', 'split-right-image'],
  ['product-card', 'wb-card', 'image-top-text-bottom'],
  ['product-card', 'instagram-story', 'hero-overlay'],
  ['minimal', 'yandex-market-card', 'hero-overlay'],
  ['minimal', 'ozon-fresh-square', 'split-right-image'],
  ['minimal', 'yandex-market-banner', 'text-dominant'],
  ['minimal', 'telegram-story', 'image-top-text-bottom'],
  ['bold-editorial', 'vk-square', 'text-dominant'],
  ['bold-editorial', 'vk-stories', 'hero-overlay'],
  ['bold-editorial', 'avito-listing', 'split-right-image'],
  ['bold-editorial', 'yandex-rsy-240x400', 'image-top-text-bottom'],
]

describe('SceneRenderer snapshots', () => {
  for (const [vs, fmt, model] of combos) {
    test(`snapshot ${vs} x ${fmt} x ${model}`, () => {
      const scene = buildScene(FIXTURE_MASTER, fmt, FIXTURE_BRAND_KIT, FIXTURE_ENABLED, { override: model })
      const html = renderToStaticMarkup(
        createElement(SceneRenderer, {
          scene,
          rules: getFormat(fmt),
          displayFont: 'sans-serif',
          textFont: 'sans-serif',
          brandInitials: 'AG',
          brandColor: '#000000',
        }),
      )
      expect(html).toMatchSnapshot()
    })
  }
})
