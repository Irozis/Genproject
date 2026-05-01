import type { FormatRuleSet, LayoutDensity } from './types'

const DENSITY_GUTTER_MULTIPLIER: Record<LayoutDensity, number> = {
  compact: 0.72,
  balanced: 1,
  spacious: 1.35,
}

export function applyLayoutDensity(rules: FormatRuleSet, density: LayoutDensity | undefined): FormatRuleSet {
  const mode = density ?? 'balanced'
  const multiplier = DENSITY_GUTTER_MULTIPLIER[mode] ?? 1
  if (multiplier === 1) return rules
  return { ...rules, gutter: rules.gutter * multiplier }
}

export function densityLabel(density: LayoutDensity): string {
  switch (density) {
    case 'compact':
      return 'Компактно'
    case 'spacious':
      return 'Свободно'
    default:
      return 'Баланс'
  }
}
