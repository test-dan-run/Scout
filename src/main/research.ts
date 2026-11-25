import Anthropic from '@anthropic-ai/sdk'
import { parseResearch, RESEARCH_MODEL, RESEARCH_SYSTEM, researchPrompt, type ResearchRequest } from '../shared/research'
import type { CompanyResearch } from '../shared/types'

export type ResearchProgress = (message: string) => void

const MAX_CONTINUATIONS = 8

/**
 * Stage 1 research agent: Claude with server-side web search and web fetch.
 * It receives only the public ResearchRequest (name, website, segment) and never any
 * workplace or meeting data.
 */
export async function runResearch(
  apiKey: string | undefined,
  req: ResearchRequest,
  progress: ResearchProgress,
  signal: AbortSignal,
  /** For tests: point the client at a stub server. */
  clientOptions: { baseURL?: string } = {}
): Promise<CompanyResearch> {
  // Without a saved key, the SDK falls back to ANTHROPIC_API_KEY or an `ant auth login` profile.
  const client = apiKey ? new Anthropic({ apiKey, ...clientOptions }) : new Anthropic(clientOptions)
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: researchPrompt(req) }]
  const pagesSeen: string[] = []
  let searches = 0
  let fetches = 0
  let final: Anthropic.Beta.BetaMessage | null = null

  const step = async (): Promise<Anthropic.Beta.BetaMessage> => {
    const stream = client.beta.messages.stream(
      {
        model: RESEARCH_MODEL,
        max_tokens: 64000,
        system: RESEARCH_SYSTEM,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        // If a safety classifier declines, the API re-runs the request on a fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        tools: [
          { type: 'web_search_20260209', name: 'web_search', max_uses: 25 },
          { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 25 }
        ],
        messages
      },
      { signal }
    )
    stream.on('contentBlock', (block) => {
      if (block.type === 'server_tool_use') {
        const input = block.input as { query?: string; url?: string }
        if (block.name === 'web_search' && input.query) progress(`Searching: ${input.query} (${++searches} searches)`)
        if (block.name === 'web_fetch' && input.url) progress(`Reading: ${input.url} (${++fetches} pages)`)
      } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === 'web_search_result') pagesSeen.push(r.url)
      } else if (block.type === 'web_fetch_tool_result' && block.content.type === 'web_fetch_result') {
        pagesSeen.push(block.content.url)
      }
    })
    return stream.finalMessage()
  }

  progress('Starting research…')
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const msg = await step()
    messages.push({ role: 'assistant', content: msg.content })
    if (msg.stop_reason === 'pause_turn') {
      progress('Still researching…')
      continue
    }
    if (msg.stop_reason === 'refusal') throw new Error('The model declined to research this company.')
    if (msg.stop_reason === 'max_tokens') throw new Error('The research reply was cut off. Try again.')
    final = msg
    break
  }
  if (!final) throw new Error('Research did not finish within the step limit. Try again.')

  progress('Writing the profile…')
  const ranAt = new Date().toISOString()
  let result = parseResearch(textOf(final), pagesSeen, final.model, ranAt)
  if (!result) {
    // Ask once more for the JSON on its own if the reply mixed it with prose.
    messages.push({ role: 'user', content: 'Reply with only the JSON object described earlier, with no other text.' })
    const retry = await step()
    result = parseResearch(textOf(retry), pagesSeen, retry.model, ranAt)
  }
  if (!result) throw new Error('The research reply could not be read as a profile. Try again.')
  result.costNote = `${plural(searches, 'search', 'searches')}, ${plural(fetches, 'page', 'pages')} read`
  return result
}

function textOf(msg: Anthropic.Beta.BetaMessage): string {
  return msg.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'The Anthropic API key was rejected. Check it in Settings.'
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key does not have access to that model or tool.'
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by the Anthropic API. Wait a minute and try again.'
  if (e instanceof Anthropic.APIUserAbortError) return 'Research cancelled.'
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the Anthropic API. Check your connection.'
  if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status ?? ''}: ${e.message}`
  return (e as Error).message
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
