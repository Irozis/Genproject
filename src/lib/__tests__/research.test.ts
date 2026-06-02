import { describe, expect, it } from 'vitest'
import {
  addManualResearchResult,
  calculateResearchMetrics,
  compareResearchResults,
  exportResearchSession,
  recordResearchEvent,
  sanitizeImageUploadPayload,
  startResearchSession,
  stopResearchSession,
  type ManualResearchResult,
} from '../research'
import {
  buildResearchReport,
  buildResearchValidationRecord,
  classifyRecord,
  researchRecordsToCsv,
  researchReportToMarkdown,
} from '../researchReport'
import type { FormatRuleSet, Project, Scene } from '../types'

describe('research mode session metrics', () => {
  it('starts a session', () => {
    const session = startResearchSession({
      projectId: 'project-1',
      scenarioName: 'Small set',
      selectedFormats: ['vk-square'],
      now: new Date('2026-06-01T10:00:00.000Z'),
    })

    expect(session.projectId).toBe('project-1')
    expect(session.actionCount).toBe(0)
    expect(session.selectedFormatCount).toBe(1)
    expect(session.events[0]?.type).toBe('start')
  })

  it('stops a session and calculates duration', () => {
    const session = startResearchSession({
      projectId: 'project-1',
      scenarioName: 'Small set',
      now: new Date('2026-06-01T10:00:00.000Z'),
    })
    const stopped = stopResearchSession(session, new Date('2026-06-01T10:05:00.000Z'))

    expect(stopped.finishedAt).toBe('2026-06-01T10:05:00.000Z')
    expect(stopped.durationMs).toBe(300000)
    expect(calculateResearchMetrics(stopped).totalDurationMinutes).toBe(5)
  })

  it('counts actions, warnings, errors and manual edits', () => {
    let session = startResearchSession({ projectId: 'p', scenarioName: 'Medium set' })
    session = recordResearchEvent(session, { type: 'format_selected', formatId: 'vk-square' }, true)!
    session = recordResearchEvent(session, { type: 'validation_warning' }, true)!
    session = recordResearchEvent(session, { type: 'validation_error' }, true)!
    session = recordResearchEvent(session, { type: 'manual_edit' }, true)!

    expect(session.actionCount).toBe(2)
    expect(session.validationWarningCount).toBe(1)
    expect(session.validationErrorCount).toBe(1)
    expect(session.manualEditCount).toBe(1)
  })

  it('exports JSON and CSV', () => {
    const session = recordResearchEvent(
      startResearchSession({ projectId: 'p', scenarioName: 'Small set' }),
      { type: 'export', payload: { count: 2 } },
      true,
    )!
    const exported = exportResearchSession(session)

    expect(JSON.parse(exported.json).session.exportedAssetCount).toBe(2)
    expect(exported.csv).toContain('timestamp,type,step,formatId,details')
    expect(exported.txt).toContain('Research session summary')
  })

  it('calculates timeReductionPercent and comparison', () => {
    const app = stopResearchSession(
      startResearchSession({ projectId: 'p', scenarioName: 'Small set', selectedFormats: ['vk-square'], now: new Date('2026-06-01T10:00:00.000Z') }),
      new Date('2026-06-01T10:10:00.000Z'),
    )
    const manual: ManualResearchResult = {
      id: 'm1',
      scenarioName: 'Small set',
      method: 'manual',
      totalDurationMinutes: 20,
      actionCount: 100,
      formatCount: 1,
      exportedFormatCount: 1,
      errorCount: 3,
      manualEditCount: 5,
    }

    const comparison = compareResearchResults(manual, app)
    expect(comparison.timeReductionPercent).toBe(50)
    expect(comparison.actionReductionPercent).toBe(100)
  })

  it('does not record events when research mode is disabled', () => {
    const session = startResearchSession({ projectId: 'p', scenarioName: 'Small set' })
    const next = recordResearchEvent(session, { type: 'format_selected', formatId: 'vk-square' }, false)

    expect(next).toBe(session)
    expect(next?.events).toHaveLength(1)
  })

  it('adds manual result', () => {
    const result: ManualResearchResult = {
      id: 'manual-1',
      scenarioName: 'Small set',
      method: 'manual',
      totalDurationMinutes: 12,
      actionCount: 40,
      formatCount: 5,
      exportedFormatCount: 5,
      errorCount: 1,
      manualEditCount: 8,
    }

    expect(addManualResearchResult([], result)).toEqual([result])
  })

  it('image_uploaded does not save local path or file name', () => {
    const payload = sanitizeImageUploadPayload({
      fileName: 'secret.jpg',
      localPath: 'C:/Users/person/secret.jpg',
      width: 1600,
      height: 900,
      aspectRatio: 16 / 9,
    })

    expect(payload).toEqual({ width: 1600, height: 900, aspectRatio: 16 / 9 })
  })
})

