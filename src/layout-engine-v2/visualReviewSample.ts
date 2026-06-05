import type { DecisionReport } from './exportDecisionReport'
import type { ResearchMethod } from './runResearch'
import type { FormatGroup, FormatSpecV2 } from './types'

export interface ResearchDecision {
  formatId: string
  formatName: string
  group: FormatGroup
  method: ResearchMethod
  selectedLayout: string
  score: number
  actionsToFix: number
  estimatedCorrectionTimeSec: number
}

export interface VisualReviewSheetRow {
  caseId: string
  randomFileName: string
  manualScore: string
  readabilityOk: string
  requiredPreserved: string
  majorOverlap: string
  comment: string
}

export interface VisualReviewKeyRow {
  caseId: string
  randomFileName: string
  formatId: string
  formatName: string
  group: FormatGroup
  method: ResearchMethod
  selectedLayout: string
  score: number
  actionsToFix: number
  estimatedCorrectionTimeSec: number
}

const REVIEW_FORMAT_COUNT = 30
const METHODS: ResearchMethod[] = ['scaling', 'fixedLayout', 'candidateSelection']
const GROUP_ORDER: FormatGroup[] = ['small', 'wide', 'horizontal', 'vertical', 'square', 'narrow', 'logo']

function caseIdForIndex(index: number): string {
  return `case_${String(index + 1).padStart(3, '0')}`
}

function firstByFormatId(decisions: ResearchDecision[]): ResearchDecision[] {
  const byFormat = new Map<string, ResearchDecision>()

  for (const decision of decisions) {
    if (!byFormat.has(decision.formatId)) {
      byFormat.set(decision.formatId, decision)
    }
  }

  return [...byFormat.values()]
}

function hasAllMethods(formatId: string, decisionsByKey: Map<string, ResearchDecision>): boolean {
  return METHODS.every((method) => decisionsByKey.has(`${formatId}::${method}`))
}

function selectFormatIds(decisions: ResearchDecision[]): string[] {
  const decisionsByKey = new Map(decisions.map((decision) => [`${decision.formatId}::${decision.method}`, decision]))
  const formats = firstByFormatId(decisions)
    .filter((decision) => hasAllMethods(decision.formatId, decisionsByKey))
    .sort((a, b) => a.formatId.localeCompare(b.formatId))

  const formatsByGroup = new Map<FormatGroup, ResearchDecision[]>()

  for (const group of GROUP_ORDER) {
    formatsByGroup.set(group, formats.filter((format) => format.group === group))
  }

  const selected: ResearchDecision[] = []
  let cursor = 0

  while (selected.length < REVIEW_FORMAT_COUNT) {
    let addedInPass = false

    for (const group of GROUP_ORDER) {
      const groupFormats = formatsByGroup.get(group) ?? []
      const next = groupFormats[cursor]

      if (next && !selected.some((format) => format.formatId === next.formatId)) {
        selected.push(next)
        addedInPass = true

        if (selected.length === REVIEW_FORMAT_COUNT) {
          break
        }
      }
    }

    if (!addedInPass) {
      break
    }

    cursor += 1
  }

  return selected.map((format) => format.formatId)
}

export function buildVisualReviewSample(decisions: ResearchDecision[]): {
  sheetRows: VisualReviewSheetRow[]
  keyRows: VisualReviewKeyRow[]
} {
  const decisionsByKey = new Map(decisions.map((decision) => [`${decision.formatId}::${decision.method}`, decision]))
  const selectedFormatIds = selectFormatIds(decisions)
  const selectedDecisions = selectedFormatIds.flatMap((formatId) =>
    METHODS.map((method) => {
      const decision = decisionsByKey.get(`${formatId}::${method}`)

      if (!decision) {
        throw new Error(`Cannot build visual review sample: missing "${method}" decision for "${formatId}".`)
      }

      return decision
    }),
  )

  const sheetRows = selectedDecisions.map((_, index): VisualReviewSheetRow => {
    const caseId = caseIdForIndex(index)

    return {
      caseId,
      randomFileName: `${caseId}.png`,
      manualScore: '',
      readabilityOk: '',
      requiredPreserved: '',
      majorOverlap: '',
      comment: '',
    }
  })

  const keyRows = selectedDecisions.map((decision, index): VisualReviewKeyRow => {
    const caseId = caseIdForIndex(index)

    return {
      caseId,
      randomFileName: `${caseId}.png`,
      formatId: decision.formatId,
      formatName: decision.formatName,
      group: decision.group,
      method: decision.method,
      selectedLayout: decision.selectedLayout,
      score: decision.score,
      actionsToFix: decision.actionsToFix,
      estimatedCorrectionTimeSec: decision.estimatedCorrectionTimeSec,
    }
  })

  return {
    sheetRows,
    keyRows,
  }
}

export function decisionReportsToResearchDecisions(
  reports: DecisionReport[],
  formats: FormatSpecV2[],
): ResearchDecision[] {
  const formatsById = new Map(formats.map((format) => [format.id, format]))

  return reports.map((report) => {
    const format = formatsById.get(report.formatId)
    const selectedRow = report.rows.find((row) => row.selected)

    if (!format) {
      throw new Error(`Cannot build visual review decisions: missing format metadata for "${report.formatId}".`)
    }

    if (!selectedRow) {
      throw new Error(`Cannot build visual review decisions: missing selected row for "${report.formatId}" and "${report.method}".`)
    }

    return {
      formatId: report.formatId,
      formatName: format.name,
      group: format.group,
      method: report.method as ResearchMethod,
      selectedLayout: report.selectedLayout,
      score: report.selectedScore,
      actionsToFix: selectedRow.actionsToFix,
      estimatedCorrectionTimeSec: selectedRow.estimatedCorrectionTimeSec,
    }
  })
}
