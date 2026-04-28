import { contrastRatio } from './color'
import { checkOverflow } from './fixLayout'
import type { BrandKit, FormatRuleSet, Scene } from './types'

export type Check = {
  rule: string
  status: 'pass' | 'warn' | 'fail'
  detail?: string
}

export type ComplianceEntry = {
  formatId: string
  locale: string
  checks: Check[]
}

type SceneWithBlocks = Scene & {
  blocks?: Array<{ id?: string; x?: number; y?: number; w?: number; h?: number }>
  frame?: { x?: number; y?: number; w?: number; h?: number }
}

export function runCompliance(scene: Scene, format: FormatRuleSet, brand: BrandKit): ComplianceEntry {
  const sceneInput = scene as SceneWithBlocks
  const checks: Check[] = []

  const safeZoneIssues = checkOverflow(scene, format).filter((issue) => /safe area/.test(issue.message))
  checks.push({
    rule: 'safe zone',
    status: safeZoneIssues.length > 0 ? 'fail' : 'pass',
    detail: safeZoneIssues.length > 0 ? safeZoneIssues.map((issue) => issue.message).join('; ') : undefined,
  })

  const bg = approximateBackgroundColor(scene, brand)
  const textBlocks = [scene.title, scene.subtitle, scene.badge, scene.cta].filter(
    (block): block is NonNullable<typeof block> => !!block,
  )
  const ratios = textBlocks.map((block) => contrastRatio(block.fill, bg))
  const minRatio = ratios.length > 0 ? Math.min(...ratios) : 21
  checks.push({
    rule: 'WCAG AA contrast',
    status: minRatio < 3 ? 'fail' : minRatio < 4.5 ? 'warn' : 'pass',
    detail: `min ratio ${minRatio.toFixed(2)} (thresholds: fail < 3.0, warn < 4.5, pass >= 4.5)`,
  })

  const presentIds = collectPresentBlockIds(sceneInput)
  const missing = format.requiredElements.filter((required) => !presentIds.has(required))
  checks.push({
    rule: 'required elements',
    status: missing.length > 0 ? 'fail' : 'pass',
    detail: missing.length > 0 ? `missing: ${missing.join(', ')}` : undefined,
  })

  const overflowBlocks = getOverflowingBlocks(sceneInput)
  checks.push({
    rule: 'overflow',
    status: overflowBlocks.length > 0 ? 'fail' : 'pass',
    detail: overflowBlocks.length > 0 ? `out of frame: ${overflowBlocks.join(', ')}` : undefined,
  })

  return {
    formatId: format.key,
    locale: 'default',
    checks,
  }
}

function approximateBackgroundColor(scene: Scene, brand: BrandKit): string {
  const bg = scene.background
  if (bg.kind === 'solid') return bg.color
  if (bg.kind === 'gradient') return bg.stops[1]
  if (bg.kind === 'tonal') return bg.base
  if (bg.kind === 'split') return bg.a
  return brand.palette.surface
}

function collectPresentBlockIds(scene: SceneWithBlocks): Set<string> {
  const ids = new Set<string>()

  for (const id of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    if (scene[id]) ids.add(id)
  }

  for (const block of scene.blocks ?? []) {
    if (block.id) ids.add(block.id)
  }

  return ids
}

function getOverflowingBlocks(scene: SceneWithBlocks): string[] {
  const frame = scene.frame ?? { x: 0, y: 0, w: 100, h: 100 }
  const fx = frame.x ?? 0
  const fy = frame.y ?? 0
  const fw = frame.w ?? 100
  const fh = frame.h ?? 100
  const right = fx + fw
  const bottom = fy + fh
  const overflow: string[] = []

  const namedBlocks: Array<{ id: string; x: number; y: number; w: number; h: number }> = []
  for (const id of ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const) {
    const block = scene[id]
    if (!block) continue
    namedBlocks.push({ id, x: block.x, y: block.y, w: block.w, h: block.h ?? 0 })
  }
  for (const block of scene.blocks ?? []) {
    if (!block.id) continue
    namedBlocks.push({
      id: block.id,
      x: block.x ?? 0,
      y: block.y ?? 0,
      w: block.w ?? 0,
      h: block.h ?? 0,
    })
  }

  for (const block of namedBlocks) {
    const blockRight = block.x + block.w
    const blockBottom = block.y + block.h
    if (block.x < fx || block.y < fy || blockRight > right || blockBottom > bottom) {
      overflow.push(block.id)
    }
  }

  return Array.from(new Set(overflow))
}
