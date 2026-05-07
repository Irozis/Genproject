import { describe, expect, it } from 'vitest'
import { newProject } from '../defaults'
import { getActiveImageSrc } from '../projectImages'
import type { Project } from '../types'

const baseProject = newProject('project-images-test')
const master = {
  ...baseProject.master,
  image: {
    ...baseProject.master.image!,
    src: 'data:image/png;base64,master',
  },
}

function project(input: Partial<Project>): Pick<Project, 'imageSrc' | 'extendedImageSrc' | 'extendedImageByFormat' | 'useExtendedImage' | 'master'> {
  return {
    imageSrc: 'data:image/png;base64,original',
    extendedImageSrc: 'data:image/png;base64,legacy',
    extendedImageByFormat: {},
    useExtendedImage: false,
    master,
    ...input,
  }
}

describe('getActiveImageSrc', () => {
  it('uses the original image when useExtendedImage is false', () => {
    expect(getActiveImageSrc(project({ useExtendedImage: false }), 'vk-square')).toBe('data:image/png;base64,original')
  })

  it('uses the per-format extended image when enabled and available', () => {
    expect(getActiveImageSrc(project({
      useExtendedImage: true,
      extendedImageByFormat: {
        'vk-square': {
          imageSrc: 'data:image/png;base64,extended-square',
          metadata: {
            changed: true,
            reason: 'extended',
            originalSize: { width: 100, height: 100 },
            extendedSize: { width: 120, height: 120 },
            targetFormatKey: 'vk-square',
            backgroundUniformity: 1,
          },
        },
      },
    }), 'vk-square')).toBe('data:image/png;base64,extended-square')
  })

  it('falls back to the original image when a format has no extension', () => {
    expect(getActiveImageSrc(project({
      useExtendedImage: true,
      extendedImageByFormat: {
        'vk-square': {
          imageSrc: 'data:image/png;base64,extended-square',
          metadata: {
            changed: true,
            reason: 'extended',
            originalSize: { width: 100, height: 100 },
            extendedSize: { width: 120, height: 120 },
            targetFormatKey: 'vk-square',
            backgroundUniformity: 1,
          },
        },
      },
    }), 'telegram-story')).toBe('data:image/png;base64,original')
  })

  it('falls back to the original image when the per-format extension was not changed', () => {
    expect(getActiveImageSrc(project({
      useExtendedImage: true,
      extendedImageByFormat: {
        'vk-square': {
          imageSrc: 'data:image/png;base64,extended-square',
          metadata: {
            changed: false,
            reason: 'no-extension-needed',
            originalSize: { width: 100, height: 100 },
            extendedSize: { width: 100, height: 100 },
            targetFormatKey: 'vk-square',
            backgroundUniformity: 1,
          },
        },
      },
    }), 'vk-square')).toBe('data:image/png;base64,original')
  })

  it('keeps the legacy global fallback only when no format key is requested', () => {
    expect(getActiveImageSrc(project({ useExtendedImage: true }))).toBe('data:image/png;base64,legacy')
  })
})
