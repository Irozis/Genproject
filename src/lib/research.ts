import { getFormat } from './formats'
import type { FormatKey, FormatRuleSet } from './types'

export type ResearchMethod = 'app' | 'manual' | 'template' | 'other'

export type ResearchEventType =
  | 'start'
  | 'stop'
  | 'step_change'
  | 'image_uploaded'
  | 'format_selected'
  | 'format_unselected'
  | 'recommended_formats_selected'
  | 'palette_selected'
  | 'typography_changed'
  | 'composition_changed'
  | 'scene_generated'
  | 'manual_edit'
  | 'text_changed'
  | 'color_changed'
  | 'validation_started'
  | 'validation_warning'
  | 'validation_error'
  | 'export'
  | 'download'
  | 'reset'

export type ResearchEvent = {
  timestamp: string
  type: ResearchEventType
  step?: string
  formatId?: string
  payload?: Record<string, unknown>
}

export type ResearchSession = {
  sessionId: string
  projectId: string
  scenarioName: string
  participantId?: string
  method: ResearchMethod
  startedAt: string
  finishedAt?: string
  durationMs?: number
  actionCount: number
  selectedFormatCount: number
  generatedAssetCount: number
  exportedAssetCount: number
  validationWarningCount: number
  validationErrorCount: number
  manualEditCount: number
  formatIds: string[]
  platformNames: string[]
  events: ResearchEvent[]
  notes?: string
}

export type ManualResearchResult = {
  id: string
  scenarioName: string
  method: ResearchMethod
  participantId?: string
  totalDurationMinutes: number
  actionCount: number
  formatCount: number
  exportedFormatCount: number
  errorCount: number
  manualEditCount: number
  notes?: string
}

export type ResearchMetrics = {
  totalDurationMinutes: number
  averageTimePerFormatMinutes: number
  averageActionsPerFormat: number
  exportedFormatsShare: number
  warningRate: number
  errorRate: number
  manualEditRate: number
}

export type ResearchComparison = {
  baseMethod: string
  comparedMethod: string
  timeReductionPercent: number
  actionReductionPercent: number
  averageTimePerFormatDifference: number
  errorDifference: number
  manualEditDifference: number
}

export type ResearchSessionParams = {
  projectId: string
  scenarioName: string
  participantId?: string
  method?: ResearchMethod
  selectedFormats?: FormatKey[]
  customFormats?: FormatRuleSet[]
  notes?: string
  now?: Date
}

export type ResearchExportBundle = {
  json: string
  csv: string
  txt: string
}

export const RESEARCH_MODE_ENABLED = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_RESEARCH_MODE === 'true'

export const RESEARCH_SCENARIOS = [
  { id: 'small-set', name: 'Small set', formatCount: 5, description: '5 formats, 1 brand, 1 image.' },
  { id: 'medium-set', name: 'Medium set', formatCount: 10, description: '10 formats, 1 brand, 1 image, 1 palette.' },
  { id: 'large-set', name: 'Large set', formatCount: 20, description: '20 formats, 1 brand, 1 image, 2-3 platforms.' },
  {
    id: 'stress-set',
    name: 'Stress set',
    targetSizes: ['320x50', '320x100', '728x90', '1456x180', '2880x300', '300x250', '1080x1080', '1080x1920'],
    description: 'Critical mixed-size set for stress testing.',
  },
] as const

const USER_ACTIONS = new Set<ResearchEventType>([
  'step_change',
  'image_uploaded',
  'format_selected',
  'format_unselected',
  'recommended_formats_selected',
  'palette_selected',
  'typography_changed',
  'composition_changed',
  'scene_generated',
  'manual_edit',
  'text_changed',
  'color_changed',
  'validation_started',
  'export',
  'download',
  'reset',
])

const MANUAL_EDIT_EVENTS = new Set<ResearchEventType>(['manual_edit', 'text_changed', 'color_changed'])

