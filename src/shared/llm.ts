import type { Company, ContextPack, Hypothesis, LlmProvider } from './types'
import { parseJsonLoose } from './util'

export const DEFAULT_BASE_URL: Record<LlmProvider, string> = {
  none: '',
  ollama: 'http://127.0.0.1:11434',
  lmstudio: 'http://127.0.0.1:1234'
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * The gateway only talks to models on this Mac. Everything in Phase 1 (Context Pack,
 * expert inputs, meeting notes) counts as meeting data, so any non-local endpoint is
 * refused here in code, not by a setting (design doc, "Security and privacy").
 */
export function assertLocalEndpoint(url: string): URL {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new Error(`Not a valid URL: ${url}`)
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error(`Unsupported protocol: ${u.protocol}`)
  if (!LOCAL_HOSTS.has(u.hostname)) {
    throw new Error(`Refused: ${u.hostname} is not a local endpoint. Scout only sends this data to models on this Mac.`)
  }
  if (u.username || u.password) throw new Error('Refused: credentials in the model URL are not allowed.')
  return u
}

export interface HypothesisDraft {
  capability: string
  problemCode: string
  outcome: string
  metric: string
}

export function hypothesisPrompt(company: Company, pack: ContextPack): { system: string; user: string } {
  const profile = Object.entries(company.profile)
    .filter(([, v]) => v?.value.trim())
    .map(([k, v]) => `${k}: ${v!.value}`)
    .join('\n')
  const problems = pack.problems
    .map((p) => `${p.code}: ${p.title}. ${p.description} (success measure: ${p.successMeasure})`)
    .join('\n')
  return {
    system:
      'You help a technical scout map a vendor to their team\'s problems. Be concrete and conservative: only propose links the profile supports. Reply with JSON only.',
    user: `Our team: ${pack.mission}
Our AI stack: ${pack.aiStack}
Known pain points: ${pack.painPoints}

Our problem statements:
${problems || '(none)'}

Vendor: ${company.name} (${company.segment})
${profile}

Propose up to 4 augmentation hypotheses in the form "If we used capability X for problem Y, we expect outcome Z, measured by metric M".
Reply with a JSON array of {"capability": string, "problemCode": string, "outcome": string, "metric": string}. Use only the problem codes listed above.`
  }
}

export function parseHypotheses(reply: string, pack: ContextPack): (HypothesisDraft & { problemId: string })[] {
  const arr = parseJsonLoose<Partial<HypothesisDraft>[]>(reply)
  if (!Array.isArray(arr)) return []
  const byCode = new Map(pack.problems.map((p) => [p.code.toUpperCase(), p.id]))
  return arr
    .filter((h) => h && h.capability && h.problemCode && byCode.has(String(h.problemCode).toUpperCase()))
    .map((h) => ({
      capability: String(h.capability),
      problemCode: String(h.problemCode),
      outcome: String(h.outcome ?? ''),
      metric: String(h.metric ?? ''),
      problemId: byCode.get(String(h.problemCode).toUpperCase())!
    }))
}

export function briefPolishPrompt(
  company: Company,
  pack: ContextPack,
  hypotheses: Hypothesis[],
  draft: { whyItMatters: string; opening: string }
): { system: string; user: string } {
  const hyps = hypotheses
    .filter((h) => h.status === 'accepted')
    .map((h) => `- If we used ${h.capability}, we expect ${h.outcome} (metric: ${h.metric})`)
    .join('\n')
  return {
    system:
      'You edit meeting briefs. Write in plain, short sentences. Do not add facts that are not given. Reply with JSON only.',
    user: `Rewrite these two parts of a 1-page meeting brief for a meeting with ${company.name}.
Team mission: ${pack.mission}
Hypotheses:
${hyps || '(none)'}

"whyItMatters" (2 to 3 sentences): ${draft.whyItMatters}
"opening" (what we say first, 3 to 4 sentences): ${draft.opening}

Reply with {"whyItMatters": string, "opening": string}.`
  }
}
