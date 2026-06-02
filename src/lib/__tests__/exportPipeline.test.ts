import JSZip from 'jszip'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportZip } from '../export'
import { exportSvgZip } from '../exportSvg'
import type { FormatKey } from '../types'

const createdBlobs: Blob[] = []
const appended: unknown[] = []

describe('export pipeline', () => {
  beforeEach(() => {
    createdBlobs.length = 0
    appended.length = 0
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => {
        createdBlobs.push(blob)
        return `blob:test-${createdBlobs.length}`
      },
      revokeObjectURL: vi.fn(),
    })
    vi.stubGlobal('window', {
      setTimeout,
    })
    vi.stubGlobal('XMLSerializer', class {
      serializeToString(node: FakeSvg) {
        return node.toString()
      }
    })
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    })
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({ drawImage: vi.fn() }),
            toDataURL: () => 'data:image/png;base64,QUJD',
          }
        }
        return {
          href: '',
          download: '',
          click: vi.fn(),
        }
      },
      body: {
        appendChild: (node: unknown) => appended.push(node),
        removeChild: vi.fn(),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exports a single SVG zip with normalized SVG attributes', async () => {
    await exportSvgZip({ 'vk-square': new FakeSvg(1080, 1080) as unknown as SVGSVGElement }, 'Project One')

    const zip = await JSZip.loadAsync(await createdBlobs.at(-1)!.arrayBuffer())
    const file = zip.file('Project_One-vk-square.svg')

    expect(file).toBeTruthy()
    expect(await file!.async('string')).toContain('viewBox="0 0 1080 1080"')
    expect(appended.length).toBe(1)
  })

  it('exports selected PNG formats and a manifest into a zip', async () => {
    await exportZip(
      {
        'vk-square': new FakeSvg(1080, 1080) as unknown as SVGSVGElement,
        'instagram-story': new FakeSvg(1080, 1920) as unknown as SVGSVGElement,
      },
      ['vk-square', 'instagram-story'],
      'Project One',
    )

    const zip = await JSZip.loadAsync(await createdBlobs.at(-1)!.arrayBuffer())

    expect(zip.file('Project_One__vk-square.png')).toBeTruthy()
    expect(zip.file('Project_One__instagram-story.png')).toBeTruthy()
    expect(zip.file('ad-format-manifest.json')).toBeTruthy()
    expect(zip.file('export-report.json')).toBeTruthy()
    expect(zip.file('export-report.txt')).toBeTruthy()
    const manifest = JSON.parse(await zip.file('ad-format-manifest.json')!.async('string')) as Array<{ key: FormatKey }>
    expect(manifest.map((item) => item.key)).toEqual(['vk-square', 'instagram-story'])
    const report = JSON.parse(await zip.file('export-report.json')!.async('string')) as {
      formatRuleSources: Array<{
        formatId: FormatKey
        officialRequirementsUsed: string[]
        derivedRulesUsed: string[]
        heuristicRulesUsed: string[]
        needsManualReview: boolean
        status: string
      }>
    }
    expect(report.formatRuleSources.map((item) => item.formatId)).toEqual(['vk-square', 'instagram-story'])
    const firstReportEntry = report.formatRuleSources[0]
    expect(firstReportEntry).toBeDefined()
    expect(firstReportEntry!.heuristicRulesUsed).toContain('image/text/CTA percentage regions')
    expect(firstReportEntry!.status).not.toBe('official_match')
    const txt = await zip.file('export-report.txt')!.async('string')
    expect(txt).toContain('Часть правил компоновки является эвристической')
    expect(txt).toContain('процентное расположение изображения, текста и CTA')
  })
})

class FakeSvg {
  private attrs = new Map<string, string>()

  constructor(width: number, height: number) {
    this.attrs.set('width', String(width))
    this.attrs.set('height', String(height))
  }

  cloneNode(): FakeSvg {
    const clone = new FakeSvg(Number(this.attrs.get('width')), Number(this.attrs.get('height')))
    clone.attrs = new Map(this.attrs)
    return clone
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value)
  }

  toString(): string {
    const attrs = [...this.attrs.entries()].map(([key, value]) => `${key}="${value}"`).join(' ')
    return `<svg ${attrs}><rect width="100%" height="100%" fill="#fff"/></svg>`
  }
}
