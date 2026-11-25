import type { CriterionKey, Priority, ProfileFieldKey } from './types'

/** AI Platforms segments (design doc, Stage 1, plus the starter-list groupings). */
export const SEGMENTS = [
  'Foundation model and model API providers',
  'Cloud AI platforms',
  'Data and AI platforms',
  'Inference and model-serving platforms',
  'LLMOps and MLOps',
  'Agent and orchestration frameworks',
  'Retrieval: vector databases, search, RAG',
  'Evaluation, guardrails and AI governance',
  'AI gateways and model routers'
]

export const PROFILE_FIELDS: { key: ProfileFieldKey; label: string; multiline?: boolean }[] = [
  { key: 'pitch', label: 'One-line pitch' },
  { key: 'products', label: 'Products', multiline: true },
  { key: 'deployment', label: 'Deployment options', multiline: true },
  { key: 'targetCustomers', label: 'Target customers' },
  { key: 'notableCustomers', label: 'Notable customers' },
  { key: 'pricing', label: 'Pricing', multiline: true },
  { key: 'funding', label: 'Funding and headcount' },
  { key: 'localPresence', label: 'Local presence' },
  { key: 'competitors', label: 'Competitors' },
  { key: 'recentNews', label: 'Recent news', multiline: true },
  { key: 'openQuestions', label: 'Open questions', multiline: true }
]

/** A profile field older than this is flagged as stale. */
export const FRESHNESS_DAYS = 30

export interface StandardQuestion {
  key: string
  text: string
  priority: Priority
  criterion: CriterionKey
  goodAnswer: string
  redFlag: string
  followUps: string[]
}

/** Standard AI Platforms question set, asked of every company. */
export const STANDARD_QUESTIONS: StandardQuestion[] = [
  {
    key: 'std-inference-location',
    text: 'Where does inference run, and can it run inside our environment or in Singapore?',
    priority: 'must',
    criterion: 'deployment',
    goodAnswer: 'In-VPC, on-premises or Singapore-region inference that is generally available today.',
    redFlag: 'Private or regional deployment is only on the roadmap.',
    followUps: ['Which parts of the service still run outside our environment?', 'Is there a data residency guarantee in the contract?']
  },
  {
    key: 'std-data-use',
    text: 'What happens to our prompts, outputs and fine-tuning data? Are they used for training?',
    priority: 'must',
    criterion: 'security',
    goodAnswer: 'Never used for training by default, with retention we can set, written into the contract.',
    redFlag: 'Training use is opt-out, or retention is unclear.',
    followUps: ['How long are logs kept?', 'Who on your side can see our data?']
  },
  {
    key: 'std-model-switch',
    text: 'Which models are supported, and how hard is it to switch models?',
    priority: 'should',
    criterion: 'openness',
    goodAnswer: 'Several model families and bring-your-own-model, switched by configuration.',
    redFlag: 'Key features only work with one model.',
    followUps: ['Can we bring our own fine-tuned model?', 'What would we need to change to switch?']
  },
  {
    key: 'std-eval-regression',
    text: 'How do you evaluate quality and detect regressions when a model is updated?',
    priority: 'should',
    criterion: 'maturity',
    goodAnswer: 'Built-in evaluation sets, version pinning, and notice before model changes.',
    redFlag: 'Models change under us without notice, with no way to pin a version.',
    followUps: ['How much notice do you give before a model is retired?', 'Can we run our own evaluation sets?']
  },
  {
    key: 'std-pricing-volume',
    text: 'What does pricing look like at our expected volume, and what drives cost up?',
    priority: 'should',
    criterion: 'cost',
    goodAnswer: 'A worked estimate at our volume, with the main cost drivers named.',
    redFlag: 'No worked example, or platform fees on top of usage.',
    followUps: ['Are there volume discounts or commitments?', 'What does a typical customer like us pay per month?']
  },
  {
    key: 'std-production-customers',
    text: 'Which customers like us run this in production today?',
    priority: 'should',
    criterion: 'maturity',
    goodAnswer: 'Named production customers in a similar sector or region.',
    redFlag: 'Only pilots, or no customers they can name.',
    followUps: ['Could we speak with one of them?', 'How long have they been in production?']
  }
]

export const PRIORITY_LABEL: Record<Priority, string> = {
  must: 'Must-ask',
  should: 'Should-ask',
  nice: 'Nice-to-have'
}
