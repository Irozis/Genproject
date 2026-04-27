import { DEFAULT_BRAND_KIT, DEFAULT_ENABLED, DEFAULT_MASTER } from '../defaults'
import type { BrandKit, EnabledMap, Scene } from '../types'

export const FIXTURE_MASTER: Scene = {
  ...DEFAULT_MASTER,
  image: DEFAULT_MASTER.image
    ? {
        ...DEFAULT_MASTER.image,
        src:
          'data:image/svg+xml;utf8,' +
          encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#777"/></svg>',
          ),
      }
    : undefined,
}

export const FIXTURE_BRAND_KIT: BrandKit = { ...DEFAULT_BRAND_KIT, palette: { ...DEFAULT_BRAND_KIT.palette } }
export const FIXTURE_ENABLED: EnabledMap = { ...DEFAULT_ENABLED }
