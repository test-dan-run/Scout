import type { CriterionKey, CriterionScore, Priority } from './types'

export interface CriterionDef {
  key: CriterionKey
  name: string
  lookFor: string
  /** Fixed weight for the first release, as a fraction of 1. */
  weight: number
  /** Question used when this criterion is unscored or low confidence. */
  question: string
  goodAnswer: string
  redFlag: string
  followUps: string[]
}

/** AI Platforms rubric. Weights are fixed for the first release (design doc, Stage 1). */
export const RUBRIC: CriterionDef[] = [
  {
    key: 'workplace_fit',
    name: 'Workplace fit',
    lookFor: 'Solves a named problem in the Context Pack',
    weight: 0.2,
    question: 'Which of our problem statements have you solved for a customer like us, and how?',
    goodAnswer: 'A concrete case that maps to one of our problem statements, with a measured result.',
    redFlag: 'Only generic capability talk, with no case close to our problems.',
    followUps: ['What did that customer measure before and after?', 'How long did it take to get there?']
  },
  {
    key: 'deployment',
    name: 'Deployment options',
    lookFor: 'SaaS, VPC, on-premises, air-gapped; Singapore or regional hosting',
    weight: 0.15,
    question: 'Where does inference run, and can it run inside our environment or in Singapore?',
    goodAnswer: 'Named deployment modes available today, including in-VPC or on-premises, and a Singapore region.',
    redFlag: '"On the roadmap" for private or regional deployment, with no date.',
    followUps: ['Is that generally available today or in preview?', 'Which components still call out to your cloud?']
  },
  {
    key: 'security',
    name: 'Security and compliance',
    lookFor: 'Certifications, data handling, PDPA alignment, audit logs',
    weight: 0.15,
    question: 'What happens to our prompts, outputs and fine-tuning data? Are they used for training?',
    goodAnswer: 'No training on customer data by default, written into the contract; clear retention; audit logs.',
    redFlag: 'Opt-out instead of opt-in, or retention terms that are vague.',
    followUps: ['Which certifications do you hold today?', 'Can we export audit logs into our SIEM?']
  },
  {
    key: 'openness',
    name: 'Model openness',
    lookFor: 'Choice of models, bring-your-own-model, no hard lock-in',
    weight: 0.1,
    question: 'Which models are supported, and how hard is it to switch models?',
    goodAnswer: 'Several model families, bring-your-own-model, and switching by configuration.',
    redFlag: 'One model family only, or features that only work with their own model.',
    followUps: ['Can we bring a fine-tuned open-weight model?', 'What breaks if we switch models?']
  },
  {
    key: 'maturity',
    name: 'Technical maturity',
    lookFor: 'Production customers, uptime record, API stability, docs quality',
    weight: 0.1,
    question: 'Which customers like us run this in production today?',
    goodAnswer: 'Named production customers in a similar sector or region, and a published uptime record.',
    redFlag: 'Only pilots, or customers they cannot name.',
    followUps: ['Can we speak to one of them?', 'How often do you make breaking API changes?']
  },
  {
    key: 'integration',
    name: 'Integration',
    lookFor: 'SSO, APIs, SDKs, fit with our existing stack',
    weight: 0.1,
    question: 'How does this integrate with our identity provider and current AI stack?',
    goodAnswer: 'SSO and role-based access out of the box; SDKs and APIs that fit our stack.',
    redFlag: 'Custom integration work needed for SSO or core APIs.',
    followUps: ['Which SDK languages are supported?', 'Do you have a reference integration for our stack?']
  },
  {
    key: 'cost',
    name: 'Cost model',
    lookFor: 'Pricing clarity, cost at our expected volume',
    weight: 0.1,
    question: 'What does pricing look like at our expected volume, and what drives cost up?',
    goodAnswer: 'A clear unit price, a worked estimate at our volume, and known cost drivers.',
    redFlag: '"It depends" with no worked example, or hidden platform fees.',
    followUps: ['Can you send a worked estimate for our volume?', 'Are there minimum commitments?']
  },
  {
    key: 'viability',
    name: 'Company viability',
    lookFor: 'Funding, runway, team, local presence or partners',
    weight: 0.1,
    question: 'Who supports us locally, and what does your presence in Singapore look like?',
    goodAnswer: 'A local team or certified partner, and a support model with clear response times.',
    redFlag: 'No local team or partner, and support only by email from another time zone.',
    followUps: ['Who would be our named contact?', 'What are your support response times?']
  }
]

export const CRITERION_BY_KEY: Record<CriterionKey, CriterionDef> = Object.fromEntries(
  RUBRIC.map((c) => [c.key, c])
) as Record<CriterionKey, CriterionDef>

export function criterionName(key: CriterionKey | undefined): string {
  return key ? CRITERION_BY_KEY[key]?.name ?? key : ''
}

export function emptyScores(): CriterionScore[] {
  return RUBRIC.map((c) => ({ criterion: c.key, score: null, confidence: 'low', evidence: '' }))
}

/** Fills in any missing criteria so a score list always covers the whole rubric. */
export function normaliseScores(scores: CriterionScore[] | undefined): CriterionScore[] {
  const byKey = new Map((scores ?? []).map((s) => [s.criterion, s]))
  return RUBRIC.map(
    (c) => byKey.get(c.key) ?? { criterion: c.key, score: null, confidence: 'low', evidence: '' }
  )
}

export interface WeightedScore {
  /** Weighted mean over scored criteria, 1 to 5, or null when nothing is scored. */
  score: number | null
  /** Share of total rubric weight that has a score, 0 to 1. */
  coverage: number
  scoredCount: number
}

export function weightedScore(scores: CriterionScore[]): WeightedScore {
  let total = 0
  let weight = 0
  let scoredCount = 0
  for (const s of scores) {
    const def = CRITERION_BY_KEY[s.criterion]
    if (!def || s.score == null) continue
    total += s.score * def.weight
    weight += def.weight
    scoredCount++
  }
  if (weight === 0) return { score: null, coverage: 0, scoredCount: 0 }
  return { score: round(total / weight, 2), coverage: round(weight, 2), scoredCount }
}

/** Priority for a question raised by an unscored or low-confidence criterion. */
export function priorityForCriterion(key: CriterionKey): Priority {
  return CRITERION_BY_KEY[key].weight >= 0.15 ? 'must' : 'should'
}

function round(n: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}
