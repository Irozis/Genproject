import type { AdOverlayZone, AdSafeArea, AdVisibleArea, FormatRuleSet } from './types'

export type PercentRect = { x: number; y: number; w: number; h: number }

export function safeAreaToPercentRect(format: FormatRuleSet): PercentRect {
  const safe = format.safeArea
  if (!safe) {
    const sz = format.safeZone
    return { x: sz.left, y: sz.top, w: 100 - sz.left - sz.right, h: 100 - sz.top - sz.bottom }
  }
  const edge = safeAreaToPercentEdges(safe, format.width, format.height)
  return { x: edge.left, y: edge.top, w: 100 - edge.left - edge.right, h: 100 - edge.top - edge.bottom }
}

export function safeAreaToPercentEdges(
  safe: AdSafeArea,
  width: number,
  height: number,
): { top: number; right: number; bottom: number; left: number } {
  if (safe.unit === 'percent') {
    return { top: safe.top, right: safe.right, bottom: safe.bottom, left: safe.left }
  }
  return {
    top: (safe.top / height) * 100,
    right: (safe.right / width) * 100,
    bottom: (safe.bottom / height) * 100,
    left: (safe.left / width) * 100,
  }
}

export function visibleAreaToPercentRect(format: FormatRuleSet): PercentRect | null {
  return format.visibleArea ? areaToPercentRect(format.visibleArea, format.width, format.height) : null
}

export function overlayZoneToPercentRect(zone: AdOverlayZone, format: FormatRuleSet): PercentRect | null {
  const w = zone.width ?? 0
  const h = zone.height ?? 0
  if (w <= 0 || h <= 0) return null
  const widthPct = zone.unit === 'percent' ? w : (w / format.width) * 100
  const heightPct = zone.unit === 'percent' ? h : (h / format.height) * 100
  const pos = zone.position
  const rawX = zone.x
  const rawY = zone.y
  let x = rawX !== undefined ? (zone.unit === 'percent' ? rawX : (rawX / format.width) * 100) : 0
  let y = rawY !== undefined ? (zone.unit === 'percent' ? rawY : (rawY / format.height) * 100) : 0

  if (pos === 'top-right') {
    x = rawX === undefined || rawX === 100 ? 100 - widthPct : x
    y = rawY === undefined ? 0 : y
  } else if (pos === 'top-left') {
    x = rawX === undefined ? 0 : x
    y = rawY === undefined ? 0 : y
  } else if (pos === 'bottom' || pos === 'bottom-right') {
    y = rawY === undefined || rawY === 100 ? 100 - heightPct : y
    if (pos === 'bottom') x = rawX === undefined ? 0 : x
    else x = rawX === undefined || rawX === 100 ? 100 - widthPct : x
  } else if (pos === 'center') {
    x = rawX === undefined ? 50 - widthPct / 2 : x
    y = rawY === undefined ? 50 - heightPct / 2 : y
  }

  return clampRect({ x, y, w: widthPct, h: heightPct })
}

export function rectsOverlap(a: PercentRect, b: PercentRect, pad = 0): boolean {
  return (
    a.x + a.w - pad > b.x &&
    b.x + b.w - pad > a.x &&
    a.y + a.h - pad > b.y &&
    b.y + b.h - pad > a.y
  )
}

export function rectInside(inner: PercentRect, outer: PercentRect, tolerance = 0): boolean {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.w <= outer.x + outer.w + tolerance &&
    inner.y + inner.h <= outer.y + outer.h + tolerance
  )
}

function areaToPercentRect(area: AdVisibleArea, width: number, height: number): PercentRect {
  if (area.unit === 'percent') {
    return clampRect({ x: area.x, y: area.y, w: area.width, h: area.height })
  }
  return clampRect({
    x: (area.x / width) * 100,
    y: (area.y / height) * 100,
    w: (area.width / width) * 100,
    h: (area.height / height) * 100,
  })
}

function clampRect(rect: PercentRect): PercentRect {
  const x = Math.max(0, Math.min(100, rect.x))
  const y = Math.max(0, Math.min(100, rect.y))
  return {
    x,
    y,
    w: Math.max(0, Math.min(rect.w, 100 - x)),
    h: Math.max(0, Math.min(rect.h, 100 - y)),
  }
}
