import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { SceneRenderer } from '../SceneRenderer'
import { buildScene } from '../../lib/buildScene'
import { getFormat } from '../../lib/formats'
import { FIXTURE_BRAND_KIT, FIXTURE_ENABLED, FIXTURE_MASTER } from '../../lib/__tests__/fixtures'
import type { CompositionModel, FormatKey, VisualSystemKey } from '../../lib/types'

const combos: Array<[VisualSystemKey, FormatKey, CompositionModel]> = [
  ['product-card', 'marketplace-card', 'split-right-image'],
  ['product-card', 'social-square', 'text-dominant'],
  ['product-card', 'marketplace-highlight', 'image-top-text-bottom'],
  ['product-card', 'story-vertical', 'hero-overlay'],
  ['minimal', 'marketplace-card', 'hero-overlay'],
  ['minimal', 'social-square', 'split-right-image'],
  ['minimal', 'marketplace-highlight', 'text-dominant'],
  ['minimal', 'story-vertical', 'image-top-text-bottom'],
  ['bold-editorial', 'marketplace-card', 'text-dominant'],
  ['bold-editorial', 'social-square', 'hero-overlay'],
  ['bold-editorial', 'marketplace-highlight', 'split-right-image'],
  ['bold-editorial', 'story-vertical', 'image-top-text-bottom'],
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
