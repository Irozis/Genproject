export type TextRegime = 'nominal' | 'translated-long' | 'stress-long'

const textByLocale: Record<string, Record<string, string>> = {
  Sale: { ru: 'Распродажа', es: 'Oferta' },
  Title: { ru: 'Заголовок' },
}

export function resolveText(text: string, locale: string, regime: TextRegime): string {
  if (regime === 'nominal') return text

  if (regime === 'translated-long') {
    const translated = textByLocale[text]?.[locale]
    return translated ?? text
  }

  const base = text.trim()
  if (base.length === 0) return text

  const minTarget = Math.ceil(base.length * 1.8)
  let out = base
  while (out.length < minTarget) {
    out += ` ${base}`
  }
  return out
}
