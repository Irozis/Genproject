import type { Project } from './types'

export function getActiveImageSrc(
  project: Pick<Project, 'imageSrc' | 'extendedImageSrc' | 'extendedImageByFormat' | 'useExtendedImage' | 'master'>,
  formatKey?: string,
): string | null {
  const original = project.imageSrc ?? project.master.image?.src ?? null
  if (project.useExtendedImage && formatKey) {
    const entry = project.extendedImageByFormat?.[formatKey]
    if (entry?.metadata.changed && entry.imageSrc) return entry.imageSrc
    return original
  }
  if (project.useExtendedImage && project.extendedImageSrc) return project.extendedImageSrc
  return original
}
