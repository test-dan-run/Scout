import { RUBRIC } from './rubric'
import type { CriterionKey, ExtractedItem } from './types'
import { newId, normaliseText, parseJsonLoose } from './util'

const CONCERN_WORDS =
  /\b(concern|worr|risk|issue|problem|careful|must|need to|needs to|should|cannot|can't|not allowed|require|ensure|make sure|unclear|check|confirm|avoid|danger|liabilit|complian|pdpa|leak|lock-?in)\w*/i

/** Keyword hints that map an expert's sentence to a rubric criterion. */
const CRITERION_HINTS: [CriterionKey, RegExp][] = [
  ['security', /\b(secur|pdpa|privacy|data protection|retention|retain|audit|certif|soc ?2|iso ?27001|encrypt|leak|train(ing)? on|customer-managed key|byok|kms|keys?\b)\w*/i],
  ['deployment', /\b(on-?prem|vpc|air-?gap|hosting|host|region|singapore|residency|deploy)\w*/i],
  ['cost', /\b(cost|price|pricing|licen[cs]e|budget|spend|fee)\w*/i],
  ['openness', /\b(lock-?in|open[- ]weight|bring your own|byom|switch(ing)? models?|model choice)\w*/i],
  ['integration', /\b(sso|saml|oidc|api|sdk|integrat)\w*/i],
  ['maturity', /\b(production|uptime|sla|stable|stability|maturity|reference customer)\w*/i],
  ['viability', /\b(funding|runway|local (team|presence)|partner|support (model|team|hours)|startup)\w*/i],
  ['workplace_fit', /\b(use case|our team|workflow|fit)\w*/i]
]

export function guessCriterion(text: string): CriterionKey | undefined {
  for (const [key, re] of CRITERION_HINTS) if (re.test(text)) return key
  return undefined
}

/**
 * Pulls concerns and questions out of a pasted email or chat message without a model.
 * Each item still needs the scout to confirm it (design doc, Stage 2).
 */
export function extractHeuristic(raw: string): ExtractedItem[] {
  const cleaned = raw
    .split('\n')
    .filter((l) => !/^\s*(>|from:|to:|cc:|sent:|subject:|date:|on .* wrote:)/i.test(l))
    .filter((l) => !/^\s*(hi|hello|dear|thanks|thank you|regards|best|cheers)\b[^.?!]{0,30}$/i.test(l))
    .join('\n')
  const parts = cleaned
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim().replace(/^[-*•\d.)\s]+/, ''))
    .filter((s) => s.length > 12)
  const items: ExtractedItem[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const isQuestion = /\?\s*$/.test(p)
    if (!isQuestion && !CONCERN_WORDS.test(p)) continue
    const key = normaliseText(p)
    if (seen.has(key)) continue
    seen.add(key)
    const text = isQuestion ? p : tidyConcern(p)
    items.push({ id: newId('x'), kind: isQuestion ? 'question' : 'concern', text, criterion: guessCriterion(p), confirmed: null })
  }
  return items
}

export function expertExtractionPrompt(raw: string, role: string): { system: string; user: string } {
  const crits = RUBRIC.map((c) => `${c.key} (${c.name})`).join(', ')
  return {
    system:
      'You help a technical scout prepare for a vendor meeting. You read a message from a subject-matter expert and list the concerns and questions it raises. Reply with JSON only.',
    user: `The expert's role: ${role || 'not given'}.

List every distinct concern or question the expert raises about the vendor. Keep each one short and in plain words. Do not invent anything that is not in the message.

Reply with a JSON array of objects: {"kind": "concern" | "question", "text": string, "criterion": one of [${crits}] or null}.

Message:
"""
${raw}
"""`
  }
}

export function parseExtraction(reply: string): ExtractedItem[] | null {
  const arr = parseJsonLoose<{ kind?: string; text?: string; criterion?: string | null }[]>(reply)
  if (!Array.isArray(arr)) return null
  const keys = new Set(RUBRIC.map((c) => c.key))
  return arr
    .filter((x) => x && typeof x.text === 'string' && x.text.trim())
    .map((x) => ({
      id: newId('x'),
      kind: x.kind === 'question' ? 'question' : 'concern',
      text: x.text!.trim(),
      criterion: x.criterion && keys.has(x.criterion as CriterionKey) ? (x.criterion as CriterionKey) : guessCriterion(x.text!),
      confirmed: null
    }))
}

/** "My main concern is that logs are kept offshore." becomes "Logs are kept offshore." */
export function tidyConcern(s: string): string {
  const t = s
    .trim()
    .replace(/^(my|our|one|the)\s+(main\s+|biggest\s+|key\s+|other\s+)?(concern|worry|issue|question)\s+(is|would be)\s+(that\s+|whether\s+)?/i, '')
    .replace(/^i\s*(am|'m)\s+(a bit\s+|quite\s+|very\s+)?(worried|concerned)\s+(that|about)\s+/i, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
