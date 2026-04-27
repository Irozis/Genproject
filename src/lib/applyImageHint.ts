import { paletteFromHint } from './paletteFromImage'
import type { AssetHint, Project } from './types'

// Derive brand colors + gradient from an analyzed image and fold them into
// the project. One code path for both onboarding-by-reference and mid-session
// image uploads, so the background+accent are always consistent with the photo.
export function applyImageHint(p: Project, hint: AssetHint): Project {
  if (hint.dominantColors.length === 0) return { ...p, assetHint: hint }
  if (p.paletteLocked) {
    return { ...p, assetHint: hint }
  }
  const derived = paletteFromHint(hint, {
    palette: p.brandKit.palette,
    gradient: p.brandKit.gradient,
  })
  return {
    ...p,
    assetHint: hint,
    brandKit: {
      ...p.brandKit,
      palette: derived.palette,
      gradient: derived.gradient,
    },
    master: {
      ...p.master,
      background: { kind: 'gradient', stops: derived.gradient },
      accent: derived.palette.accent,
    },
  }
}
