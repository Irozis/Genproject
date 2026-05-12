import { describe, expect, it } from 'vitest'
import { buildScene } from '../buildScene'
import { DEFAULT_ENABLED, DEFAULT_FORMATS } from '../defaults'
import { getFormat } from '../formats'
import { checkOverflow } from '../fixLayout'
import { TEMPLATES } from '../templates'
import { measureTextWidth, wrapText } from '../textMeasure'
import type { FormatRuleSet, TextBlock } from '../types'

const DESIGNER_BLOCKS = ['title', 'subtitle', 'cta', 'badge', 'logo', 'image'] as const

describe('brand templates', () => {
  it('build without layout warnings across default formats', () => {
    const failures: string[] = []

    for (const template of TEMPLATES) {
      const enabled = { ...DEFAULT_ENABLED, ...template.enabled }
      for (const formatKey of DEFAULT_FORMATS) {
        const scene = buildScene(template.master, formatKey, template.brandKit, enabled, {
          ...(template.preferredModels?.[formatKey] ? { override: template.preferredModels[formatKey] } : {}),
          blockOverrides: template.blockOverrides?.[formatKey],
          density: template.formatDensities?.[formatKey],
        })
        const warnings = checkOverflow(scene, getFormat(formatKey)).filter((issue) => issue.level === 'warn')
        for (const warning of warnings) {
          failures.push(`${template.id}/${formatKey}: ${warning.block ?? 'scene'} ${warning.message}`)
        }
      }
    }

    expect(failures).toEqual([])
  })

  it('keep brand badge and usable subtitles in finished template formats', () => {
    const failures: string[] = []

    for (const template of TEMPLATES) {
      const enabled = { ...DEFAULT_ENABLED, ...template.enabled }
      for (const formatKey of DEFAULT_FORMATS) {
        const scene = buildScene(template.master, formatKey, template.brandKit, enabled, {
          ...(template.preferredModels?.[formatKey] ? { override: template.preferredModels[formatKey] } : {}),
          blockOverrides: template.blockOverrides?.[formatKey],
          density: template.formatDensities?.[formatKey],
        })

        if (!scene.badge?.text) failures.push(`${template.id}/${formatKey}: missing badge`)
        if (!scene.subtitle?.text) failures.push(`${template.id}/${formatKey}: missing subtitle`)
      }
    }

    expect(failures).toEqual([])
  })

  it('pin every brand template to explicit per-format designer settings', () => {
    const failures: string[] = []

    for (const template of TEMPLATES) {
      for (const formatKey of DEFAULT_FORMATS) {
        if (!template.preferredModels?.[formatKey]) {
          failures.push(`${template.id}/${formatKey}: missing preferred model`)
        }

        const overrides = template.blockOverrides?.[formatKey]
        if (!overrides) {
          failures.push(`${template.id}/${formatKey}: missing block overrides`)
          continue
        }

        for (const block of DESIGNER_BLOCKS) {
          if (!overrides[block]) failures.push(`${template.id}/${formatKey}: missing ${block} settings`)
        }
        for (const block of ['title', 'subtitle', 'cta', 'badge'] as const) {
          if (overrides[block]?.fitMode !== 'ellipsis') {
            failures.push(`${template.id}/${formatKey}: ${block} is not exact-fit designer text`)
          }
        }
      }
    }

    expect(failures).toEqual([])
  })

  it('keeps designer object fields close to rendered content', () => {
    const failures: string[] = []

    for (const template of TEMPLATES) {
      const enabled = { ...DEFAULT_ENABLED, ...template.enabled }
      for (const formatKey of DEFAULT_FORMATS) {
        const rules = getFormat(formatKey)
        const scene = buildScene(template.master, formatKey, template.brandKit, enabled, {
          ...(template.preferredModels?.[formatKey] ? { override: template.preferredModels[formatKey] } : {}),
          blockOverrides: template.blockOverrides?.[formatKey],
          density: template.formatDensities?.[formatKey],
        })

        for (const block of ['title', 'subtitle', 'cta', 'badge'] as const) {
          const field = scene[block]
          if (!field) continue
          const usage = contentUsage(block, field, rules)
          if (usage.width < 0.45 || usage.height < 0.45) {
            failures.push(
              `${template.id}/${formatKey}/${block}: ${usage.width.toFixed(2)}w ${usage.height.toFixed(2)}h`,
            )
          }
        }
      }
    }

    expect(failures).toEqual([])
  })
})

function contentUsage(kind: 'title' | 'subtitle' | 'cta' | 'badge', block: TextBlock, rules: FormatRuleSet) {
  const text = plainText(block)
  const fontSizePx = (block.fontSize / 100) * rules.width
  const widthPx = (block.w / 100) * rules.width
  const heightPx = ((block.h ?? 0) / 100) * rules.height
  const letterSpacingPx = fontSizePx * (block.letterSpacing ?? 0)
  const fontFamily = block.fontFamily ?? 'Inter, system-ui, sans-serif'
  const lines = kind === 'cta' || kind === 'badge'
    ? [text]
    : wrapText({
        text,
        fontSizePx,
        fontWeight: block.weight,
        fontFamily,
        maxWidthPx: widthPx,
        maxLines: block.maxLines,
        overflow: 'ellipsis',
      })
  const renderedLines = lines.length > 0 ? lines : [text]
  const maxLineWidthPx = Math.max(
    1,
    ...renderedLines.map((line) => measureTextWidth(line, fontSizePx, block.weight, fontFamily) + letterSpacingPx * line.length),
  )
  const visualWidthPx = kind === 'cta'
    ? Math.max(maxLineWidthPx / 0.82, maxLineWidthPx + fontSizePx * 2.4)
    : kind === 'badge'
      ? maxLineWidthPx + fontSizePx * 1.7
      : maxLineWidthPx
  const visualHeightPx = kind === 'cta'
    ? Math.max(32, fontSizePx * 2.35)
    : kind === 'badge'
      ? fontSizePx * 1.8
      : fontSizePx * (block.lineHeight ?? 1.12) * renderedLines.length

  return {
    width: visualWidthPx / Math.max(1, widthPx),
    height: visualHeightPx / Math.max(1, heightPx),
  }
}

function plainText(block: Pick<TextBlock, 'text' | 'transform'>): string {
  const raw = block.text.replace(/\*\*/g, '').trim()
  if (block.transform === 'uppercase') return raw.toLocaleUpperCase()
  if (block.transform === 'title-case') {
    return raw.replace(/\w\S*/g, (w) => (w[0] ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
  }
  if (block.transform === 'sentence-case') {
    return raw.length > 0 ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : raw
  }
  return raw
}
