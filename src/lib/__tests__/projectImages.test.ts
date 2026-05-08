import { describe, expect, it } from 'vitest'
import { newProject } from '../defaults'
import { getActiveImageFitMode, getActiveImageSrc } from '../projectImages'
import type { Project } from '../types'

const baseProject = newProject('project-images-test')
const master = {
  ...baseProject.master,
  image: {
    ...baseProject.master.image!,
    src: 'data:image/png;base64,master',
  },
}

function project(input: Partial<Project>): Pick<Project, 'imageSrc' | 'extendedImageByFormat' | 'imageFitDecisionByFormat' | 'master'> {
  return {
    imageSrc: 'data:image/png;base64,original',
    extendedImageByFormat: {},
    imageFitDecisionByFormat: {},
    master,
    ...input,
  }
}

describe('getActiveImageSrc', () => {
  it('uses the original image when there is no decision', () => {
    expect(getActiveImageSrc(project({}), 'vk-square')).toBe('data:image/png;base64,original')
  })

  it('uses the per-format extended image only when the decision selects it', () => {
    expect(getActiveImageSrc(project({
      imageFitDecisionByFormat: {
        'vk-square': {
          usedSource: 'extended',
          fitMode: 'cover',
          objectFullyVisible: true,
          objectCropped: false,
          reason: 'extended-cover-ok',
        },
      },
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

  it('falls back to the original image when a decision selects extended but the format has no extension', () => {
    expect(getActiveImageSrc(project({
      imageFitDecisionByFormat: {
        'telegram-story': {
          usedSource: 'extended',
          fitMode: 'cover',
          objectFullyVisible: true,
          objectCropped: false,
          reason: 'extended-cover-ok',
        },
      },
    }), 'telegram-story')).toBe('data:image/png;base64,original')
  })

  it('falls back to the original image when the selected extension was not changed', () => {
    expect(getActiveImageSrc(project({
      imageFitDecisionByFormat: {
        'vk-square': {
          usedSource: 'extended',
          fitMode: 'cover',
          objectFullyVisible: true,
          objectCropped: false,
          reason: 'extended-cover-ok',
        },
      },
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

  it('does not use legacy useExtendedImage state as a source decision', () => {
    expect(getActiveImageSrc({
      ...project({}),
      useExtendedImage: true,
      extendedImageSrc: 'data:image/png;base64,legacy',
    } as Project, 'vk-square')).toBe('data:image/png;base64,original')
  })

  it('getActiveImageSrc only reads stored decision and does not mutate extension metadata', () => {
    const metadata = {
      changed: true,
      reason: 'extended',
      originalSize: { width: 100, height: 100 },
      extendedSize: { width: 120, height: 120 },
      targetFormatKey: 'vk-square',
      drawScaleX: 1,
      drawScaleY: 1,
      backgroundUniformity: 1,
    } as const
    const p = project({
      imageFitDecisionByFormat: {
        'vk-square': {
          usedSource: 'extended',
          fitMode: 'cover',
          objectFullyVisible: true,
          objectCropped: false,
          reason: 'extended-cover-ok',
        },
      },
      extendedImageByFormat: {
        'vk-square': {
          imageSrc: 'data:image/png;base64,extended-square',
          metadata,
        },
      },
    })

    expect(getActiveImageSrc(p, 'vk-square')).toBe('data:image/png;base64,extended-square')
    expect(p.extendedImageByFormat?.['vk-square']?.metadata).toBe(metadata)
  })
})

describe('getActiveImageFitMode', () => {
  it('uses per-format fit decision when available', () => {
    expect(getActiveImageFitMode(project({
      imageFitDecisionByFormat: {
        'vk-square': {
          usedSource: 'original',
          fitMode: 'contain',
          objectFullyVisible: true,
          objectCropped: false,
          reason: 'forced-contain-object-cropped',
        },
      },
    }), 'vk-square')).toBe('contain')
  })

  it('falls back to cover independently from master image fit', () => {
    expect(getActiveImageFitMode(project({ master: { ...master, image: { ...master.image!, fit: 'contain' } } }), 'vk-square')).toBe('cover')
  })
})
