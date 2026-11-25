import { useState } from 'react'
import { PROFILE_FIELDS, SEGMENTS } from '@shared/catalog'
import { coverage } from '@shared/questionBank'
import { RECOMMENDATION_LABEL } from '@shared/recommend'
import { emptyScores, normaliseScores, weightedScore } from '@shared/rubric'
import type { Company, Engagement } from '@shared/types'
import { fieldFreshness, newId, nowIso } from '@shared/util'
import { Badge, Empty, Section, Select, TextField } from '../components/ui'
import { useData } from '../data'

export function CompaniesView({ open }: { open: (engagementId: string) => void }) {
  const { data, put } = useData()
  const [name, setName] = useState('')
  const [segment, setSegment] = useState(SEGMENTS[0])
  const [website, setWebsite] = useState('')

  const add = () => {
    const now = nowIso()
    const company: Company = { id: newId('co'), name: name.trim(), segment, website: website.trim() || undefined, profile: {}, createdAt: now, updatedAt: now }
    const engagement: Engagement = {
      id: newId('eng'),
      companyId: company.id,
      round: 1,
      stage: 'prepare',
      status: 'active',
      owner: '',
      scores: emptyScores(),
      hardChecks: {},
      createdAt: now,
      updatedAt: now
    }
    put('companies', company)
    put('engagements', engagement)
    setName('')
    setWebsite('')
    open(engagement.id)
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Companies</h1>
        <p className="muted">
          Phase 1 uses manual company entry. Add a company, fill in its profile with a source for each field, then prepare for the
          meeting.
        </p>
      </header>

      <Section title="Add a company">
        <div className="row">
          <div className="grow">
            <TextField label="Name" value={name} onChange={setName} />
          </div>
          <Select label="Segment" value={segment} options={SEGMENTS.map((s) => ({ value: s, label: s }))} onChange={setSegment} />
          <div className="grow">
            <TextField label="Website" value={website} onChange={setWebsite} placeholder="https://" />
          </div>
          <button className="primary align-end" disabled={!name.trim()} onClick={add}>
            Add
          </button>
        </div>
      </Section>

      {data.companies.length === 0 && <Empty>No companies yet.</Empty>}
      {data.companies.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Segment</th>
              <th>Profile</th>
              <th>Score</th>
              <th>Must-asks</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...data.companies]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => {
                const engs = data.engagements.filter((e) => e.companyId === c.id).sort((a, b) => b.round - a.round)
                const latest = engs[0]
                const fresh = PROFILE_FIELDS.map((f) => fieldFreshness(c.profile[f.key]))
                const filled = fresh.filter((f) => f !== 'empty').length
                const flagged = fresh.filter((f) => f === 'stale' || f === 'unverified').length
                const ws = latest ? weightedScore(normaliseScores(latest.scores)) : null
                const cov = latest ? coverage(data.questions.filter((q) => q.engagementId === latest.id)) : null
                return (
                  <tr key={c.id} className="clickable" onClick={() => latest && open(latest.id)}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td className="muted">{c.segment}</td>
                    <td>
                      {filled}/{PROFILE_FIELDS.length} {flagged > 0 && <Badge tone="warn">{flagged} to verify</Badge>}
                    </td>
                    <td>{ws?.score != null ? ws.score.toFixed(2) : '–'}</td>
                    <td>{cov && cov.mustTotal ? `${cov.mustCovered}/${cov.mustTotal}` : '–'}</td>
                    <td>
                      {latest && latest.status !== 'active' ? (
                        <Badge tone={latest.status === 'proceed' ? 'good' : latest.status === 'hold' ? 'warn' : 'bad'}>{RECOMMENDATION_LABEL[latest.status]}</Badge>
                      ) : (
                        <Badge>{latest ? `${latest.stage}${latest.round > 1 ? `, round ${latest.round}` : ''}` : 'none'}</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      )}
    </div>
  )
}
