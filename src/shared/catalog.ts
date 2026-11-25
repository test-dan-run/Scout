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

export interface ProfileFieldDef {
  key: ProfileFieldKey
  label: string
  group: string
  multiline?: boolean
  /** What the research agent should look for. */
  guide: string
}

export const PROFILE_GROUPS = ['Overview', 'Products and market', 'Money', 'People', 'Ecosystem and dependencies', 'Risk and signals']

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: 'pitch', label: 'One-line pitch', group: 'Overview', guide: 'What the company does, in one sentence.' },
  { key: 'companyType', label: 'Company type', group: 'Overview', guide: 'Public (with ticker), private start-up (with stage), private scale-up, or a product line of a larger company (name the parent).' },
  { key: 'headquarters', label: 'Headquarters and offices', group: 'Overview', guide: 'HQ city and country, and main offices.' },
  { key: 'founded', label: 'Founded', group: 'Overview', guide: 'Year founded, and for a product line, when it launched.' },
  { key: 'headcount', label: 'Headcount and growth', group: 'Overview', guide: 'Approximate employees, recent growth or layoffs, with dates.' },
  { key: 'products', label: 'Products', group: 'Products and market', multiline: true, guide: 'Main products relevant to AI platforms, with one line each.' },
  { key: 'deployment', label: 'Deployment options', group: 'Products and market', multiline: true, guide: 'SaaS, VPC, on-premises, air-gapped; regions, especially Singapore or Southeast Asia.' },
  { key: 'pricing', label: 'Pricing', group: 'Products and market', multiline: true, guide: 'Pricing model and any published prices.' },
  { key: 'targetCustomers', label: 'Target customers', group: 'Products and market', guide: 'Who they sell to.' },
  { key: 'notableCustomers', label: 'Notable customers', group: 'Products and market', multiline: true, guide: 'Named customers, especially in Singapore, Asia, government or regulated sectors.' },
  { key: 'revenue', label: 'Revenue or ARR', group: 'Money', guide: 'Reported or credibly estimated revenue or ARR, with date and who reported it. For a product line, the parent\'s relevant segment.' },
  { key: 'valuation', label: 'Valuation or market cap', group: 'Money', guide: 'Latest valuation (private) or market cap (public), with date.' },
  { key: 'lastRound', label: 'Last funding round', group: 'Money', guide: 'For a start-up: the latest round, its stage, amount, date and lead investors. Otherwise say not applicable.' },
  { key: 'funding', label: 'Total funding', group: 'Money', guide: 'Total raised to date and the history of rounds.' },
  { key: 'investors', label: 'Key investors', group: 'Money', multiline: true, guide: 'Notable investors, including strategic investors such as cloud providers or chip makers.' },
  { key: 'acquisitions', label: 'Acquisitions', group: 'Money', multiline: true, guide: 'Companies they acquired, or were acquired by, with dates.' },
  { key: 'leadership', label: 'Leadership summary', group: 'People', multiline: true, guide: 'Founders and executives in brief; details go in the people list.' },
  { key: 'talent', label: 'Talent signals', group: 'People', multiline: true, guide: 'Where founders and key hires came from (for example OpenAI, Anthropic, Google DeepMind, Meta AI), recent senior hires or departures, and hiring focus.' },
  { key: 'partners', label: 'Main partners', group: 'Ecosystem and dependencies', multiline: true, guide: 'Technology, cloud, reseller and systems integrator partners, especially in Singapore or Asia.' },
  { key: 'supplyChain', label: 'Supply-chain dependencies', group: 'Ecosystem and dependencies', multiline: true, guide: 'Who they depend on: cloud providers, GPU or chip suppliers, foundation model providers, data providers. Note any single points of failure or exposure to export controls.' },
  { key: 'localPresence', label: 'Local presence', group: 'Ecosystem and dependencies', guide: 'Singapore or Southeast Asia office, team, data centre region or partners.' },
  { key: 'certifications', label: 'Security certifications', group: 'Risk and signals', guide: 'SOC 2, ISO 27001, CSA STAR, MTCS (Singapore) and similar.' },
  { key: 'competitors', label: 'Competitors', group: 'Risk and signals', guide: 'Main competitors.' },
  { key: 'recentNews', label: 'Recent news', group: 'Risk and signals', multiline: true, guide: 'The most important news from the last 12 months, each with a date.' },
  { key: 'risks', label: 'Risks and controversies', group: 'Risk and signals', multiline: true, guide: 'Lawsuits, security incidents, outages, regulatory action, financial distress or key departures.' },
  { key: 'openQuestions', label: 'Open questions', group: 'Risk and signals', multiline: true, guide: 'What could not be confirmed from public sources and should be asked in the meeting.' }
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
