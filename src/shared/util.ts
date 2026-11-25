import { FRESHNESS_DAYS } from './catalog'
import type { Sourced } from './types'

export function newId(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefix ? `${prefix}_${rand}` : rand
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function daysBetween(fromIsoDate: string, to: Date = new Date()): number {
  const from = new Date(fromIsoDate)
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}

export type Freshness = 'fresh' | 'stale' | 'unverified' | 'empty'

/** Freshness rule: every field has a checked date; older than 30 days is stale. */
export function fieldFreshness(field: Sourced | undefined, now: Date = new Date()): Freshness {
  if (!field || !field.value.trim()) return 'empty'
  if (!field.sourceUrl || !field.checkedAt) return 'unverified'
  return daysBetween(field.checkedAt, now) > FRESHNESS_DAYS ? 'stale' : 'fresh'
}

/** Normalises text so near-identical questions can be de-duplicated. */
export function normaliseText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Parses the first JSON object or array in an LLM reply, tolerating code fences and chatter. */
export function parseJsonLoose<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : text
  const start = body.search(/[[{]/)
  if (start < 0) return null
  const open = body[start]
  const close = open === '{' ? '}' : ']'
  const end = body.lastIndexOf(close)
  if (end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1)) as T
  } catch {
    return null
  }
}
