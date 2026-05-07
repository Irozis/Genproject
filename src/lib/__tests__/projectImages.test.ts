import { describe, expect, it } from 'vitest'
import { getActiveImageSrc } from '../projectImages'

describe('getActiveImageSrc', () => {
  it('uses the original image when useExtendedImage is false', () => {
    expect(getActiveImageSrc({
      imageSrc: 'data:image/png;base64,original',
      extendedImageSrc: 'data:image/png;base64,extended',
      useExtendedImage: false,
    })).toBe('data:image/png;base64,original')
  })

  it('uses the extended image when enabled and available', () => {
    expect(getActiveImageSrc({
      imageSrc: 'data:image/png;base64,original',
      extendedImageSrc: 'data:image/png;base64,extended',
      useExtendedImage: true,
    })).toBe('data:image/png;base64,extended')
  })

  it('falls back to the original image when the extended image is missing', () => {
    expect(getActiveImageSrc({
      imageSrc: 'data:image/png;base64,original',
      extendedImageSrc: null,
      useExtendedImage: true,
    })).toBe('data:image/png;base64,original')
  })
})
