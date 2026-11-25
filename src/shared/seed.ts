import { DEFAULT_BASE_URL } from './llm'
import { emptyScores } from './rubric'
import type { Company, ContextPack, Engagement, Settings, Sourced } from './types'
import { newId, nowIso } from './util'

/** Unverified starter facts: no source URL or checked date, so the app flags them for confirmation. */
const u = (value: string): Sourced => ({ value })

const PILOTS: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Microsoft Azure AI Foundry',
    segment: 'Cloud AI platforms',
    website: 'https://ai.azure.com',
    profile: {
      pitch: u('Microsoft\'s platform for building, evaluating and deploying AI apps and agents on Azure.'),
      products: u('Model catalog (OpenAI and other model families), agent service, evaluations, content safety, prompt flow.'),
      deployment: u('Azure cloud regions, including Southeast Asia (Singapore). Private networking options.'),
      targetCustomers: u('Enterprises already on Azure and Microsoft 365.'),
      competitors: u('AWS Bedrock, Google Vertex AI, Databricks.'),
      openQuestions: u('Which models and features are available in the Singapore region? What are data handling terms per model provider?')
    }
  },
  {
    name: 'Databricks',
    segment: 'Data and AI platforms',
    website: 'https://www.databricks.com',
    profile: {
      pitch: u('Data and AI platform that combines data engineering, model training, serving and agents.'),
      products: u('Lakehouse platform, Unity Catalog governance, Mosaic AI (model serving, fine-tuning, agent framework, evaluation).'),
      deployment: u('Runs on AWS, Azure and Google Cloud, in the customer\'s cloud account.'),
      targetCustomers: u('Enterprises with large data platforms.'),
      competitors: u('Snowflake, cloud AI platforms, Dataiku.'),
      openQuestions: u('How much of the AI stack runs inside our cloud account? Pricing model for serving at our volume?')
    }
  },
  {
    name: 'LangChain',
    segment: 'Agent and orchestration frameworks',
    website: 'https://www.langchain.com',
    profile: {
      pitch: u('Open-source agent frameworks (LangChain, LangGraph) plus LangSmith for tracing, evaluation and deployment.'),
      products: u('LangChain and LangGraph (open source), LangSmith (observability, evaluation, agent deployment).'),
      deployment: u('LangSmith as SaaS, with self-hosted options for enterprise.'),
      targetCustomers: u('Engineering teams building LLM apps and agents.'),
      competitors: u('LlamaIndex, cloud agent services, Arize, Galileo.'),
      openQuestions: u('Self-hosted LangSmith requirements? Local presence or partners in Singapore?')
    }
  }
]

export function seedCompanies(): { companies: Company[]; engagements: Engagement[] } {
  const now = nowIso()
  const companies: Company[] = PILOTS.map((p) => ({ ...p, id: newId('co'), createdAt: now, updatedAt: now }))
  const engagements: Engagement[] = companies.map((c) => ({
    id: newId('eng'),
    companyId: c.id,
    round: 1,
    stage: 'prepare',
    status: 'active',
    owner: '',
    scores: emptyScores(),
    hardChecks: {},
    createdAt: now,
    updatedAt: now
  }))
  return { companies, engagements }
}

export function emptyContextPack(): ContextPack {
  return {
    id: 'main',
    teamName: '',
    mission: '',
    priorities: '',
    aiStack: '',
    painPoints: '',
    constraints: [],
    problems: [],
    pastEngagements: [],
    updatedAt: nowIso()
  }
}

export function defaultSettings(): Settings {
  return { id: 'main', userName: '', llmProvider: 'none', llmBaseUrl: DEFAULT_BASE_URL.ollama, llmModel: '' }
}
