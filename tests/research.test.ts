import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, expect, it } from 'vitest'
import { runResearch } from '../src/main/research'
import { acceptAllSourced, acceptResearchedField, normaliseUrl, parseResearch, researchPrompt, researchRequestFor } from '../src/shared/research'
import { company } from './fixtures'

const reply = JSON.stringify({
  summary: 'Acme sells an AI platform.',
  fields: {
    valuation: { value: 'US$2B (Series C, 2026-03)', sources: ['https://news.example/acme-series-c?utm_source=x'], asOf: '2026-03', confidence: 'high' },
    supplyChain: { value: 'Runs on AWS; depends on NVIDIA GPUs.', sources: ['https://made-up.example/page'], confidence: 'medium' },
    revenue: { value: 'Not found', sources: [], confidence: 'high' },
    bogusField: { value: 'x', sources: [] }
  },
  people: [{ name: 'Jane Lee', role: 'CEO', background: 'Ex-research lead', notablePriorOrgs: ['OpenAI'], sourceUrl: 'https://acme.example/team' }]
})

describe('research parsing', () => {
  it('keeps known fields, flags sources the agent never saw, and downgrades "Not found"', () => {
    const r = parseResearch('Here it is:\n' + reply, ['https://www.news.example/acme-series-c/', 'https://acme.example/team'], 'claude-opus-5-5', '2026-11-25T00:00:00Z')!
    expect(Object.keys(r.fields).sort()).toEqual(['revenue', 'supplyChain', 'valuation'])
    expect(r.fields.valuation!.unseenSources).toEqual([])
    expect(r.fields.supplyChain!.unseenSources).toEqual(['https://made-up.example/page'])
    expect(r.fields.revenue!.confidence).toBe('low')
    expect(r.people[0]).toMatchObject({ name: 'Jane Lee', unseenSource: false })
  })

  it('accepts a field with its first seen source and the research date', () => {
    const r = parseResearch(reply, ['https://news.example/acme-series-c'], 'm', '2026-11-25T00:00:00Z')!
    const c = acceptResearchedField({ ...company(), research: r }, 'valuation')
    expect(c.profile.valuation).toEqual({ value: 'US$2B (Series C, 2026-03)', sourceUrl: 'https://news.example/acme-series-c?utm_source=x', checkedAt: '2026-11-25' })
    expect(c.research!.fields.valuation!.status).toBe('accepted')
  })

  it('"accept all" skips unsourced, unseen and not-found findings', () => {
    const r = parseResearch(reply, ['https://news.example/acme-series-c', 'https://acme.example/team'], 'm', '2026-11-25T00:00:00Z')!
    const c = acceptAllSourced({ ...company(), research: r })
    expect(c.profile.valuation?.value).toContain('US$2B')
    expect(c.profile.supplyChain).toBeUndefined()
    expect(c.profile.revenue).toBeUndefined()
    expect(c.people).toEqual([{ name: 'Jane Lee', role: 'CEO', background: 'Ex-research lead', notablePriorOrgs: ['OpenAI'], sourceUrl: 'https://acme.example/team' }])
  })

  it('normalises URLs for comparison', () => {
    expect(normaliseUrl('https://WWW.Example.com/a/?utm_source=x#top')).toBe('https://example.com/a')
  })

  it('sends only public company facts to the cloud model', () => {
    const req = researchRequestFor(company({ profile: { pitch: { value: 'SECRET internal note' } } }))
    expect(Object.keys(req).sort()).toEqual(['name', 'segment', 'website'])
    expect(researchPrompt(req)).not.toContain('SECRET')
  })
})

/** A stub of the Messages streaming API: first a paused turn with a search, then the final JSON. */
function sse(events: object[]): string {
  return events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join('')
}
function messageEvents(content: object[], stop: string): object[] {
  const ev: object[] = [
    { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }
  ]
  content.forEach((block, index) => {
    const b = block as { type: string; text?: string }
    if (b.type === 'text') {
      ev.push({ type: 'content_block_start', index, content_block: { type: 'text', text: '' } })
      ev.push({ type: 'content_block_delta', index, delta: { type: 'text_delta', text: b.text } })
    } else {
      ev.push({ type: 'content_block_start', index, content_block: block })
    }
    ev.push({ type: 'content_block_stop', index })
  })
  ev.push({ type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 10 } })
  ev.push({ type: 'message_stop' })
  return ev
}

describe('runResearch against a stub API', () => {
  it('continues paused turns, records pages seen and parses the profile', async () => {
    const bodies: { messages: unknown[]; tools: { type: string }[]; fallbacks: unknown }[] = []
    const server = createServer((req, res) => {
      let data = ''
      req.on('data', (c) => (data += c))
      req.on('end', () => {
        bodies.push(JSON.parse(data))
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        if (bodies.length === 1) {
          res.end(
            sse(
              messageEvents(
                [
                  { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'Acme AI funding' } },
                  { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://news.example/acme-series-c', title: 't', encrypted_content: 'x', page_age: null }] }
                ],
                'pause_turn'
              )
            )
          )
        } else {
          res.end(sse(messageEvents([{ type: 'text', text: reply }], 'end_turn')))
        }
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as AddressInfo).port
    const progress: string[] = []
    try {
      const r = await runResearch('test-key', researchRequestFor(company()), (m) => progress.push(m), new AbortController().signal, {
        baseURL: `http://127.0.0.1:${port}`
      })
      expect(bodies).toHaveLength(2)
      expect(bodies[0].tools.map((t) => t.type)).toEqual(['web_search_20260209', 'web_fetch_20260209'])
      expect(bodies[0].fallbacks).toBe('default')
      expect(bodies[1].messages).toHaveLength(2) // the paused assistant turn is sent back as-is
      expect(r.pagesSeen).toEqual(['https://news.example/acme-series-c'])
      expect(r.fields.valuation!.unseenSources).toEqual([])
      expect(r.costNote).toBe('1 search, 0 pages read')
      expect(progress.some((p) => p.includes('Acme AI funding'))).toBe(true)
    } finally {
      server.close()
    }
  })
})