describe('research validation report', () => {
  const format: FormatRuleSet = {
    key: 'test-format',
    label: 'Test Format',
    width: 1000,
    height: 1000,
    aspectRatio: 1,
    safeZone: { top: 5, right: 5, bottom: 5, left: 5 },
    gutter: 4,
    minTitleSize: 4,
    maxTitleLines: 2,
    requiredElements: ['title', 'cta'],
  }

  const scene: Scene = {
    background: { kind: 'solid', color: '#ffffff' },
    accent: '#111111',
    title: {
      text: 'Offer',
      x: 10,
      y: 10,
      w: 50,
      h: 10,
      fontSize: 5,
      charsPerLine: 20,
      maxLines: 1,
      weight: 900,
      fill: '#111111',
    },
    cta: {
      text: 'Buy',
      x: 10,
      y: 80,
      w: 20,
      h: 8,
      fontSize: 3,
      charsPerLine: 10,
      maxLines: 1,
      weight: 700,
      fill: '#ffffff',
      bg: '#111111',
      rx: 12,
    },
  }

  const project: Project = {
    id: 'p',
    name: 'Project',
    master: scene,
    enabled: { title: true, subtitle: true, cta: true, badge: false, logo: false, image: false },
    brandKit: {
      brandName: 'Brand',
      displayFont: 'Inter',
      textFont: 'Inter',
      palette: { ink: '#111111', inkMuted: '#444444', surface: '#ffffff', accent: '#111111', accentSoft: '#eeeeee' },
      gradient: ['#ffffff', '#eeeeee', '#dddddd'],
      toneOfVoice: 'neutral',
      ctaStyle: 'pill',
    },
    goal: 'promo-pack',
    visualSystem: 'product-card',
    assetHint: null,
    imageSrc: null,
    logoSrc: null,
    selectedFormats: ['test-format'],
  }

  it('classifies missing export or required elements as critical', () => {
    expect(classifyRecord({
      exportOk: false,
      requiredElementsPresent: true,
      criticalTechnicalViolations: [],
      layoutWarnings: [],
      methodologyWarnings: [],
      manualReviewNotes: [],
      safeAreaViolationCount: 0,
      outOfBoundsCount: 0,
      overlapCount: 0,
      textOverflow: false,
    })).toBe('critical')

    const record = buildResearchValidationRecord({
      project,
      format,
      scene: { ...scene, cta: undefined },
      exportOk: true,
    })

    expect(record.requiredElementsPresent).toBe(false)
    expect(record.criticalTechnicalViolations).toContain('required element missing: cta')
    expect(record.classification).toBe('critical')
  })

  it('keeps methodology/manual review notes from changing technical classification', () => {
    const record = buildResearchValidationRecord({
      project,
      format,
      scene: {
        ...scene,
        cta: scene.cta ? { ...scene.cta, y: 24, fontSize: 4 } : undefined,
        layoutPolicy: { formatKind: 'square', source: { type: 'heuristic', name: 'test' }, appliedRules: [], needsManualReview: true },
      },
      exportOk: true,
    })

    expect(record.classification).toBe('ready')
    expect(record.methodologyWarnings.some((item) => item.startsWith('heuristicRuleApplied:'))).toBe(true)
    expect(record.manualReviewNotes).toContain('layout policy requires manual review')
  })

  it('writes report-shaped JSON, CSV and Markdown summaries', () => {
    const ready = buildResearchValidationRecord({ project, format, scene, exportOk: true })
    const critical = buildResearchValidationRecord({ project, format, scene: null, exportOk: false, exportError: 'render failed' })
    const report = buildResearchReport([ready, critical], new Date('2026-06-02T00:00:00.000Z'))
    const csv = researchRecordsToCsv(report.records)
    const markdown = researchReportToMarkdown(report)

    expect(report.totalResults).toBe(2)
    expect(csv).toContain('scenarioId,method,formatId,formatName,width,height,aspectRatio,layoutMode,exportOk')
    expect(markdown).toContain('| Total formats | 1 |')
    expect(markdown).toContain('| Critical | 1 (50.0%) |')
    expect(markdown).toContain('| adaptiveLayout | 2 |')
  })
})
