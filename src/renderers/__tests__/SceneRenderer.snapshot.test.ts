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

describe('SceneRenderer image fit modes', () => {
  test('contain renders with meet and keeps uniform aspect', () => {
    const scene = {
      ...FIXTURE_MASTER,
      image: {
        ...FIXTURE_MASTER.image!,
        src: 'data:image/png;base64,input',
        x: 0,
        y: 0,
        w: 100,
        h: 100,
        fit: 'contain' as const,
      },
    }
    const html = renderToStaticMarkup(
      createElement(SceneRenderer, {
        scene,
        rules: getFormat('vk-square'),
        displayFont: 'sans-serif',
        textFont: 'sans-serif',
        imageAspectRatio: 2,
      }),
    )

    expect(html).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(html).not.toContain('preserveAspectRatio="none"')
  })

  test('cover path keeps slice semantics', () => {
    const scene = {
      ...FIXTURE_MASTER,
      image: {
        ...FIXTURE_MASTER.image!,
        src: 'data:image/png;base64,input',
        fit: 'cover' as const,
      },
    }
    const html = renderToStaticMarkup(
      createElement(SceneRenderer, {
        scene,
        rules: getFormat('vk-square'),
        displayFont: 'sans-serif',
        textFont: 'sans-serif',
      }),
    )

    expect(html).toContain('preserveAspectRatio="xMidYMid slice"')
    expect(html).not.toContain('preserveAspectRatio="none"')
  })
})