export function startResearchSession(params: ResearchSessionParams): ResearchSession {
  const now = params.now ?? new Date()
  const formatIds = [...new Set(params.selectedFormats ?? [])]
  return {
    sessionId: `research-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: params.projectId,
    scenarioName: params.scenarioName,
    participantId: params.participantId?.trim() || undefined,
    method: params.method ?? 'app',
    startedAt: now.toISOString(),
    actionCount: 0,
    selectedFormatCount: formatIds.length,
    generatedAssetCount: 0,
    exportedAssetCount: 0,
    validationWarningCount: 0,
    validationErrorCount: 0,
    manualEditCount: 0,
    formatIds,
    platformNames: platformNamesFor(formatIds, params.customFormats),
    events: [{ timestamp: now.toISOString(), type: 'start' }],
    notes: params.notes?.trim() || undefined,
  }
}

export function stopResearchSession(session: ResearchSession, now = new Date()): ResearchSession {
  const finishedAt = now.toISOString()
  const durationMs = Math.max(0, now.getTime() - new Date(session.startedAt).getTime())
  return {
    ...session,
    finishedAt,
    durationMs,
    events: [...session.events, { timestamp: finishedAt, type: 'stop' }],
  }
}

export function resetResearchSession(): ResearchSession | null {
  return null
}

export function recordResearchEvent(
  session: ResearchSession | null,
  event: Omit<ResearchEvent, 'timestamp'> & { timestamp?: string },
  enabled = RESEARCH_MODE_ENABLED,
): ResearchSession | null {
  if (!enabled || !session) return session
  const nextEvent: ResearchEvent = {
    ...event,
    timestamp: event.timestamp ?? new Date().toISOString(),
    payload: sanitizePayload(event.payload),
  }
  const actionCount = session.actionCount + (USER_ACTIONS.has(nextEvent.type) ? 1 : 0)
  const validationWarningCount = session.validationWarningCount + (nextEvent.type === 'validation_warning' ? 1 : 0)
  const validationErrorCount = session.validationErrorCount + (nextEvent.type === 'validation_error' ? 1 : 0)
  const manualEditCount = session.manualEditCount + (MANUAL_EDIT_EVENTS.has(nextEvent.type) ? 1 : 0)
  const formatIds = updateFormatIds(session.formatIds, nextEvent)
  const selectedFormatCount = nextEvent.type === 'format_selected' || nextEvent.type === 'format_unselected' || nextEvent.type === 'recommended_formats_selected'
    ? formatIds.length
    : session.selectedFormatCount
  const generatedAssetCount = session.generatedAssetCount + (nextEvent.type === 'scene_generated' ? numberPayload(nextEvent.payload, 'count', 1) : 0)
  const exportedAssetCount = session.exportedAssetCount + (nextEvent.type === 'export' || nextEvent.type === 'download' ? numberPayload(nextEvent.payload, 'count', 1) : 0)
  return {
    ...session,
    actionCount,
    selectedFormatCount,
    generatedAssetCount,
    exportedAssetCount,
    validationWarningCount,
    validationErrorCount,
    manualEditCount,
    formatIds,
    events: [...session.events, nextEvent],
  }
}

export function calculateResearchMetrics(session: ResearchSession): ResearchMetrics {
  const totalDurationMinutes = (session.durationMs ?? elapsedMs(session)) / 60000
  const formatCount = Math.max(1, session.selectedFormatCount || session.formatIds.length)
  return {
    totalDurationMinutes,
    averageTimePerFormatMinutes: totalDurationMinutes / formatCount,
    averageActionsPerFormat: session.actionCount / formatCount,
    exportedFormatsShare: (session.exportedAssetCount / formatCount) * 100,
    warningRate: session.validationWarningCount / formatCount,
    errorRate: session.validationErrorCount / formatCount,
    manualEditRate: session.manualEditCount / formatCount,
  }
}

export function addManualResearchResult(results: ManualResearchResult[], result: ManualResearchResult): ManualResearchResult[] {
  return [...results.filter((item) => item.id !== result.id), { ...result, participantId: result.participantId?.trim() || undefined }]
}

export function compareResearchResults(manualResult: ManualResearchResult, appSession: ResearchSession): ResearchComparison {
  const appMetrics = calculateResearchMetrics(appSession)
  const manualFormatCount = Math.max(1, manualResult.formatCount)
  const manualAverage = manualResult.totalDurationMinutes / manualFormatCount
  return {
    baseMethod: manualResult.method,
    comparedMethod: appSession.method,
    timeReductionPercent: percentReduction(manualResult.totalDurationMinutes, appMetrics.totalDurationMinutes),
    actionReductionPercent: percentReduction(manualResult.actionCount, appSession.actionCount),
    averageTimePerFormatDifference: manualAverage - appMetrics.averageTimePerFormatMinutes,
    errorDifference: manualResult.errorCount - appSession.validationErrorCount,
    manualEditDifference: manualResult.manualEditCount - appSession.manualEditCount,
  }
}

export function exportResearchSession(session: ResearchSession, manualResults: ManualResearchResult[] = []): ResearchExportBundle {
  return {
    json: JSON.stringify({ session, manualResults, metrics: calculateResearchMetrics(session) }, null, 2),
    csv: researchSessionToCsv(session),
    txt: researchSessionToText(session, manualResults),
  }
}

export function researchSessionToCsv(session: ResearchSession): string {
  const rows = ['timestamp,type,step,formatId,details']
  for (const event of session.events) {
    rows.push([
      csvCell(event.timestamp),
      csvCell(event.type),
      csvCell(event.step ?? ''),
      csvCell(event.formatId ?? ''),
      csvCell(event.payload ? JSON.stringify(event.payload) : ''),
    ].join(','))
  }
  return rows.join('\n')
}

export function manualResultsToCsv(results: ManualResearchResult[]): string {
  const rows = ['id,scenarioName,method,participantId,totalDurationMinutes,actionCount,formatCount,exportedFormatCount,errorCount,manualEditCount,notes']
  for (const item of results) {
    rows.push([
      item.id,
      item.scenarioName,
      item.method,
      item.participantId ?? '',
      item.totalDurationMinutes,
      item.actionCount,
      item.formatCount,
      item.exportedFormatCount,
      item.errorCount,
      item.manualEditCount,
      item.notes ?? '',
    ].map((value) => csvCell(String(value))).join(','))
  }
  return rows.join('\n')
}

export function sanitizeImageUploadPayload(input: Record<string, unknown> | undefined): Record<string, unknown> {
  return sanitizePayload(input) ?? {}
}

export function findStressScenarioFormats(formats: FormatRuleSet[]): Array<{ targetSize: string; formatId: string; exact: boolean }> {
  const stress = RESEARCH_SCENARIOS.find((item) => item.id === 'stress-set')
  const targets = 'targetSizes' in stress! ? stress.targetSizes : []
  return targets.map((targetSize) => {
    const [widthRaw, heightRaw] = targetSize.split('x')
    const width = Number(widthRaw)
    const height = Number(heightRaw)
    const exact = formats.find((item) => item.width === width && item.height === height)
    if (exact) return { targetSize, formatId: exact.key, exact: true }
    const targetAspect = width / height
    const nearest = [...formats].sort((a, b) => {
      const aScore = Math.abs(a.aspectRatio - targetAspect) + Math.abs(a.width - width) / Math.max(width, 1) + Math.abs(a.height - height) / Math.max(height, 1)
      const bScore = Math.abs(b.aspectRatio - targetAspect) + Math.abs(b.width - width) / Math.max(width, 1) + Math.abs(b.height - height) / Math.max(height, 1)
      return aScore - bScore
    })[0]
    return { targetSize, formatId: nearest?.key ?? '', exact: false }
  })
}

function researchSessionToText(session: ResearchSession, manualResults: ManualResearchResult[]): string {
  const metrics = calculateResearchMetrics(session)
  const lines = [
    'Research session summary',
    `Method: ${session.method}`,
    `Scenario: ${session.scenarioName}`,
    `Duration: ${metrics.totalDurationMinutes.toFixed(2)} min`,
    `Actions: ${session.actionCount}`,
    `Formats: ${session.selectedFormatCount}`,
    `Exported files: ${session.exportedAssetCount}`,
    `Warnings: ${session.validationWarningCount}`,
    `Errors: ${session.validationErrorCount}`,
    `Manual edits: ${session.manualEditCount}`,
    `Average time per format: ${metrics.averageTimePerFormatMinutes.toFixed(2)} min`,
    `Formats without manual edits share: ${Math.max(0, 100 - metrics.manualEditRate * 100).toFixed(1)}%`,
  ]
  const manual = manualResults[0]
  if (manual) {
    const comparison = compareResearchResults(manual, session)
    lines.push(
      '',
      'Comparison',
      `Manual method time: ${manual.totalDurationMinutes.toFixed(2)} min`,
      `App method time: ${metrics.totalDurationMinutes.toFixed(2)} min`,
      `Time reduction: ${comparison.timeReductionPercent.toFixed(1)}%`,
      `Manual method actions: ${manual.actionCount}`,
      `App method actions: ${session.actionCount}`,
      `Action reduction: ${comparison.actionReductionPercent.toFixed(1)}%`,
    )
  }
  return lines.join('\n')
}

function sanitizePayload(payload: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!payload) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (/path|fileName|filename|name|src|url/i.test(key)) continue
    if (key === 'image') {
      out.image = sanitizeImageLike(value)
      continue
    }
    if (key === 'width' || key === 'height' || key === 'aspectRatio' || key === 'count' || key === 'warnings' || key === 'errors') {
      out[key] = value
      continue
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = value
  }
  return out
}

function sanitizeImageLike(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const source = value as Record<string, unknown>
  return {
    width: source.width,
    height: source.height,
    aspectRatio: source.aspectRatio,
  }
}

function updateFormatIds(current: string[], event: ResearchEvent): string[] {
  if (event.type === 'format_selected' && event.formatId) return [...new Set([...current, event.formatId])]
  if (event.type === 'format_unselected' && event.formatId) return current.filter((item) => item !== event.formatId)
  if (event.type === 'recommended_formats_selected' && Array.isArray(event.payload?.formatIds)) {
    return [...new Set(event.payload.formatIds.filter((item): item is string => typeof item === 'string'))]
  }
  return current
}

function platformNamesFor(formatIds: string[], customFormats?: FormatRuleSet[]): string[] {
  return [...new Set(formatIds.map((key) => {
    try {
      return getFormat(key as FormatKey, customFormats).platformName ?? 'Unknown'
    } catch {
      return 'Unknown'
    }
  }))]
}

function elapsedMs(session: ResearchSession): number {
  return Math.max(0, Date.now() - new Date(session.startedAt).getTime())
}

function numberPayload(payload: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const value = payload?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function percentReduction(base: number, compared: number): number {
  return base > 0 ? ((base - compared) / base) * 100 : 0
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}
