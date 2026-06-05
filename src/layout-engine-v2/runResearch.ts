import { createDecisionReport, decisionReportsToCsv } from './exportDecisionReport'
import { buildFixedLayoutCandidate } from './fixedLayoutBaseline'
import { sampleFormats, sampleSourceMaterial } from './fixtures'
import { generateLayoutCandidates } from './generateCandidates'
import { selectBestLayoutCandidate } from './selectBestCandidate'
import type {
  FormatSpecV2,
  LayoutCandidate,
  LayoutElement,
  LayoutRect,
  SourceMaterialV2,
} from './types'

export type ResearchMethod = 'scaling' | 'fixedLayout' | 'candidateSelection'

export interface ResearchMethodSummary {
  method: ResearchMethod
  totalFormats: number
  clean: number
  withoutCritical: number
  warningOnly: number
  critical: number
  averageScore: number
  totalScore: number
  totalCriticalIssues: number
  totalWarningIssues: number
  totalOutOfBounds: number
  totalOverlap: number
  totalTextTooSmall: number
  totalMissingRequired: number
  totalUnsafeZone: number
  totalHiddenOptional: number
}

export interface ResearchResult {
  projectId: string
  formatCount: number
  formats: FormatSpecV2[]
  methods: ResearchMethod[]
  reports: ReturnType<typeof createDecisionReport>[]
  csv: string
  summary: ResearchMethodSummary[]
}

function cloneRect(rect: LayoutRect): LayoutRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }
}

function findSourceCanvas(source: SourceMaterialV2): LayoutRect {
  const background = source.elements.find((element) => element.role === 'background')

  if (background && background.rect.width > 0 && background.rect.height > 0) {
    return cloneRect(background.rect)
  }

  const maxX = Math.max(...source.elements.map((element) => element.rect.x + element.rect.width))
  const maxY = Math.max(...source.elements.map((element) => element.rect.y + element.rect.height))

  return {
    x: 0,
    y: 0,
    width: Math.max(1, maxX),
    height: Math.max(1, maxY),
  }
}

function scaleRect(rect: LayoutRect, sourceCanvas: LayoutRect, format: FormatSpecV2): LayoutRect {
  const scaleX = format.width / sourceCanvas.width
  const scaleY = format.height / sourceCanvas.height

  return {
    x: (rect.x - sourceCanvas.x) * scaleX,
    y: (rect.y - sourceCanvas.y) * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  }
}

function scaleFontSize(fontSize: number | undefined, sourceCanvas: LayoutRect, format: FormatSpecV2): number | undefined {
  if (fontSize === undefined) {
    return undefined
  }

  const scaleX = format.width / sourceCanvas.width
  const scaleY = format.height / sourceCanvas.height
  const scale = Math.min(scaleX, scaleY)

  return fontSize * scale
}

function copyAsCandidateElement(element: LayoutElement, patch: Partial<LayoutElement>): LayoutElement {
  return {
    ...element,
    ...patch,
    rect: patch.rect ? cloneRect(patch.rect) : cloneRect(element.rect),
  }
}

export function buildScalingCandidate(source: SourceMaterialV2, format: FormatSpecV2): LayoutCandidate {
  const sourceCanvas = findSourceCanvas(source)

  return {
    id: `${format.id}:scaling`,
    name: 'scaling',
    formatId: format.id,
    elements: source.elements.map((element) => {
      if (element.role === 'background') {
        return copyAsCandidateElement(element, {
          rect: { x: 0, y: 0, width: format.width, height: format.height },
          visible: true,
        })
      }

      return copyAsCandidateElement(element, {
        rect: scaleRect(element.rect, sourceCanvas, format),
        visible: element.visible,
        fontSize: scaleFontSize(element.fontSize, sourceCanvas, format),
      })
    }),
    metadata: {
      notes: ['Scaling baseline: source material is resized as a proportional coordinate transform.'],
    },
  }
}

function runMethod(params: {
  method: ResearchMethod
  source: SourceMaterialV2
  format: FormatSpecV2
}) {
  if (params.method === 'scaling') {
    const candidate = buildScalingCandidate(params.source, params.format)

    return selectBestLayoutCandidate([candidate], params.format)
  }

  if (params.method === 'fixedLayout') {
    const candidate = buildFixedLayoutCandidate(params.source, params.format)

    return selectBestLayoutCandidate([candidate], params.format)
  }

  const candidates = generateLayoutCandidates(params.source, params.format)

  return selectBestLayoutCandidate(candidates, params.format)
}

function summarizeMethod(method: ResearchMethod, reports: ReturnType<typeof createDecisionReport>[]): ResearchMethodSummary {
  const selectedReports = reports.filter((report) => report.method === method)
  const selectedRows = selectedReports.map((report) => report.rows.find((row) => row.selected)).filter((row) => row !== undefined)

  const totalFormats = selectedRows.length
  const totalScore = selectedRows.reduce((sum, row) => sum + row.score, 0)
  const totalCriticalIssues = selectedRows.reduce((sum, row) => sum + row.criticalCount, 0)
  const totalWarningIssues = selectedRows.reduce((sum, row) => sum + row.warningCount, 0)

  return {
    method,
    totalFormats,
    clean: selectedRows.filter((row) => row.criticalCount === 0 && row.warningCount === 0).length,
    withoutCritical: selectedRows.filter((row) => row.criticalCount === 0).length,
    warningOnly: selectedRows.filter((row) => row.criticalCount === 0 && row.warningCount > 0).length,
    critical: selectedRows.filter((row) => row.criticalCount > 0).length,
    averageScore: totalFormats > 0 ? totalScore / totalFormats : 0,
    totalScore,
    totalCriticalIssues,
    totalWarningIssues,
    totalOutOfBounds: selectedRows.reduce((sum, row) => sum + row.outOfBoundsCount, 0),
    totalOverlap: selectedRows.reduce((sum, row) => sum + row.overlapCount, 0),
    totalTextTooSmall: selectedRows.reduce((sum, row) => sum + row.textTooSmallCount, 0),
    totalMissingRequired: selectedRows.reduce((sum, row) => sum + row.missingRequiredCount, 0),
    totalUnsafeZone: selectedRows.reduce((sum, row) => sum + row.unsafeZoneCount, 0),
    totalHiddenOptional: selectedRows.reduce((sum, row) => sum + row.hiddenOptionalCount, 0),
  }
}

export function runResearch(params: {
  source?: SourceMaterialV2
  formats?: FormatSpecV2[]
  methods?: ResearchMethod[]
} = {}): ResearchResult {
  const source = params.source ?? sampleSourceMaterial
  const formats = params.formats ?? sampleFormats
  const methods = params.methods ?? ['scaling', 'fixedLayout', 'candidateSelection']

  const reports = formats.flatMap((format) =>
    methods.map((method) => {
      const decision = runMethod({
        method,
        source,
        format,
      })

      return createDecisionReport({
        projectId: source.id,
        method,
        decision,
      })
    }),
  )

  return {
    projectId: source.id,
    formatCount: formats.length,
    formats,
    methods,
    reports,
    csv: decisionReportsToCsv(reports),
    summary: methods.map((method) => summarizeMethod(method, reports)),
  }
}
