import type { Project } from './types'

export function getActiveImageSrc(
  project: Pick<Project, 'imageSrc' | 'extendedImageByFormat' | 'imageFitDecisionByFormat' | 'master'>,
  formatKey?: string,
): string | null {
  const original = project.imageSrc ?? project.master.image?.src ?? null
  const decision = formatKey ? project.imageFitDecisionByFormat?.[formatKey] : undefined
  if (decision?.usedSource === 'extended' && formatKey) {
    const entry = project.extendedImageByFormat?.[formatKey]
    if (entry?.metadata.changed && entry.imageSrc) return entry.imageSrc
    return original
  }
  return original
}

export function getActiveImageFitMode(
  project: Pick<Project, 'imageFitDecisionByFormat'>,
  formatKey?: string,
): 'cover' | 'contain' {
  const decision = formatKey ? project.imageFitDecisionByFormat?.[formatKey] : undefined
  return decision?.fitMode ?? 'cover'
}
