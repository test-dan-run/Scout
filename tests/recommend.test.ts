import { describe, expect, it } from 'vitest'
import { suggestRecommendation } from '../src/shared/recommend'
import type { Question } from '../src/shared/types'
import { allScores, engagement, pack } from './fixtures'

const q = (state: Question['state'], priority: Question['priority'] = 'must'): Question => ({
  id: Math.random().toString(),
  engagementId: 'eng1',
  text: 't',
  priority,
  origin: 'manual',
  goodAnswer: '',
  redFlag: '',
  followUps: [],
  state,
  answer: '',
  flagged: false,
  order: 1,
  createdAt: '',
  updatedAt: ''
})

describe('suggestRecommendation', () => {
  const p = pack()

  it('a failed hard requirement overrides a high score', () => {
    const e = engagement(allScores(5), { hardChecks: { c1: { result: 'fail', note: '' } } })
    const r = suggestRecommendation(e, p.constraints, [q('answered')])
    expect(r.recommendation).toBe('do_not_proceed')
    expect(r.reasons[0]).toContain('Restricted data')
  })

  it('suggests Proceed at 3.5+ with hard requirements passed and must-asks answered', () => {
    const e = engagement(allScores(4), { hardChecks: { c1: { result: 'pass', note: '' } } })
    expect(suggestRecommendation(e, p.constraints, [q('answered'), q('not_asked', 'should')]).recommendation).toBe('proceed')
  })

  it('holds when must-asks are open', () => {
    const e = engagement(allScores(4), { hardChecks: { c1: { result: 'pass', note: '' } } })
    const r = suggestRecommendation(e, p.constraints, [q('partly')])
    expect(r.recommendation).toBe('hold')
    expect(r.openMustAsks).toBe(1)
  })

  it('holds when a hard requirement is not confirmed', () => {
    const r = suggestRecommendation(engagement(allScores(4)), p.constraints, [])
    expect(r.recommendation).toBe('hold')
    expect(r.unknownHard).toHaveLength(1)
  })

  it('suggests Do not proceed below 2.5', () => {
    expect(suggestRecommendation(engagement(allScores(2)), [], []).recommendation).toBe('do_not_proceed')
  })

  it('holds when nothing is scored', () => {
    expect(suggestRecommendation(engagement(), [], []).recommendation).toBe('hold')
  })
})
