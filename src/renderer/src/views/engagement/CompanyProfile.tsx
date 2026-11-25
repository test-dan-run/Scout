import { useEffect, useState } from 'react'
import { PROFILE_FIELDS, PROFILE_GROUPS } from '@shared/catalog'
import { acceptAllSourced, acceptPeople, acceptResearchedField, dismissResearchedField, NOTABLE_ORGS } from '@shared/research'
import type { Company, Person, ProfileFieldKey, ResearchedField, Sourced } from '@shared/types'
import { daysBetween, fieldFreshness, today, type Freshness } from '@shared/util'
import { bridge } from '../../api'
import { Badge, Empty, Section, TextArea, TextField } from '../../components/ui'
import { useData } from '../../data'

const FRESH_BADGE: Record<Freshness, { tone: 'good' | 'warn' | 'bad' | 'neutral'; label: string }> = {
  fresh: { tone: 'good', label: 'Checked' },
  stale: { tone: 'warn', label: 'Older than 30 days' },
  unverified: { tone: 'bad', label: 'No source' },
  empty: { tone: 'neutral', label: 'Empty' }
}

export function CompanyProfile({ company }: { company: Company }) {
  const { put } = useData()
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [editing, setEditing] = useState<ProfileFieldKey | null>(null)

  useEffect(() => {
    void bridge().hasApiKey().then(setHasKey)
    return bridge().onResearchProgress((p) => {
      if (p.companyId === company.id) setProgress((prev) => [...prev.slice(-7), p.message])
    })
  }, [company.id])

  const save = (c: Company) => put('companies', c)
  const setField = (key: ProfileFieldKey, patch: Partial<Sourced>) => {
    const prev = company.profile[key] ?? { value: '' }
    save({ ...company, profile: { ...company.profile, [key]: { ...prev, ...patch } } })
  }

  const run = async () => {
    setRunning(true)
    setError(null)
    setProgress([])
    try {
      save(await bridge().research(company.id))
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setRunning(false)
    }
  }

  const r = company.research
  const proposed = Object.values(r?.fields ?? {}).filter((f) => f?.status === 'proposed').length
  const flagged = PROFILE_FIELDS.filter((f) => ['stale', 'unverified'].includes(fieldFreshness(company.profile[f.key])))
  const researchAge = r ? daysBetween(r.ranAt) : null

  return (
    <>
      <Section
        title="Research"
        actions={
          <>
            {running ? (
              <button onClick={() => void bridge().cancelResearch(company.id)}>Cancel</button>
            ) : (
              <button className="primary" disabled={hasKey === false} onClick={() => void run()} title={hasKey === false ? 'Add an Anthropic API key in Settings' : undefined}>
                {r ? 'Research again' : 'Research this company'}
              </button>
            )}
            {proposed > 0 && !running && <button onClick={() => save(acceptAllSourced(company))}>Accept all sourced findings</button>}
          </>
        }
      >
        <p className="muted small">
          Claude searches the web and reads the company's site, filings, press and partner pages, then proposes every profile field
          with its sources. Only the company's name, website and segment are sent; nothing from your Context Pack, experts or meetings.
          You review each finding before it goes into the profile. A run takes a few minutes.
        </p>
        {hasKey === false && <p className="note warn">Add an Anthropic API key in Settings to use research.</p>}
        {running && (
          <div className="research-log">
            {progress.map((p, i) => (
              <div key={i} className={i === progress.length - 1 ? '' : 'muted'}>
                {p}
              </div>
            ))}
            {progress.length === 0 && <div className="muted">Starting…</div>}
          </div>
        )}
        {error && <p className="note warn">{error}</p>}
        {r && !running && (
          <>
            <div className="row small">
              <Badge tone={researchAge! > 30 ? 'warn' : 'info'}>
                Researched {r.ranAt.slice(0, 10)}
                {researchAge! > 30 ? ', older than 30 days' : ''}
              </Badge>
              <span className="muted">
                {r.model}
                {r.costNote ? ` · ${r.costNote}` : ''} · {r.pagesSeen.length} sources seen
              </span>
              {proposed > 0 && <Badge tone="warn">{proposed} finding(s) to review</Badge>}
            </div>
            {r.summary && <p className="summary">{r.summary}</p>}
          </>
        )}
      </Section>

      <PeopleSection company={company} save={save} />

      <Section
        title="Profile"
        actions={flagged.length > 0 ? <Badge tone="warn">{flagged.length} field(s) need a source or a fresh check</Badge> : <Badge tone="good">All filled fields are sourced</Badge>}
      >
        <p className="muted small">
          Every field carries a source and the date it was checked. Fields with no source are marked in the write-up, not stated as
          facts.
        </p>
        {PROFILE_GROUPS.map((group) => (
          <div key={group} className="profile-group">
            <h3>{group}</h3>
            {PROFILE_FIELDS.filter((f) => f.group === group).map((f) => {
              const v = company.profile[f.key] ?? { value: '' }
              const fr = FRESH_BADGE[fieldFreshness(v)]
              const finding = r?.fields[f.key]
              const isEditing = editing === f.key
              const empty = !v.value.trim()
              return (
                <div className={`profile-field${empty && !isEditing && finding?.status !== 'proposed' ? ' is-empty' : ''}`} key={f.key}>
                  <div className="row">
                    <span className="field-label grow">{f.label}</span>
                    {!empty && <Badge tone={fr.tone}>{fr.label}</Badge>}
                    <button className="link" onClick={() => setEditing(isEditing ? null : f.key)}>
                      {isEditing ? 'Done' : empty ? 'Add' : 'Edit'}
                    </button>
                  </div>
                  {finding?.status === 'proposed' && (
                    <Finding
                      finding={finding}
                      onAccept={() => save(acceptResearchedField(company, f.key))}
                      onDismiss={() => save(dismissResearchedField(company, f.key))}
                    />
                  )}
                  {isEditing ? (
                    <>
                      {f.multiline ? (
                        <TextArea value={v.value} onChange={(x) => setField(f.key, { value: x })} rows={3} />
                      ) : (
                        <TextField value={v.value} onChange={(x) => setField(f.key, { value: x })} />
                      )}
                      <div className="row small">
                        <div className="grow">
                          <TextField value={v.sourceUrl ?? ''} onChange={(x) => setField(f.key, { sourceUrl: x || undefined })} placeholder="Source URL" />
                        </div>
                        <TextField type="date" value={v.checkedAt ?? ''} onChange={(x) => setField(f.key, { checkedAt: x || undefined })} />
                        <button onClick={() => setField(f.key, { checkedAt: today() })}>Checked today</button>
                      </div>
                    </>
                  ) : (
                    !empty && (
                      <div className="field-read">
                        <div className="field-value">{v.value}</div>
                        {v.sourceUrl && (
                          <div className="sources small">
                            <a
                              href={v.sourceUrl}
                              onClick={(e) => {
                                e.preventDefault()
                                void bridge().openSource(v.sourceUrl!)
                              }}
                            >
                              {hostOf(v.sourceUrl)}
                            </a>
                            {v.checkedAt && <span className="muted">checked {v.checkedAt}</span>}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </Section>
    </>
  )
}

function Finding({ finding, onAccept, onDismiss }: { finding: ResearchedField; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="finding">
      <div className="row small">
        <Badge tone="info">Research finding</Badge>
        <Badge tone={finding.confidence === 'high' ? 'good' : finding.confidence === 'medium' ? 'neutral' : 'warn'}>{finding.confidence} confidence</Badge>
        {finding.asOf && <span className="muted">as of {finding.asOf}</span>}
        <span className="grow" />
        <button className="primary" onClick={onAccept}>
          Accept
        </button>
        <button onClick={onDismiss}>Dismiss</button>
      </div>
      <div className="finding-value">{finding.value}</div>
      <div className="sources small">
        {finding.sources.length === 0 && <span className="error">No source given</span>}
        {finding.sources.map((s) => (
          <span key={s} className="source">
            <a
              href={s}
              onClick={(e) => {
                e.preventDefault()
                void bridge().openSource(s)
              }}
            >
              {hostOf(s)}
            </a>
            {finding.unseenSources.includes(s) && <Badge tone="warn">not seen during research</Badge>}
          </span>
        ))}
      </div>
    </div>
  )
}

function PeopleSection({ company, save }: { company: Company; save: (c: Company) => void }) {
  const people = company.people ?? []
  const proposed = company.research?.people ?? []
  const differs = proposed.length > 0 && JSON.stringify(proposed.map((p) => p.name)) !== JSON.stringify(people.map((p) => p.name))
  const setPerson = (i: number, patch: Partial<Person>) => save({ ...company, people: people.map((p, j) => (j === i ? { ...p, ...patch } : p)) })

  return (
    <Section
      title="People"
      actions={
        <>
          {differs && <button className="primary" onClick={() => save(acceptPeople(company))}>Use the {proposed.length} people found by research</button>}
          <button onClick={() => save({ ...company, people: [...people, { name: '', role: '', background: '', notablePriorOrgs: [] }] })}>Add person</button>
        </>
      }
    >
      <p className="muted small">Founders, executives and notable hires. People from frontier AI labs or big tech are highlighted.</p>
      {people.length === 0 && !differs && <Empty>No people yet. Research fills this in.</Empty>}
      {people.length === 0 && differs && (
        <table className="table">
          <tbody>
            {proposed.map((p, i) => (
              <tr key={i}>
                <td>
                  <strong>{p.name}</strong>
                  <div className="muted small">{p.role}</div>
                </td>
                <td>{p.background}</td>
                <td>
                  {p.notablePriorOrgs.map((o) => (
                    <Badge key={o} tone={NOTABLE_ORGS.test(o) ? 'info' : 'neutral'}>
                      {o}
                    </Badge>
                  ))}
                  {p.unseenSource && <Badge tone="warn">source not seen</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {people.map((p, i) => (
        <div className="card tight" key={i}>
          <div className="grid3">
            <TextField label="Name" value={p.name} onChange={(v) => setPerson(i, { name: v })} />
            <TextField label="Role" value={p.role} onChange={(v) => setPerson(i, { role: v })} />
            <TextField
              label="Notable earlier employers"
              value={p.notablePriorOrgs.join(', ')}
              onChange={(v) => setPerson(i, { notablePriorOrgs: v.split(',').map((s) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div className="row">
            <div className="grow">
              <TextField value={p.background} onChange={(v) => setPerson(i, { background: v })} placeholder="Background" />
            </div>
            <div className="grow">
              <TextField value={p.sourceUrl ?? ''} onChange={(v) => setPerson(i, { sourceUrl: v || undefined })} placeholder="Source URL" />
            </div>
            {p.notablePriorOrgs.some((o) => NOTABLE_ORGS.test(o)) && <Badge tone="info">Notable background</Badge>}
            <button className="link danger" onClick={() => save({ ...company, people: people.filter((_, j) => j !== i) })}>
              Remove
            </button>
          </div>
        </div>
      ))}
    </Section>
  )
}

function hostOf(u: string): string {
  try {
    const url = new URL(u)
    return `${url.hostname.replace(/^www\./, '')}${url.pathname.length > 1 ? url.pathname.slice(0, 40) : ''}`
  } catch {
    return u
  }
}
