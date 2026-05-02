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
    note: 'Чистый нейтральный вариант',
    displayFont: '"Inter Display", Inter, system-ui, sans-serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'manrope',
    label: 'Manrope / Manrope',
    note: 'Современный универсальный бренд',
    displayFont: 'Manrope, Inter, system-ui, sans-serif',
    textFont: 'Manrope, Inter, system-ui, sans-serif',
  },
  {
    id: 'space-grotesk',
    label: 'Space Grotesk / Inter',
    note: 'SaaS, финтех и цифровые продукты',
    displayFont: '"Space Grotesk", "Inter Display", Inter, system-ui, sans-serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'ibm-plex',
    label: 'IBM Plex Sans / IBM Plex Sans',
    note: 'Рациональный B2B и аналитика',
    displayFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
    textFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
  },
  {
    id: 'montserrat',
    label: 'Montserrat / Inter',
    note: 'Маркетплейсы и промо-баннеры',
    displayFont: 'Montserrat, "Inter Display", Inter, system-ui, sans-serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'system',
    label: 'Системный',
    note: 'Похож на интерфейс устройства',
    displayFont: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    textFont: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  {
    id: 'playfair',
    label: 'Playfair Display / Inter',
    note: 'Премиальный редакционный тон',
    displayFont: '"Playfair Display", Georgia, "Times New Roman", serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'cormorant',
    label: 'Cormorant / Inter',
    note: 'Люкс, недвижимость и бутики',
    displayFont: '"Cormorant Garamond", "Playfair Display", Georgia, serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'fraunces',
    label: 'Fraunces / Manrope',
    note: 'Кофе, еда и теплый крафт',
    displayFont: 'Fraunces, "Playfair Display", Georgia, serif',
    textFont: 'Manrope, Inter, system-ui, sans-serif',
  },
  {
    id: 'dm-serif',
    label: 'DM Serif / Manrope',
    note: 'Beauty, wellness и мягкий premium',
    displayFont: '"DM Serif Display", "Playfair Display", Georgia, serif',
    textFont: 'Manrope, Inter, system-ui, sans-serif',
  },
  {
    id: 'libre-baskerville',
    label: 'Libre Baskerville / Inter',
    note: 'Классика, образование и культура',
    displayFont: '"Libre Baskerville", Georgia, "Times New Roman", serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'merriweather',
    label: 'Merriweather / IBM Plex',
    note: 'Доверительный экспертный стиль',
    displayFont: 'Merriweather, Georgia, serif',
    textFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
  },
  {
    id: 'bold-display',
    label: 'Impact / Inter',
    note: 'Громкий постерный акцент',
    displayFont: 'Impact, "Arial Black", sans-serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'archivo-black',
    label: 'Archivo Black / Inter',
    note: 'Fashion, спорт и энергичные запуски',
    displayFont: '"Archivo Black", "Inter Display", Inter, system-ui, sans-serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'bebas',
    label: 'Bebas Neue / Montserrat',
    note: 'Постеры, дропы и афиши',
    displayFont: '"Bebas Neue", Impact, "Arial Black", sans-serif',
    textFont: 'Montserrat, Inter, system-ui, sans-serif',
  },
  {
    id: 'oswald',
    label: 'Oswald / Inter',
    note: 'Спорт, мероприятия и outdoor',
    displayFont: 'Oswald, "Arial Narrow", Arial, sans-serif',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'rubik',
    label: 'Rubik / Rubik',
    note: 'Дружелюбный продуктовый тон',
    displayFont: 'Rubik, Inter, system-ui, sans-serif',
    textFont: 'Rubik, Inter, system-ui, sans-serif',
  },
  {
    id: 'nunito',
    label: 'Nunito / Nunito',
    note: 'Детские, семейные и образовательные бренды',
    displayFont: 'Nunito, "Inter Display", Inter, system-ui, sans-serif',
    textFont: 'Nunito, Inter, system-ui, sans-serif',
  },
  {
    id: 'techno',
    label: 'Mono / Inter',
    note: 'Техничный продуктовый стиль',
    displayFont: '"JetBrains Mono", "SF Mono", Consolas, monospace',
    textFont: 'Inter, system-ui, sans-serif',
  },
  {
    id: 'ibm-mono',
    label: 'IBM Plex Mono / IBM Plex Sans',
    note: 'Разработчики, API и документация',
    displayFont: '"IBM Plex Mono", "SF Mono", Consolas, monospace',
    textFont: '"IBM Plex Sans", Inter, system-ui, sans-serif',
  },
  {
    id: 'warm-serif',
    label: 'Georgia / Georgia',
    note: 'Теплый классический стиль',
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
