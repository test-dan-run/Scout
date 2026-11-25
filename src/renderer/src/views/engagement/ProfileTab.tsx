import { PROFILE_FIELDS, SEGMENTS } from '@shared/catalog'
import { CRITERION_BY_KEY, normaliseScores, weightedScore } from '@shared/rubric'
import type { Company, Confidence, CriterionScore, HardCheck, ProfileFieldKey, Sourced } from '@shared/types'
import { fieldFreshness, today, type Freshness } from '@shared/util'
import { Badge, Empty, Section, Select, TextArea, TextField } from '../../components/ui'
import { useData, type EngagementCtx } from '../../data'

const FRESH_BADGE: Record<Freshness, { tone: 'good' | 'warn' | 'bad' | 'neutral'; label: string }> = {
  fresh: { tone: 'good', label: 'Checked' },
  stale: { tone: 'warn', label: 'Older than 30 days' },
  unverified: { tone: 'bad', label: 'No source' },
  empty: { tone: 'neutral', label: 'Empty' }
}

export function ProfileTab({ ctx }: { ctx: EngagementCtx }) {
  const { put, pack } = useData()
  const { company, engagement } = ctx
  const setCompany = (patch: Partial<Company>) => put('companies', { ...company, ...patch })
  const setField = (key: ProfileFieldKey, patch: Partial<Sourced>) => {
    const prev = company.profile[key] ?? { value: '' }
    setCompany({ profile: { ...company.profile, [key]: { ...prev, ...patch } } })
  }
  const scores = normaliseScores(engagement.scores)
  const setScore = (i: number, patch: Partial<CriterionScore>) => {
    const next = scores.map((s, j) => (j === i ? { ...s, ...patch } : s))
    put('engagements', { ...engagement, scores: next })
  }
  const ws = weightedScore(scores)
  const hard = pack.constraints.filter((c) => c.hard)
  const flagged = PROFILE_FIELDS.filter((f) => ['stale', 'unverified'].includes(fieldFreshness(company.profile[f.key])))

  return (
    <>
      <Section title="Company">
        <div className="grid3">
          <TextField label="Name" value={company.name} onChange={(v) => setCompany({ name: v })} />
          <Select label="Segment" value={company.segment} options={SEGMENTS.map((s) => ({ value: s, label: s }))} onChange={(v) => setCompany({ segment: v })} />
          <TextField label="Website" value={company.website ?? ''} onChange={(v) => setCompany({ website: v })} />
        </div>
        <TextField label="Engagement owner" value={engagement.owner} onChange={(v) => put('engagements', { ...engagement, owner: v })} />
      </Section>

      <Section
        title="Profile"
        actions={flagged.length > 0 ? <Badge tone="warn">{flagged.length} field(s) need a source or a fresh check</Badge> : <Badge tone="good">All filled fields are sourced</Badge>}
      >
        <p className="muted small">
          Every field carries a source and the date it was checked. Fields with no source are shown as questions in the write-up,
          not as facts.
        </p>
        {PROFILE_FIELDS.map((f) => {
          const v = company.profile[f.key] ?? { value: '' }
          const fr = FRESH_BADGE[fieldFreshness(v)]
          return (
            <div className="profile-field" key={f.key}>
              <div className="row">
                <span className="field-label grow">{f.label}</span>
                <Badge tone={fr.tone}>{fr.label}</Badge>
              </div>
              {f.multiline ? (
                <TextArea value={v.value} onChange={(x) => setField(f.key, { value: x })} rows={2} />
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
            </div>
          )
        })}
      </Section>

      <Section title="Rubric scores" actions={<Badge tone="info">{ws.score != null ? `Weighted ${ws.score.toFixed(2)} / 5 over ${Math.round(ws.coverage * 100)}% of weight` : 'Not scored'}</Badge>}>
        <p className="muted small">
          Weights are fixed for the first release. Any criterion that is unscored or low confidence becomes a question in the
          question bank.
        </p>
        <table className="table scores">
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Weight</th>
              <th>Score</th>
              <th>Confidence</th>
              <th>Evidence</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => {
              const def = CRITERION_BY_KEY[s.criterion]
              return (
                <tr key={s.criterion}>
                  <td>
                    <strong>{def.name}</strong>
                    <div className="muted small">{def.lookFor}</div>
                  </td>
                  <td>{Math.round(def.weight * 100)}%</td>
                  <td>
                    <select value={s.score ?? ''} onChange={(e) => setScore(i, { score: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">–</option>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={s.confidence} onChange={(e) => setScore(i, { confidence: e.target.value as Confidence })}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </td>
                  <td>
                    <textarea rows={2} value={s.evidence} onChange={(e) => setScore(i, { evidence: e.target.value })} />
                  </td>
                  <td>
                    <input value={s.sourceUrl ?? ''} placeholder="URL" onChange={(e) => setScore(i, { sourceUrl: e.target.value || undefined })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Section>

      <Section title="Hard requirements">
        {hard.length === 0 && <Empty>No hard requirements in the Context Pack. Mark a constraint as a hard requirement there.</Empty>}
        {hard.map((c) => {
          const chk = engagement.hardChecks[c.id] ?? { result: 'unknown' as HardCheck, note: '' }
          const set = (patch: Partial<typeof chk>) => put('engagements', { ...engagement, hardChecks: { ...engagement.hardChecks, [c.id]: { ...chk, ...patch } } })
          return (
            <div className="row card tight" key={c.id}>
              <span className="grow">{c.text}</span>
              <Select<HardCheck>
                value={chk.result}
                options={[
                  { value: 'unknown', label: 'Not confirmed' },
                  { value: 'pass', label: 'Pass' },
                  { value: 'fail', label: 'Fail' }
                ]}
                onChange={(v) => set({ result: v })}
              />
              <div className="grow">
                <TextField value={chk.note} onChange={(v) => set({ note: v })} placeholder="Evidence or note" />
              </div>
            </div>
          )
        })}
      </Section>
    </>
  )
}
