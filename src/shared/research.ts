import { PROFILE_FIELDS } from './catalog'
import type { Company, CompanyResearch, Person, ProfileFieldKey, ResearchConfidence, ResearchedField } from './types'
import { parseJsonLoose, today } from './util'

export const RESEARCH_MODEL = 'claude-opus-5-5'

/**
 * Only public facts about the company go to the cloud model: its name, website and
 * segment. Nothing from the Context Pack, expert inputs or meetings is ever included
 * (design doc: cloud use is limited to Stage 1, which only handles public web data).
 */
export interface ResearchRequest {
  name: string
  website?: string
  segment: string
}

export function researchRequestFor(company: Company): ResearchRequest {
  return { name: company.name, website: company.website || undefined, segment: company.segment }
}

export const RESEARCH_SYSTEM = `You are a technology scouting analyst. You build accurate, well-sourced profiles of companies that sell AI platforms, for an enterprise team in Singapore that evaluates vendors.

Rules:
- Use web_search and web_fetch to research. Prefer primary and reputable sources: the company's own site and docs, press releases, regulatory filings, investor announcements, and established business and technology press. Use data aggregators only when nothing better exists, and say so.
- Every fact needs a source URL that you actually opened or saw in search results. Never invent a URL.
- Give dates for anything that changes over time (funding, valuation, headcount, news).
- If you cannot find something, say "Not found" and add it to open questions. Do not guess. Mark estimates as estimates.
- Be specific and complete. Write in plain sentences or short semicolon-separated lists.`

export function researchPrompt(req: ResearchRequest, asOf = today()): string {
  const fields = PROFILE_FIELDS.map((f) => `- "${f.key}" (${f.label}): ${f.guide}`).join('\n')
  return `Research this company and build a full profile as of ${asOf}.

Company: ${req.name}
Website: ${req.website ?? 'unknown'}
Segment: ${req.segment}

If the company is a product line of a larger firm (for example a cloud provider's AI platform), profile the product, and use the parent company for money, people and supply-chain fields, saying so.

Fields to fill:
${fields}

People: list founders, the CEO, CTO and other key executives, and notable hires. For each, give their role, a one-line background, and any notable earlier employers, especially frontier AI labs and big tech (OpenAI, Anthropic, Google DeepMind, Google, Meta, Microsoft, NVIDIA, Apple, Amazon).

When you are done researching, reply with only one JSON object, with no other text, in this shape:
{
  "summary": "3 to 5 sentences: what they are, how they make money, and what stands out for an enterprise buyer in Singapore",
  "fields": {
    "<field key>": { "value": "...", "sources": ["https://..."], "asOf": "YYYY-MM or YYYY-MM-DD or empty", "confidence": "low" | "medium" | "high" }
  },
  "people": [
    { "name": "...", "role": "...", "background": "...", "notablePriorOrgs": ["..."], "sourceUrl": "https://..." }
  ]
}
Include every field key listed above.`
}

interface RawField {
  value?: unknown
  sources?: unknown
  asOf?: unknown
  confidence?: unknown
}

interface RawResearch {
  summary?: unknown
  fields?: Record<string, RawField>
  people?: Partial<Person>[]
}

/** Normalises a URL for comparison: lower-case host, no trailing slash, no fragment, no tracking query. */
export function normaliseUrl(u: string): string {
  try {
    const url = new URL(u.trim())
    url.hash = ''
    for (const k of [...url.searchParams.keys()]) if (/^utm_|^ref$|^fbclid$|^gclid$/.test(k)) url.searchParams.delete(k)
    const s = `${url.protocol}//${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/+$/, '')}${url.search}`
    return s
  } catch {
    return u.trim()
  }
}

/**
 * Turns the agent's final JSON into a research record. Sources that the agent did not
 * actually see during its searches and fetches are kept but flagged, so the scout can
 * spot a made-up or misremembered link before accepting the field.
 */
