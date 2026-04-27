import JSZip from 'jszip'
import type { FormatKey } from './types'

export async function exportSvgZip(
  svgs: Partial<Record<FormatKey, SVGSVGElement>>,
  projectName: string,
): Promise<void> {
  const zip = new JSZip()
  const safe = projectName.replace(/[^a-z0-9_-]/gi, '_') || 'project'
  const entries = Object.entries(svgs) as Array<[FormatKey, SVGSVGElement]>
  for (const [formatKey, svg] of entries) {
    const clone = svg.cloneNode(true) as SVGSVGElement
    if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    if (!clone.getAttribute('viewBox')) {
      const w = clone.getAttribute('width') ?? '1080'
      const h = clone.getAttribute('height') ?? '1080'
      clone.setAttribute('viewBox', `0 0 ${w} ${h}`)
    }
    if (!clone.getAttribute('width') || !clone.getAttribute('height')) {
      const viewBox = clone.getAttribute('viewBox')?.split(/\s+/) ?? []
      const width = viewBox[2] ?? '1080'
      const height = viewBox[3] ?? '1080'
      clone.setAttribute('width', width)
      clone.setAttribute('height', height)
    }
    const xml = new XMLSerializer().serializeToString(clone)
    zip.file(`${safe}-${formatKey}.svg`, xml)
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safe}-svg.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
