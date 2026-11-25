import { RUBRIC } from '@shared/rubric'
import { RECOMMENDATION_LABEL } from '@shared/recommend'
import type { Constraint, ContextPack, CriterionKey, ProblemStatement } from '@shared/types'
import { newId } from '@shared/util'
import { Badge, Empty, Section, Select, TextArea, TextField } from '../components/ui'
import { useData } from '../data'

const CRITERION_OPTIONS = [{ value: '' as const, label: 'No criterion' }, ...RUBRIC.map((c) => ({ value: c.key, label: c.name }))]

export function ContextPackView() {
  const { pack, put } = useData()
  const set = (patch: Partial<ContextPack>) => put('contextPack', { ...pack, ...patch })

  const setProblem = (id: string, patch: Partial<ProblemStatement>) =>
    set({ problems: pack.problems.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const setConstraint = (id: string, patch: Partial<Constraint>) =>
    set({ constraints: pack.constraints.map((c) => (c.id === id ? { ...c, ...patch } : c)) })

  const nextCode = () => {
    const nums = pack.problems.map((p) => Number(p.code.replace(/\D/g, '')) || 0)
    return `P${Math.max(0, ...nums) + 1}`
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Workplace Context Pack</h1>
        <p className="muted">
          Written once and reused for every company. Stage 2 uses it to map companies to our needs, so the more specific it
          is, the better the fit map and questions.
        </p>
      </header>

      <Section title="Team">
        <div className="grid2">
          <TextField label="Team name" value={pack.teamName} onChange={(v) => set({ teamName: v })} placeholder="e.g. Enterprise AI Platforms" />
          <TextArea label="Mission" value={pack.mission} onChange={(v) => set({ mission: v })} rows={2} placeholder="What our team is for, in one or two sentences" />
        </div>
        <TextArea label="Current priorities" value={pack.priorities} onChange={(v) => set({ priorities: v })} rows={3} placeholder="One per line" />
      </Section>

      <Section title="Current AI stack">
        <div className="grid2">
          <TextArea label="Models, platforms and tools in use" value={pack.aiStack} onChange={(v) => set({ aiStack: v })} rows={4} />
          <TextArea label="Known pain points" value={pack.painPoints} onChange={(v) => set({ painPoints: v })} rows={4} />
        </div>
      </Section>

      <Section
        title="Problem statements"
        actions={
          <button
            onClick={() =>
              set({ problems: [...pack.problems, { id: newId('p'), code: nextCode(), title: '', description: '', owner: '', successMeasure: '' }] })
            }
          >
            Add problem
          </button>
        }
      >
        {pack.problems.length === 0 && <Empty>No problem statements yet. Each hypothesis in the fit map links to one of these.</Empty>}
        {pack.problems.map((p) => (
          <div className="card" key={p.id}>
            <div className="row">
              <Badge tone="info">{p.code}</Badge>
              <div className="grow">
                <TextField value={p.title} onChange={(v) => setProblem(p.id, { title: v })} placeholder="Short title" />
              </div>
              <button className="link danger" onClick={() => set({ problems: pack.problems.filter((x) => x.id !== p.id) })}>
                Remove
              </button>
            </div>
            <TextArea label="Description" value={p.description} onChange={(v) => setProblem(p.id, { description: v })} rows={2} />
            <div className="grid2">
              <TextField label="Owner" value={p.owner} onChange={(v) => setProblem(p.id, { owner: v })} />
              <TextField label="Success measure" value={p.successMeasure} onChange={(v) => setProblem(p.id, { successMeasure: v })} />
            </div>
          </div>
        ))}
      </Section>

      <Section
        title="Constraints"
        actions={<button onClick={() => set({ constraints: [...pack.constraints, { id: newId('c'), text: '', hard: false }] })}>Add constraint</button>}
      >
        <p className="muted small">
          Data classification, hosting rules, procurement rules and security policies. Mark a constraint as a hard requirement if
          failing it rules a company out, whatever its score.
        </p>
        {pack.constraints.length === 0 && <Empty>No constraints yet.</Empty>}
        {pack.constraints.map((c) => (
          <div className="row card tight" key={c.id}>
            <div className="grow">
              <TextField value={c.text} onChange={(v) => setConstraint(c.id, { text: v })} placeholder="e.g. Restricted data must stay in Singapore" />
            </div>
            <Select<CriterionKey | ''>
              value={c.criterion ?? ''}
              options={CRITERION_OPTIONS}
              onChange={(v) => setConstraint(c.id, { criterion: v || undefined })}
            />
            <label className="check">
              <input type="checkbox" checked={c.hard} onChange={(e) => setConstraint(c.id, { hard: e.target.checked })} /> Hard requirement
            </label>
            <button className="link danger" onClick={() => set({ constraints: pack.constraints.filter((x) => x.id !== c.id) })}>
              Remove
            </button>
          </div>
        ))}
      </Section>

      <Section title="Past engagements">
        <p className="muted small">Added automatically when a write-up is signed off.</p>
        {pack.pastEngagements.length === 0 && <Empty>None yet.</Empty>}
        {pack.pastEngagements.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Round</th>
                <th>Outcome</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {[...pack.pastEngagements].reverse().map((p) => (
                <tr key={`${p.engagementId}-${p.date}`}>
                  <td>{p.date}</td>
                  <td>{p.companyName}</td>
                  <td>{p.round}</td>
                  <td>
                    <Badge tone={p.recommendation === 'proceed' ? 'good' : p.recommendation === 'hold' ? 'warn' : 'bad'}>
                      {RECOMMENDATION_LABEL[p.recommendation]}
                    </Badge>
                  </td>
                  <td>{p.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}
