import { emptyContextPack } from '../src/shared/seed'
import { emptyScores } from '../src/shared/rubric'
import type { Company, ContextPack, CriterionKey, Engagement, ExpertInput, Hypothesis } from '../src/shared/types'

export function company(over: Partial<Company> = {}): Company {
  return {
    id: 'co1',
    name: 'Acme AI',
    segment: 'Cloud AI platforms',
    profile: {
      pitch: { value: 'Builds AI things', sourceUrl: 'https://acme.example/about', checkedAt: '2026-11-20' },
      pricing: { value: 'Per token' }
    },
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    ...over
  }
}

export function engagement(scores: Partial<Record<CriterionKey, number>> = {}, over: Partial<Engagement> = {}): Engagement {
  return {
    id: 'eng1',
    companyId: 'co1',
    round: 1,
    stage: 'prepare',
    status: 'active',
    owner: 'Dan',
    scores: emptyScores().map((s) =>
      scores[s.criterion] != null ? { ...s, score: scores[s.criterion]!, confidence: 'high', evidence: `Evidence for ${s.criterion}` } : s
    ),
    hardChecks: {},
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    ...over
  }
}

export function pack(over: Partial<ContextPack> = {}): ContextPack {
  return {
    ...emptyContextPack(),
    teamName: 'Enterprise AI',
    mission: 'Help the business adopt AI safely.',
    problems: [{ id: 'p1', code: 'P1', title: 'Slow document review', description: '', owner: 'Ops', successMeasure: 'hours saved per week' }],
    constraints: [{ id: 'c1', text: 'Restricted data stays in Singapore', hard: true, criterion: 'deployment' }],
    ...over
  }
}

export function hypothesis(over: Partial<Hypothesis> = {}): Hypothesis {
  return {
    id: 'h1',
    engagementId: 'eng1',
    capability: 'document extraction agents',
    problemId: 'p1',
    outcome: 'review time halves',
    metric: 'hours saved per week',
    status: 'accepted',
    verdict: 'untested',
    evidence: '',
    createdAt: '',
    updatedAt: '',
    ...over
  }
}

export function expert(over: Partial<ExpertInput> = {}): ExpertInput {
  return {
    id: 'ex1',
    expertName: 'Priya',
    role: 'Security',
    topic: 'Data handling',
    rawText: '',
    extracted: [
      { id: 'x1', kind: 'concern', text: 'Logs may be retained offshore.', criterion: 'security', confirmed: true },
      { id: 'x2', kind: 'question', text: 'Do they support customer-managed keys?', confirmed: null }
    ],
    createdAt: '2026-11-10T00:00:00Z',
    updatedAt: '2026-11-10T00:00:00Z',
    ...over
  }
}

/** All eight criteria at the same score. */
export function allScores(n: number): Partial<Record<CriterionKey, number>> {
  return Object.fromEntries(emptyScores().map((s) => [s.criterion, n]))
}
