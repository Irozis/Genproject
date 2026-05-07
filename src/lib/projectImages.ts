import type { Project } from './types'

export function getActiveImageSrc(project: Pick<Project, 'imageSrc' | 'extendedImageSrc' | 'useExtendedImage'>): string | null {
  if (project.useExtendedImage && project.extendedImageSrc) return project.extendedImageSrc
  return project.imageSrc
}
