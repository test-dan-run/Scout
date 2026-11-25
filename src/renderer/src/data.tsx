import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { emptyContextPack, defaultSettings } from '@shared/seed'
import type { ContextPack, Kind, RecordKinds, Settings } from '@shared/types'
import { nowIso } from '@shared/util'
import { bridge, listAll } from './api'

type Collections = { [K in Kind]: RecordKinds[K][] }

const KINDS: Kind[] = ['companies', 'engagements', 'contextPack', 'experts', 'hypotheses', 'questions', 'briefs', 'meetings', 'writeups', 'settings']

interface DataApi {
  data: Collections
  loaded: boolean
  pack: ContextPack
  settings: Settings
  put<K extends Kind>(kind: K, rec: RecordKinds[K]): void
  putMany<K extends Kind>(kind: K, recs: RecordKinds[K][]): void
  remove(kind: Kind, id: string): void
  removeEngagement(id: string): void
}

const Ctx = createContext<DataApi | null>(null)

/**
 * Holds every record in memory (the data set is small) and writes each change
 * straight through to the encrypted store in the main process.
 */
export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Collections>(() => Object.fromEntries(KINDS.map((k) => [k, []])) as unknown as Collections)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void Promise.all(KINDS.map((k) => listAll(k))).then((lists) => {
      setData(Object.fromEntries(KINDS.map((k, i) => [k, lists[i]])) as unknown as Collections)
      setLoaded(true)
    })
  }, [])

  const put = useCallback(<K extends Kind>(kind: K, rec: RecordKinds[K]) => {
    const stamped = 'updatedAt' in rec ? { ...rec, updatedAt: nowIso() } : rec
    setData((d) => ({ ...d, [kind]: upsert(d[kind] as { id: string }[], stamped as { id: string }) }))
    void bridge().put(kind, stamped)
  }, [])

  const putMany = useCallback(<K extends Kind>(kind: K, recs: RecordKinds[K][]) => {
    if (!recs.length) return
    setData((d) => ({ ...d, [kind]: recs.reduce((acc, r) => upsert(acc, r as { id: string }), d[kind] as { id: string }[]) }))
    void bridge().putMany(kind, recs)
  }, [])

  const remove = useCallback((kind: Kind, id: string) => {
    setData((d) => ({ ...d, [kind]: (d[kind] as { id: string }[]).filter((r) => r.id !== id) }))
    void bridge().remove(kind, id)
  }, [])

  const removeEngagement = useCallback((id: string) => {
    setData((d) => {
      const next = { ...d } as Record<Kind, { id: string; engagementId?: string }[]>
      for (const k of KINDS) next[k] = next[k].filter((r) => r.engagementId !== id && !(k === 'engagements' && r.id === id))
      return next as unknown as Collections
    })
    void bridge().removeEngagement(id)
  }, [])

  const value = useMemo<DataApi>(
    () => ({
      data,
      loaded,
      pack: data.contextPack[0] ?? emptyContextPack(),
      settings: data.settings[0] ?? defaultSettings(),
      put,
      putMany,
      remove,
      removeEngagement
    }),
    [data, loaded, put, putMany, remove, removeEngagement]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): DataApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData outside DataProvider')
  return v
}

/** Everything that belongs to one engagement. */
export function useEngagement(engagementId: string) {
  const { data } = useData()
  return useMemo(() => {
    const engagement = data.engagements.find((e) => e.id === engagementId)
    const company = engagement ? data.companies.find((c) => c.id === engagement.companyId) : undefined
    return {
      engagement,
      company,
      hypotheses: data.hypotheses.filter((h) => h.engagementId === engagementId),
      questions: data.questions.filter((q) => q.engagementId === engagementId),
      brief: data.briefs.find((b) => b.id === engagementId),
      meeting: data.meetings.find((m) => m.id === engagementId),
      writeup: data.writeups.find((w) => w.id === engagementId),
      experts: data.experts.filter((x) => !x.companyId || x.companyId === engagement?.companyId)
    }
  }, [data, engagementId])
}

function upsert<T extends { id: string }>(list: T[], rec: T): T[] {
  const i = list.findIndex((r) => r.id === rec.id)
  if (i < 0) return [...list, rec]
  const next = list.slice()
  next[i] = rec
  return next
}

export type EngagementCtx = ReturnType<typeof useEngagement> & {
  engagement: NonNullable<ReturnType<typeof useEngagement>['engagement']>
  company: NonNullable<ReturnType<typeof useEngagement>['company']>
}
