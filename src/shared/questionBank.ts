import { STANDARD_QUESTIONS } from './catalog'
import { CRITERION_BY_KEY, normaliseScores, priorityForCriterion } from './rubric'
import type {
  Company,
  ContextPack,
  Engagement,
  ExpertInput,
  Hypothesis,
  Priority,
  Question
} from './types'
import { newId, normaliseText, nowIso } from './util'

export interface QuestionSources {
  engagement: Engagement
  company: Company
  pack: ContextPack
  hypotheses: Hypothesis[]
  experts: ExpertInput[]
  existing: Question[]
}

type Draft = Omit<Question, 'id' | 'engagementId' | 'state' | 'answer' | 'flagged' | 'order' | 'createdAt' | 'updatedAt'>

/**
 * Builds the question bank from its four sources (design doc, Stage 2):
 * low-confidence rubric criteria, hypotheses that need proof, expert concerns,
 * and the standard AI Platforms set. Existing questions are kept untouched;
 * only questions whose source is not yet represented are added.
 */
export function generateQuestions(src: QuestionSources): Question[] {
  const drafts: Draft[] = []

  // 1. Unscored or low-confidence rubric criteria.
  for (const s of normaliseScores(src.engagement.scores)) {
    if (s.score != null && s.confidence !== 'low') continue
    const def = CRITERION_BY_KEY[s.criterion]
    drafts.push({
      text: def.question,
      priority: priorityForCriterion(s.criterion),
      origin: 'rubric',
      originKey: `rubric:${s.criterion}`,
      criterion: s.criterion,
      goodAnswer: def.goodAnswer,
      redFlag: def.redFlag,
      followUps: [...def.followUps]
    })
  }

  // 2. Accepted hypotheses need proof in the room.
  const problems = new Map(src.pack.problems.map((p) => [p.id, p]))
  for (const h of src.hypotheses) {
    if (h.status !== 'accepted') continue
    const p = problems.get(h.problemId)
    const problemLabel = p ? `${p.code} (${p.title})` : 'our problem'
    drafts.push({
      text: `We think ${h.capability} could help with ${problemLabel}. What result have customers seen on ${h.metric || 'that'}?`,
      priority: 'must',
      origin: 'hypothesis',
      originKey: `hypothesis:${h.id}`,
      hypothesisId: h.id,
      criterion: 'workplace_fit',
      goodAnswer: `Evidence of "${h.outcome}" measured by ${h.metric || 'a clear metric'}, from a comparable customer.`,
      redFlag: 'No measured result, or a case that does not match our problem.',
      followUps: ['What did it take to get that result?', 'Could we test this in a short proof of concept?']
    })
  }

  // 3. Confirmed expert concerns and questions for this company (or for all companies).
  for (const e of src.experts) {
    if (e.companyId && e.companyId !== src.company.id) continue
    for (const item of e.extracted) {
      if (item.confirmed !== true) continue
      const who = e.role ? `Our ${e.role.toLowerCase()} team` : 'Our expert'
      const text =
        item.kind === 'question'
          ? item.text
          : `${who} raised a concern: ${lowerFirst(stripTrailingPunctuation(item.text))}. How do you address this?`
      drafts.push({
        text,
        priority: 'must',
        origin: 'expert',
        originKey: `expert:${e.id}:${item.id}`,
        criterion: item.criterion ?? e.criterion,
        goodAnswer: 'A specific answer that our expert would accept, ideally in writing.',
        redFlag: 'The concern is waved away or deferred to "later".',
        followUps: ['Can you send that in writing so our expert can review it?']
      })
    }
  }

  // 4. Standard AI Platforms set.
  for (const q of STANDARD_QUESTIONS) {
    drafts.push({
      text: q.text,
      priority: q.priority,
      origin: 'standard',
      originKey: `standard:${q.key}`,
      criterion: q.criterion,
      goodAnswer: q.goodAnswer,
      redFlag: q.redFlag,
      followUps: [...q.followUps]
    })
  }

  return mergeDrafts(src.engagement.id, src.existing, drafts)
}

/** Adds drafts that are new by origin key and by text, after the existing questions. */
export function mergeDrafts(engagementId: string, existing: Question[], drafts: Draft[]): Question[] {
  const keys = new Set(existing.map((q) => q.originKey).filter(Boolean))
  const texts = new Set(existing.map((q) => normaliseText(q.text)))
  let order = existing.reduce((m, q) => Math.max(m, q.order), 0)
  const added: Question[] = []
  for (const d of drafts) {
    const t = normaliseText(d.text)
    if ((d.originKey && keys.has(d.originKey)) || texts.has(t)) continue
    if (d.originKey) keys.add(d.originKey)
    texts.add(t)
    const now = nowIso()
    added.push({
      ...d,
      id: newId('q'),
      engagementId,
      state: 'not_asked',
      answer: '',
      flagged: false,
      order: ++order,
      createdAt: now,
      updatedAt: now
    })
  }
  return added
}

/** Open questions carried into a new round as must-asks (design doc, "An Engagement can loop"). */
export function carryForward(previous: Question[], newEngagementId: string): Question[] {
  const now = nowIso()
  return previous
    .filter((q) => q.state !== 'answered' && (q.priority === 'must' || q.state === 'partly'))
    .map((q, i) => ({
      ...q,
      id: newId('q'),
      engagementId: newEngagementId,
      origin: 'carried' as const,
      originKey: `carried:${q.id}`,
      priority: 'must' as Priority,
      state: 'not_asked' as const,
      answer: q.answer ? `Previous round: ${q.answer}` : '',
      flagged: false,
      order: i + 1,
      createdAt: now,
      updatedAt: now
    }))
}

export const PRIORITY_RANK: Record<Priority, number> = { must: 0, should: 1, nice: 2 }

export function sortQuestions(qs: Question[]): Question[] {
  return [...qs].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order)
}

export interface Coverage {
  mustTotal: number
  mustCovered: number
  mustOpen: Question[]
  answered: number
  total: number
}

/** A must-ask counts as covered when answered, or explicitly flagged as asked but unanswered. */
export function coverage(qs: Question[]): Coverage {
  const must = qs.filter((q) => q.priority === 'must')
  const mustOpen = must.filter((q) => q.state !== 'answered')
  return {
    mustTotal: must.length,
    mustCovered: must.length - mustOpen.length,
    mustOpen,
    answered: qs.filter((q) => q.state === 'answered').length,
    total: qs.length
  }
}

/** Short list of open points to send to an expert before the meeting. */
export function expertOpenPoints(companyName: string, qs: Question[]): string {
  const open = sortQuestions(qs).filter((q) => q.state !== 'answered' && q.priority !== 'nice')
  const lines = [
    `Open points before our meeting with ${companyName}`,
    '',
    'Could you look over these and tell us what a good answer would be, or what we are missing?',
    '',
    ...open.map((q, i) => {
      const crit = q.criterion ? ` [${CRITERION_BY_KEY[q.criterion].name}]` : ''
      return `${i + 1}. ${q.text}${crit}`
    })
  ]
  return lines.join('\n')
}

function stripTrailingPunctuation(s: string): string {
  return s.trim().replace(/[.?!;:,]+$/, '')
}

function lowerFirst(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s
}
