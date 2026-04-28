import { describe, expect, it } from 'vitest'
import { resolveText } from '../localeResolver'

describe('resolveText', () => {
  describe('nominal', () => {
    it('returns text as-is', () => {
      expect(resolveText('Hello', 'ru', 'nominal')).toBe('Hello')
    })

    it('keeps whitespace and empty strings unchanged', () => {
      expect(resolveText('', 'ru', 'nominal')).toBe('')
      expect(resolveText('  spaced  ', 'ru', 'nominal')).toBe('  spaced  ')
    })
  })

  describe('translated-long', () => {
    it('returns translation when locale exists', () => {
      expect(resolveText('Sale', 'ru', 'translated-long')).toBe('Распродажа')
    })

    it('falls back to source text when locale missing', () => {
      expect(resolveText('Sale', 'de', 'translated-long')).toBe('Sale')
    })

    it('falls back to source text when key is unknown', () => {
      expect(resolveText('Unknown text', 'ru', 'translated-long')).toBe('Unknown text')
    })
  })

  describe('stress-long', () => {
    it('repeats text until length is at least 1.8x', () => {
      const src = 'abc'
      const result = resolveText(src, 'ru', 'stress-long')
      expect(result.length).toBeGreaterThanOrEqual(Math.ceil(src.length * 1.8))
      expect(result).toBe('abc abc')
    })

    it('handles single-character text', () => {
      expect(resolveText('x', 'ru', 'stress-long')).toBe('x x')
    })

    it('returns original whitespace-only text unchanged', () => {
      expect(resolveText('   ', 'ru', 'stress-long')).toBe('   ')
    })
  })
})
