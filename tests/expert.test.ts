import { describe, expect, it } from 'vitest'
import { extractHeuristic, parseExtraction } from '../src/shared/expert'

describe('expert extraction', () => {
  const email = `Hi Dan,

Thanks for the heads up on the Databricks meeting.

My main concern is that model serving logs might be retained outside Singapore.
Can they support customer-managed encryption keys?
We also need to confirm they are not training on our data.
The weather has been lovely this week.

Regards,
Priya`

  it('pulls out concerns and questions, and skips greetings and small talk', () => {
    const items = extractHeuristic(email)
    expect(items.map((i) => i.kind)).toEqual(['concern', 'question', 'concern'])
    expect(items[1].text).toBe('Can they support customer-managed encryption keys?')
    expect(items.every((i) => i.confirmed === null)).toBe(true)
    expect(items[0].criterion).toBe('security')
  })

  it('parses a model reply with code fences and drops unknown criteria', () => {
    const reply = 'Here you go:\n```json\n[{"kind":"question","text":"Is there an SLA?","criterion":"maturity"},{"kind":"concern","text":"Cost","criterion":"nonsense"}]\n```'
    const items = parseExtraction(reply)!
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ kind: 'question', criterion: 'maturity' })
    expect(items[1].criterion).toBe('cost')
  })

  it('returns null for a reply that is not JSON', () => {
    expect(parseExtraction('sorry, I cannot help')).toBeNull()
  })
})

describe('tidyConcern and criterion hints', () => {
  it('drops "my concern is that" framing', async () => {
    const { tidyConcern, guessCriterion } = await import('../src/shared/expert')
    expect(tidyConcern('My main concern is that logs are kept offshore.')).toBe('Logs are kept offshore.')
    expect(tidyConcern("I'm worried that pricing will spike.")).toBe('Pricing will spike.')
    expect(guessCriterion('Can they support customer-managed keys?')).toBe('security')
  })
})
