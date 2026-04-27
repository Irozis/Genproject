import { describe, expect, it } from 'vitest'
import { __measureCacheSizeForTests, __resetMeasureCacheForTests, wrapText } from '../textMeasure'

describe('textMeasure cache', () => {
  it('repeated wrap uses cached width entries', () => {
    __resetMeasureCacheForTests()
    for (let i = 0; i < 1000; i++) {
      wrapText({
        text: 'Sale',
        fontSizePx: 48,
        fontWeight: 700,
        fontFamily: 'sans-serif',
        maxWidthPx: 1000,
        maxLines: 2,
      })
    }
    expect(__measureCacheSizeForTests()).toBe(1)
  })
})
