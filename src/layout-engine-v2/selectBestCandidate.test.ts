import { describe, expect, it } from 'vitest'
import { calculateActionsToFix } from './actionsToFix'
import { buildFixedLayoutCandidate } from './fixedLayoutBaseline'
import { sampleFormats, sampleSourceMaterial } from './fixtures'
import { generateLayoutCandidates } from './generateCandidates'
import {
  countCriticalIssues,
  countWarningIssues,
  evaluateLayoutCandidate,
  scoreLayoutCandidate,
} from './scoreCandidate'
import { selectBestLayoutCandidate } from './selectBestCandidate'
import type { CandidateEvaluation, FormatSpecV2, LayoutCandidate, LayoutElement } from './types'

function formatById(id: string): FormatSpecV2 {
  const format = sampleFormats.find((item) => item.id === id)

  if (!format) {
    throw new Error(`Missing test format: ${id}`)
  }

  return format
}

function candidateByName(candidates: LayoutCandidate[], name: LayoutCandidate['name']): LayoutCandidate {
  const candidate = candidates.find((item) => item.name === name)

  if (!candidate) {
    throw new Error(`Missing candidate: ${name}`)
  }

  return candidate
}

function replaceElement(candidate: LayoutCandidate, elementId: string, patch: Partial<LayoutElement>): LayoutCandidate {
  return {
    ...candidate,
    elements: candidate.elements.map((element) => (element.id === elementId ? { ...element, ...patch } : element)),
  }
}

function evaluationSummary(evaluation: CandidateEvaluation): {
  name: string
  score: number
  criticalCount: number
  warningCount: number
} {
  return {
    name: evaluation.candidate.name,
    score: evaluation.score,
    criticalCount: evaluation.criticalCount,
    warningCount: evaluation.warningCount,
  }
}

