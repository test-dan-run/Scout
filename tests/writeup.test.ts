import { describe, expect, it } from 'vitest'
import { briefToMarkdown, draftBrief } from '../src/shared/brief'
import { markdownToHtml, parseBlocks } from '../src/shared/markdown'
import { generateQuestions } from '../src/shared/questionBank'
import { suggestRecommendation } from '../src/shared/recommend'
import type { MeetingNotes } from '../src/shared/types'
import { countUnsourced, draftWriteup, writeupToMarkdown } from '../src/shared/writeup'
import { allScores, company, engagement, expert, hypothesis, pack } from './fixtures'

const meeting: MeetingNotes = {
  id: 'eng1',
  engagementId: 'eng1',
  date: '2026-11-24',
  attendees: 'Jane (CTO)',
  notes: 'They run in Singapore region.',
  redFlags: 'Said on-prem is "on the roadmap"',
  followUps: [{ owner: 'them', text: 'Send SOC 2 report' }],
  updatedAt: ''
}

function setup() {
  const e = engagement(allScores(4), { hardChecks: { c1: { result: 'pass', note: 'Singapore region confirmed' } }, baselineScores: engagement(allScores(3)).scores })
  const p = pack()
  const hyps = [hypothesis({ verdict: 'supported', evidence: 'Customer cut review time by 40%' })]
  const questions = generateQuestions({ engagement: e, company: company(), pack: p, hypotheses: hyps, experts: [expert()], existing: [] })
  return { e, p, hyps, questions }
}

describe('draftWriteup', () => {
  it('builds every section and cites sources', () => {
    const { e, p, hyps, questions } = setup()
    const suggestion = suggestRecommendation(e, p.constraints, questions)
    const w = draftWriteup({ engagement: e, company: company(), pack: p, hypotheses: hyps, questions, experts: [expert()], meeting, suggestion })
    expect(w.sections.map((s) => s.key)).toEqual(['recommendation', 'snapshot', 'scores', 'hypotheses', 'unanswered', 'risks', 'next', 'sources'])
    const md = writeupToMarkdown(w, 'Acme AI', 1)
    expect(md).toContain('https://acme.example/about (checked 2026-11-20)')
    expect(md).toContain('Meeting notes, 2026-11-24 (Jane (CTO))')
    expect(md).toContain('(was 3 before the meeting)')
    expect(md).toContain('**Supported:**')
    expect(md).toContain('on the roadmap')
    expect(md).toContain('Open expert concern: Logs may be retained offshore.')
    expect(md).toContain('Acme AI owes: Send SOC 2 report')
    // Pricing has no source, so it is marked.
    expect(countUnsourced(w)).toBe(1)
  })

  it('keeps the scout\'s recommendation and reason on redraft', () => {
    const { e, p, hyps, questions } = setup()
    const suggestion = suggestRecommendation(e, p.constraints, questions)
    const first = draftWriteup({ engagement: e, company: company(), pack: p, hypotheses: hyps, questions, experts: [], meeting, suggestion })
    const redrafted = draftWriteup(
      { engagement: e, company: company(), pack: p, hypotheses: hyps, questions, experts: [], meeting, suggestion },
      { ...first, recommendation: 'proceed', overrideReason: 'CTO committed to answers in writing' }
    )
    expect(redrafted.recommendation).toBe('proceed')
    expect(redrafted.suggested).toBe('hold')
    expect(redrafted.sections[0].body).toContain('overridden: CTO committed to answers in writing')
    expect(redrafted.sections[0].body).not.toContain('Pilot owner')
    expect(redrafted.sections.find((s) => s.key === 'next')!.body).toContain('Pilot owner')
  })
})

describe('brief', () => {
  it('drafts a brief with three must-learn items and speaker notes', () => {
    const { p, hyps, questions } = setup()
    const b = draftBrief({ engagementId: 'eng1', company: company(), pack: p, hypotheses: hyps, questions })
    expect(b.mustLearn).toHaveLength(3)
    expect(b.mustLearn.every(Boolean)).toBe(true)
    expect(b.whyItMatters).toContain('P1')
    const md = briefToMarkdown(b, 'Acme AI')
    expect(md).toContain('## Speaker notes')
    expect(md).toContain('consent')
  })
})

describe('markdown', () => {
  it('parses headings, lists and inline marks, and escapes HTML', () => {
    expect(parseBlocks('# T\n\n- a\n1. b\ntext').map((b) => b.type)).toEqual(['heading', 'bullet', 'numbered', 'paragraph'])
    const html = markdownToHtml('**bold** <script>x</script> [src](https://a.example) [bad](javascript:alert(1))')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<a href="https://a.example">src</a>')
    expect(html).not.toContain('javascript:')
  })
})
