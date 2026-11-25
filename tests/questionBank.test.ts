import { describe, expect, it } from 'vitest'
import { STANDARD_QUESTIONS } from '../src/shared/catalog'
import { carryForward, coverage, expertOpenPoints, generateQuestions } from '../src/shared/questionBank'
import { company, engagement, expert, hypothesis, pack } from './fixtures'

describe('generateQuestions', () => {
  const base = () => ({
    engagement: engagement({ workplace_fit: 4, deployment: 3, security: 4, openness: 4, maturity: 4, integration: 4, cost: 4 }),
    company: company(),
    pack: pack(),
    hypotheses: [hypothesis(), hypothesis({ id: 'h2', status: 'rejected' })],
    experts: [expert(), expert({ id: 'ex2', companyId: 'other-co' })],
    existing: []
  })

  it('draws from all four sources', () => {
    const qs = generateQuestions(base())
    const origins = new Set(qs.map((q) => q.origin))
    expect(origins).toEqual(new Set(['rubric', 'hypothesis', 'expert', 'standard']))
    // Only viability is unscored.
    expect(qs.filter((q) => q.origin === 'rubric').map((q) => q.criterion)).toEqual(['viability'])
    // Rejected hypotheses and other companies' expert input are skipped; unconfirmed items too.
    expect(qs.filter((q) => q.origin === 'hypothesis')).toHaveLength(1)
    expect(qs.filter((q) => q.origin === 'expert')).toHaveLength(1)
    expect(qs.find((q) => q.origin === 'expert')!.text).toBe('Our security team raised a concern: logs may be retained offshore. How do you address this?')
  })

  it('de-duplicates by text, so a rubric question matching a standard one appears once', () => {
    const src = base()
    src.engagement = engagement() // every criterion unscored
    const qs = generateQuestions(src)
    const texts = qs.map((q) => q.text)
    expect(new Set(texts).size).toBe(texts.length)
    expect(qs.filter((q) => q.text.startsWith('Where does inference run'))).toHaveLength(1)
  })

  it('does not add anything twice when rebuilt', () => {
    const first = generateQuestions(base())
    const second = generateQuestions({ ...base(), existing: first })
    expect(second).toHaveLength(0)
    expect(first.length).toBeGreaterThanOrEqual(STANDARD_QUESTIONS.length)
  })

  it('keeps edited questions and does not re-add their source', () => {
    const first = generateQuestions(base())
    const edited = first.map((q) => ({ ...q, text: `${q.text} (edited)` }))
    expect(generateQuestions({ ...base(), existing: edited })).toHaveLength(0)
  })
})

describe('coverage and carry-forward', () => {
  const qs = generateQuestions({
    engagement: engagement(),
    company: company(),
    pack: pack(),
    hypotheses: [],
    experts: [],
    existing: []
  })

  it('counts must-asks answered', () => {
    const answered = qs.map((q, i) => (i === 0 ? { ...q, state: 'answered' as const } : q))
    const c = coverage(answered)
    expect(c.mustCovered).toBe(answered[0].priority === 'must' ? 1 : 0)
    expect(c.mustTotal).toBe(qs.filter((q) => q.priority === 'must').length)
  })

  it('carries open must-asks and partly answered questions into the next round as must-asks', () => {
    const marked = qs.map((q, i) => ({ ...q, state: i === 0 ? ('answered' as const) : i === 1 ? ('partly' as const) : q.state, answer: i === 1 ? 'Some of it' : '' }))
    const carried = carryForward(marked, 'eng2')
    expect(carried.every((q) => q.engagementId === 'eng2' && q.priority === 'must' && q.state === 'not_asked')).toBe(true)
    expect(carried.find((q) => q.text === marked[1].text)?.answer).toBe('Previous round: Some of it')
    expect(carried.find((q) => q.text === marked[0].text)).toBeUndefined()
  })

  it('lists open points for an expert', () => {
    const text = expertOpenPoints('Acme AI', qs)
    expect(text).toContain('Acme AI')
    expect(text).toMatch(/^1\. /m)
  })
})
