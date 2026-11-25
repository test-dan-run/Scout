import { assertLocalEndpoint } from '../shared/llm'
import type { ChatMessage, Settings } from '../shared/types'

export interface GatewayStatus {
  ok: boolean
  provider: Settings['llmProvider']
  message: string
  models: string[]
}

const TIMEOUT_MS = 120_000

/**
 * One interface over local models served by Ollama or LM Studio (design doc, Architecture).
 * Every request passes assertLocalEndpoint, so meeting data cannot reach a cloud endpoint.
 */
export class Gateway {
  constructor(private readonly getSettings: () => Settings) {}

  async status(): Promise<GatewayStatus> {
    const s = this.getSettings()
    if (s.llmProvider === 'none') {
      return { ok: false, provider: 'none', message: 'No local model set. Scout uses built-in templates.', models: [] }
    }
    try {
      const base = assertLocalEndpoint(s.llmBaseUrl)
      const url = s.llmProvider === 'ollama' ? new URL('/api/tags', base) : new URL('/v1/models', base)
      const res = await fetchWithTimeout(url, { method: 'GET' }, 5000)
      if (!res.ok) return { ok: false, provider: s.llmProvider, message: `Model server replied ${res.status}`, models: [] }
      const body = (await res.json()) as { models?: { name: string }[]; data?: { id: string }[] }
      const models = s.llmProvider === 'ollama' ? (body.models ?? []).map((m) => m.name) : (body.data ?? []).map((m) => m.id)
      const hasModel = !!s.llmModel && models.includes(s.llmModel)
      return {
        ok: hasModel,
        provider: s.llmProvider,
        message: hasModel ? `Connected to ${s.llmModel}` : s.llmModel ? `Model "${s.llmModel}" not found on the server` : 'Pick a model',
        models
      }
    } catch (e) {
      return { ok: false, provider: s.llmProvider, message: (e as Error).message, models: [] }
    }
  }

  async chat(messages: ChatMessage[], opts: { json?: boolean } = {}): Promise<string> {
    const s = this.getSettings()
    if (s.llmProvider === 'none') throw new Error('No local model is set up. Choose one in Settings.')
    if (!s.llmModel) throw new Error('No model chosen. Pick one in Settings.')
    const base = assertLocalEndpoint(s.llmBaseUrl)
    if (s.llmProvider === 'ollama') {
      const url = assertLocalEndpoint(new URL('/api/chat', base).toString())
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: s.llmModel, messages, stream: false, ...(opts.json ? { format: 'json' } : {}), options: { temperature: 0.2 } })
      })
      if (!res.ok) throw new Error(`Ollama replied ${res.status}: ${await res.text()}`)
      const body = (await res.json()) as { message?: { content?: string } }
      return body.message?.content ?? ''
    }
    const url = assertLocalEndpoint(new URL('/v1/chat/completions', base).toString())
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: s.llmModel, messages, temperature: 0.2, stream: false })
    })
    if (!res.ok) throw new Error(`LM Studio replied ${res.status}: ${await res.text()}`)
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return body.choices?.[0]?.message?.content ?? ''
  }
}

async function fetchWithTimeout(url: URL, init: RequestInit, ms = TIMEOUT_MS): Promise<Response> {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    // redirect: 'error' so a local server cannot bounce the request to a remote host.
    return await fetch(url, { ...init, redirect: 'error', signal: ctl.signal })
  } finally {
    clearTimeout(t)
  }
}