export function parseResearch(text: string, pagesSeen: string[], model: string, ranAt: string): CompanyResearch | null {
  const raw = parseJsonLoose<RawResearch>(text)
  if (!raw || typeof raw !== 'object' || !raw.fields || typeof raw.fields !== 'object') return null
  const seen = new Set(pagesSeen.map(normaliseUrl))
  const keys = new Set(PROFILE_FIELDS.map((f) => f.key))
  const fields: Partial<Record<ProfileFieldKey, ResearchedField>> = {}
  for (const [key, f] of Object.entries(raw.fields)) {
    if (!keys.has(key as ProfileFieldKey) || !f) continue
    const value = typeof f.value === 'string' ? f.value.trim() : ''
    if (!value) continue
    const sources = Array.isArray(f.sources) ? f.sources.filter((s): s is string => typeof s === 'string' && /^https?:\/\//.test(s)) : []
    const confidence: ResearchConfidence = f.confidence === 'high' || f.confidence === 'medium' ? f.confidence : 'low'
    fields[key as ProfileFieldKey] = {
      value,
      sources,
      asOf: typeof f.asOf === 'string' && f.asOf.trim() ? f.asOf.trim() : undefined,
      confidence: /^not found/i.test(value) ? 'low' : confidence,
      unseenSources: sources.filter((s) => !seen.has(normaliseUrl(s))),
      status: 'proposed'
    }
  }
  const people = (Array.isArray(raw.people) ? raw.people : [])
    .filter((p) => p && typeof p.name === 'string' && p.name.trim())
    .map((p) => {
      const sourceUrl = typeof p.sourceUrl === 'string' && /^https?:\/\//.test(p.sourceUrl) ? p.sourceUrl : undefined
      return {
        name: String(p.name).trim(),
        role: String(p.role ?? ''),
        background: String(p.background ?? ''),
        notablePriorOrgs: Array.isArray(p.notablePriorOrgs) ? p.notablePriorOrgs.map(String).filter(Boolean) : [],
        sourceUrl,
        unseenSource: sourceUrl ? !seen.has(normaliseUrl(sourceUrl)) : undefined
      }
    })
  return {
    ranAt,
    model,
    summary: typeof raw.summary === 'string' ? raw.summary.trim() : '',
    fields,
    people,
    pagesSeen: [...new Set(pagesSeen)]
  }
}

/** Copies a researched field into the profile, with its first seen source and the research date. */
export function acceptResearchedField(company: Company, key: ProfileFieldKey): Company {
  const r = company.research?.fields[key]
  if (!r || !company.research) return company
  const primary = r.sources.find((s) => !r.unseenSources.includes(s)) ?? r.sources[0]
  const extra = r.sources.filter((s) => s !== primary)
  const value = extra.length ? `${r.value}\n\nMore sources: ${extra.join(' ')}` : r.value
  return {
    ...company,
    profile: {
      ...company.profile,
      [key]: { value, sourceUrl: primary, checkedAt: company.research.ranAt.slice(0, 10) }
    },
    research: { ...company.research, fields: { ...company.research.fields, [key]: { ...r, status: 'accepted' } } }
  }
}

export function dismissResearchedField(company: Company, key: ProfileFieldKey): Company {
  const r = company.research?.fields[key]
  if (!r || !company.research) return company
  return { ...company, research: { ...company.research, fields: { ...company.research.fields, [key]: { ...r, status: 'dismissed' } } } }
}

/** Accepts every proposed field that has at least one source the agent actually saw, plus the people list. */
export function acceptAllSourced(company: Company): Company {
  let c = company
  for (const [key, r] of Object.entries(company.research?.fields ?? {})) {
    if (r && r.status === 'proposed' && r.sources.some((s) => !r.unseenSources.includes(s)) && !/^not found/i.test(r.value)) {
      c = acceptResearchedField(c, key as ProfileFieldKey)
    }
  }
  return acceptPeople(c)
}

export function acceptPeople(company: Company): Company {
  if (!company.research) return company
  return { ...company, people: company.research.people.map(({ unseenSource: _u, ...p }) => p) }
}

/** People who came from frontier AI labs or big tech, for the talent signal. */
export const NOTABLE_ORGS = /openai|anthropic|deepmind|google|meta|facebook|microsoft|nvidia|apple|amazon|aws|tesla|x\.ai|xai|mistral|cohere/i

export function notablePeople(people: Person[]): Person[] {
  return people.filter((p) => p.notablePriorOrgs.some((o) => NOTABLE_ORGS.test(o)))
}
