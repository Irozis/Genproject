import { DEFAULT_BRAND_KIT, DEFAULT_MASTER } from '../lib/defaults'
import { sceneToSourceMaterialV2 } from './adapters'
import type { SourceMaterialV2 } from './types'

type BrandLike = {
  primaryColor?: string
  secondaryColor?: string
  fontFamily?: string
  [key: string]: unknown
}

function adaptBrand(brand: unknown): SourceMaterialV2['brand'] {
  if (typeof brand !== 'object' || brand === null) {
    return undefined
  }

  const candidate = brand as BrandLike

  return {
    primaryColor: typeof candidate.primaryColor === 'string' ? candidate.primaryColor : undefined,
    secondaryColor: typeof candidate.secondaryColor === 'string' ? candidate.secondaryColor : undefined,
    fontFamily: typeof candidate.fontFamily === 'string' ? candidate.fontFamily : undefined,
  }
}

export function getDefaultProjectSourceMaterial(): SourceMaterialV2 {
  const source = sceneToSourceMaterialV2(DEFAULT_MASTER, {
    id: 'default-project-source',
    sourceWidth: 1080,
    sourceHeight: 1080,
  })

  return {
    ...source,
    brand: adaptBrand(DEFAULT_BRAND_KIT),
    metadata: {
      ...source.metadata,
      source: 'DEFAULT_MASTER',
      adapter: 'getDefaultProjectSourceMaterial',
    },
  }
}