describe('score and select layout candidates', () => {
  it('sums penalties in scoreLayoutCandidate', () => {
    expect(
      scoreLayoutCandidate([
        {
          type: 'missing_required',
          severity: 'critical',
          elementId: 'headline',
          message: 'missing',
          penalty: 1000,
        },
        {
          type: 'hidden_optional',
          severity: 'warning',
          elementId: 'cta',
          message: 'hidden',
          penalty: 50,
        },
      ]),
    ).toBe(1050)
  })

  it('counts critical and warning issues', () => {
    const issues = [
      {
        type: 'missing_required' as const,
        severity: 'critical' as const,
        elementId: 'headline',
        message: 'missing',
        penalty: 1000,
      },
      {
        type: 'hidden_optional' as const,
        severity: 'warning' as const,
        elementId: 'cta',
        message: 'hidden',
        penalty: 50,
      },
      {
        type: 'empty_space' as const,
        severity: 'warning' as const,
        message: 'empty',
        penalty: 100,
      },
    ]

    expect(countCriticalIssues(issues)).toBe(1)
    expect(countWarningIssues(issues)).toBe(2)
  })

  it('evaluates a generated candidate with score and issue counts', () => {
    const format = formatById('horizontal-1200x628')
    const candidates = generateLayoutCandidates(sampleSourceMaterial, format)
    const split = candidateByName(candidates, 'split')
    const evaluation = evaluateLayoutCandidate(split, format)

    expect(evaluation.candidate.name).toBe('split')
    expect(evaluation.score).toBeGreaterThanOrEqual(0)
    expect(evaluation.criticalCount).toBeGreaterThanOrEqual(0)
    expect(evaluation.warningCount).toBeGreaterThanOrEqual(0)
    expect(Array.isArray(evaluation.hiddenElements)).toBe(true)
  })

  it('selects a candidate without critical issues over a candidate with critical issues', () => {
    const format = formatById('horizontal-1200x628')
    const candidates = generateLayoutCandidates(sampleSourceMaterial, format)
    const split = candidateByName(candidates, 'split')
    const hero = candidateByName(candidates, 'hero')

    const brokenHero = replaceElement(hero, 'headline', {
      visible: false,
      rect: { x: 0, y: 0, width: 0, height: 0 },
    })

    const decision = selectBestLayoutCandidate([brokenHero, split], format)

    expect(decision.selected.candidate.id).toBe(split.id)
    expect(decision.rejected.some((evaluation) => evaluation.candidate.id === brokenHero.id)).toBe(true)
  })

  it('prioritizes fewer critical issues before actions to fix when all candidates have critical issues', () => {
    const format = formatById('horizontal-1200x628')
    const candidates = generateLayoutCandidates(sampleSourceMaterial, format)
    const split = candidateByName(candidates, 'split')
    const hero = candidateByName(candidates, 'hero')

    const brokenSplit = replaceElement(split, 'headline', {
      rect: { x: -20, y: 10, width: 200, height: 80 },
    })
    const badlyBrokenHero = replaceElement(hero, 'headline', {
      visible: false,
      rect: { x: 0, y: 0, width: 0, height: 0 },
    })

    const splitEvaluation = evaluateLayoutCandidate(brokenSplit, format)
    const heroEvaluation = evaluateLayoutCandidate(badlyBrokenHero, format)
    const decision = selectBestLayoutCandidate([badlyBrokenHero, brokenSplit], format)
    const expectedBest = [splitEvaluation, heroEvaluation].sort((first, second) => {
      if (first.criticalCount !== second.criticalCount) {
        return first.criticalCount - second.criticalCount
      }

      return calculateActionsToFix(first).actionsToFix - calculateActionsToFix(second).actionsToFix
    })[0]

    expect(expectedBest).toBeDefined()
    expect(decision.selected.candidate.id).toBe(expectedBest?.candidate.id)
  })

  it('prefers fixedLayout fallback when score, actions, critical and warnings are tied', () => {
    const format = formatById('horizontal-1200x628')
    const fixedFallback = {
      ...buildFixedLayoutCandidate(sampleSourceMaterial, format),
      metadata: {
        methodFamily: 'candidateSelectionFallback',
        sourceCandidate: 'fixedLayout',
        decisionMode: 'predefined-template',
      },
    }
    const generatedTwin: LayoutCandidate = {
      ...fixedFallback,
      id: `${format.id}:generatedTwin`,
      name: 'hero',
      metadata: {
        methodFamily: 'generated',
      },
    }

    const fixedEvaluation = evaluateLayoutCandidate(fixedFallback, format)
    const generatedEvaluation = evaluateLayoutCandidate(generatedTwin, format)

    expect(generatedEvaluation.score).toBe(fixedEvaluation.score)
    expect(calculateActionsToFix(generatedEvaluation).actionsToFix).toBe(calculateActionsToFix(fixedEvaluation).actionsToFix)
    expect(generatedEvaluation.criticalCount).toBe(fixedEvaluation.criticalCount)
    expect(generatedEvaluation.warningCount).toBe(fixedEvaluation.warningCount)

    const decision = selectBestLayoutCandidate([generatedTwin, fixedFallback], format)

    expect(decision.selected.candidate.id).toBe(fixedFallback.id)
  })

  it('creates a deterministic decision object for identical inputs', () => {
    const format = formatById('horizontal-1200x628')
    const candidates = generateLayoutCandidates(sampleSourceMaterial, format)

    const first = selectBestLayoutCandidate(candidates, format)
    const second = selectBestLayoutCandidate(candidates, format)

    expect(first).toEqual(second)
  })

  it('throws when candidate list is empty', () => {
    const format = formatById('horizontal-1200x628')

    expect(() => selectBestLayoutCandidate([], format)).toThrow(/candidate list is empty/)
  })

  it('returns rejected evaluations and a readable reason', () => {
    const format = formatById('horizontal-1200x628')
    const candidates = generateLayoutCandidates(sampleSourceMaterial, format)
    const decision = selectBestLayoutCandidate(candidates, format)

    expect(decision.rejected.length).toBe(candidates.length - 1)
    expect(decision.reason).toContain(`Selected ${decision.selected.candidate.name}`)
  })

  it('can summarize evaluations for debugging without changing the selected result', () => {
    const format = formatById('horizontal-1200x628')
    const candidates = generateLayoutCandidates(sampleSourceMaterial, format)
    const decision = selectBestLayoutCandidate(candidates, format)
    const summary = evaluationSummary(decision.selected)

    expect(summary.name).toBe(decision.selected.candidate.name)
    expect(summary.score).toBe(decision.selected.score)
    expect(summary.criticalCount).toBe(decision.selected.criticalCount)
    expect(summary.warningCount).toBe(decision.selected.warningCount)
  })
})
