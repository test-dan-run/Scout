import { describe, expect, it } from 'vitest'
import { RUBRIC, normaliseScores, weightedScore } from '../src/shared/rubric'
import { engagement } from './fixtures'

describe('rubric', () => {
  it('weights add up to 100%', () => {
    expect(RUBRIC.reduce((n, c) => n + c.weight, 0)).toBeCloseTo(1)
  })

  it('weights the mean over scored criteria only', () => {
    // workplace_fit 20% at 5, deployment 15% at 1 -> (1 + 0.15) / 0.35
    const ws = weightedScore(engagement({ workplace_fit: 5, deployment: 1 }).scores)
    expect(ws.score).toBeCloseTo(3.29, 2)
    expect(ws.coverage).toBeCloseTo(0.35)
    expect(ws.scoredCount).toBe(2)
  })

  it('returns null when nothing is scored', () => {
    expect(weightedScore(engagement().scores)).toEqual({ score: null, coverage: 0, scoredCount: 0 })
  })

  it('fills in missing criteria', () => {
    expect(normaliseScores([])).toHaveLength(RUBRIC.length)
  })
})
