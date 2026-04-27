// Curated font pair presets. Display font drives headlines + CTA; text font
// drives subtitles + badges. Each preset is a pure CSS `font-family` stack
// with safe fallbacks — no web-font loader, no runtime network. Users can
// still override via the free-form input; this is a shortcut for common looks.

export type FontPair = {
  id: string
  label: string
  /** Mood or typical use-case, shown as a secondary line under the label. */
  note: string
  displayFont: string
  textFont: string
}

export const FONT_PAIRS: FontPair[] = [
  {
    id: 'inter',
    label: 'Inter / Inter',
    note: 'Clean, neutral default',
    displayFont: '"Inter Display", Inter, system-ui, sans-serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'system',
    label: 'System',
    note: 'Matches host OS look',
    displayFont: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    textFont: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  {
    id: 'editorial',
    label: 'Georgia / Inter',
    note: 'Editorial, magazine tone',
    displayFont: 'Georgia, "Times New Roman", serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'bold-display',
    label: 'Impact / Inter',
    note: 'Loud, poster display',
    displayFont: 'Impact, "Arial Black", sans-serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'techno',
    label: 'Mono / Inter',
    note: 'Technical, product focus',
    displayFont: '"JetBrains Mono", "SF Mono", Consolas, monospace',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'warm-serif',
    label: 'Georgia / Georgia',
    note: 'Warm, traditional',
    displayFont: 'Georgia, "Times New Roman", serif',
    textFont: 'Georgia, "Times New Roman", serif',
  },
]

/** Find the preset that matches a brand kit's current fonts, if any. Used to
 *  highlight the active preset in the picker without forcing users onto one. */
export function findMatchingPair(displayFont: string, textFont: string): FontPair | null {
  return (
    FONT_PAIRS.find(
      (p) => p.displayFont === displayFont && p.textFont === textFont,
    ) ?? null
  )
}
