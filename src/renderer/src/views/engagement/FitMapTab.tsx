import { hypothesisPrompt, parseHypotheses } from '@shared/llm'
import type { Hypothesis } from '@shared/types'
import { newId, nowIso } from '@shared/util'
import { askLocalModel } from '../../api'
import { AsyncButton, Badge, Empty, Section, Select, TextField } from '../../components/ui'
import { useData, type EngagementCtx } from '../../data'

export function FitMapTab({ ctx }: { ctx: EngagementCtx }) {
  const { put, putMany, remove, pack, settings } = useData()
  const { engagement, company, hypotheses } = ctx
  const problemOptions = pack.problems.map((p) => ({ value: p.id, label: `${p.code}: ${p.title || 'untitled'}` }))

  const blank = (): Hypothesis => {
    const now = nowIso()
    return {
      id: newId('h'),
      engagementId: engagement.id,
      capability: '',
      problemId: pack.problems[0]?.id ?? '',
      outcome: '',
      metric: pack.problems[0]?.successMeasure ?? '',
      status: 'draft',
      verdict: 'untested',
      evidence: '',
      createdAt: now,
      updatedAt: now
    }
  }
  const set = (h: Hypothesis, patch: Partial<Hypothesis>) => put('hypotheses', { ...h, ...patch })

  return (
    <>
      <Section
        title="Augmentation hypotheses"
        actions={
          <>
            <AsyncButton
              disabled={settings.llmProvider === 'none' || pack.problems.length === 0}
              title={settings.llmProvider === 'none' ? 'Set up a local model in Settings' : 'Draft hypotheses with the local model'}
              onClick={async () => {
                const p = hypothesisPrompt(company, pack)
                const drafts = parseHypotheses(await askLocalModel(p.system, p.user), pack)
                if (!drafts.length) throw new Error('The model did not return any usable hypotheses.')
                putMany(
                  'hypotheses',
                  drafts.map((d) => ({ ...blank(), capability: d.capability, problemId: d.problemId, outcome: d.outcome, metric: d.metric }))
                )
              }}
            >
              Draft with local model
            </AsyncButton>
            <button disabled={pack.problems.length === 0} onClick={() => put('hypotheses', blank())}>
              Add hypothesis
            </button>
          </>
        }
      >
        <p className="muted small">
          Each link from a capability to one of our problem statements, in the form: if we used capability X for problem Y, we expect
          outcome Z, measured by metric M. Accepted hypotheses become must-ask questions.
        </p>
        {pack.problems.length === 0 && <Empty>Add problem statements to the Workplace Context Pack first.</Empty>}
        {pack.problems.length > 0 && hypotheses.length === 0 && <Empty>No hypotheses yet.</Empty>}
        {hypotheses.map((h) => (
          <div className={`card hyp hyp-${h.status}`} key={h.id}>
            <div className="sentence">
              <span>If we used</span>
              <input className="inline grow" value={h.capability} placeholder="capability" onChange={(e) => set(h, { capability: e.target.value })} />
              <span>for</span>
              <select value={h.problemId} onChange={(e) => set(h, { problemId: e.target.value })}>
                {problemOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span>, we expect</span>
              <input className="inline grow" value={h.outcome} placeholder="outcome" onChange={(e) => set(h, { outcome: e.target.value })} />
              <span>, measured by</span>
              <input className="inline grow" value={h.metric} placeholder="metric" onChange={(e) => set(h, { metric: e.target.value })} />
            </div>
            <div className="row">
              <Badge tone={h.status === 'accepted' ? 'good' : h.status === 'rejected' ? 'bad' : 'neutral'}>{h.status}</Badge>
              <button className={h.status === 'accepted' ? 'primary' : ''} onClick={() => set(h, { status: 'accepted' })}>
                Accept
              </button>
              <button onClick={() => set(h, { status: 'rejected' })}>Reject</button>
              <span className="grow" />
              <Select
                label="Verdict after the meeting"
                value={h.verdict}
                options={[
                  { value: 'untested', label: 'Untested' },
                  { value: 'supported', label: 'Supported' },
                  { value: 'weakened', label: 'Weakened' }
                ]}
                onChange={(v) => set(h, { verdict: v })}
              />
              <div className="grow">
                <TextField label="Evidence" value={h.evidence} onChange={(v) => set(h, { evidence: v })} />
              </div>
              <button className="link danger" onClick={() => remove('hypotheses', h.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </Section>
    </>
  )
}
