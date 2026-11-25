import { describe, expect, it } from 'vitest'
import { assertLocalEndpoint, parseHypotheses } from '../src/shared/llm'
import { pack } from './fixtures'

describe('assertLocalEndpoint', () => {
  it.each(['http://127.0.0.1:11434', 'http://localhost:1234/v1', 'http://[::1]:11434'])('allows %s', (url) => {
    expect(() => assertLocalEndpoint(url)).not.toThrow()
  })

  it.each([
    'https://api.anthropic.com',
    'http://192.168.1.20:11434',
    'http://localhost.evil.com',
    'http://127.0.0.1.nip.io',
    'http://user:pw@localhost:11434',
    'file:///etc/passwd',
    'not a url'
  ])('refuses %s', (url) => {
    expect(() => assertLocalEndpoint(url)).toThrow()
  })
})

describe('parseHypotheses', () => {
  it('keeps only hypotheses that point to a known problem code', () => {
    const reply = '[{"capability":"agents","problemCode":"p1","outcome":"faster","metric":"hours"},{"capability":"x","problemCode":"P9","outcome":"","metric":""}]'
    const out = parseHypotheses(reply, pack())
    expect(out).toHaveLength(1)
    expect(out[0].problemId).toBe('p1')
  })
})
