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
