import { useState } from 'react'
import { PRIORITY_LABEL } from '@shared/catalog'
import { expertOpenPoints, generateQuestions, sortQuestions } from '@shared/questionBank'
import { RUBRIC, criterionName } from '@shared/rubric'
import type { CriterionKey, Priority, Question } from '@shared/types'
import { newId, nowIso } from '@shared/util'
import { Badge, Empty, Section, Select, TextArea } from '../../components/ui'
import { useData, type EngagementCtx } from '../../data'

const ORIGIN_LABEL: Record<Question['origin'], string> = {
  rubric: 'Rubric gap',
  hypothesis: 'Hypothesis',
  expert: 'Expert',
  standard: 'Standard',
  carried: 'Carried forward',
  manual: 'Added by hand'
}

const PRIORITY_OPTIONS = (['must', 'should', 'nice'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))
const CRITERION_OPTIONS = [{ value: '' as const, label: 'No criterion' }, ...RUBRIC.map((c) => ({ value: c.key, label: c.name }))]

export function QuestionsTab({ ctx }: { ctx: EngagementCtx }) {
  const { put, putMany, remove, pack, data } = useData()
  const { engagement, company, hypotheses, questions } = ctx
  const [msg, setMsg] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const sorted = sortQuestions(questions)

  const generate = () => {
    const added = generateQuestions({ engagement, company, pack, hypotheses, experts: data.experts, existing: questions })
    putMany('questions', added)
    setMsg(added.length ? `Added ${added.length} question(s).` : 'No new questions. Everything is already in the bank.')
  }

  const addManual = () => {
    const now = nowIso()
    const q: Question = {
      id: newId('q'),
      engagementId: engagement.id,
      text: '',
      priority: 'should',
      origin: 'manual',
      goodAnswer: '',
      redFlag: '',
      followUps: [],
      state: 'not_asked',
      answer: '',
      flagged: false,
      order: questions.reduce((m, x) => Math.max(m, x.order), 0) + 1,
      createdAt: now,
      updatedAt: now
    }
    put('questions', q)
    setOpenId(q.id)
  }

  const counts = { must: 0, should: 0, nice: 0 }
  for (const q of questions) counts[q.priority]++

  return (
    <Section
      title="Question bank"
      actions={
        <>
          <button className="primary" onClick={generate}>
            {questions.length ? 'Add new questions from sources' : 'Build question bank'}
          </button>
          <button onClick={addManual}>Add question</button>
          <button
            disabled={!questions.length}
            onClick={() => void navigator.clipboard.writeText(expertOpenPoints(company.name, questions)).then(() => setMsg('Open points copied. Paste them into an email to your expert.'))}
          >
            Copy open points for an expert
          </button>
        </>
      }
    >
      <p className="muted small">
        Built from low-confidence rubric criteria, accepted hypotheses, confirmed expert concerns and the standard AI Platforms set.
        Rebuilding only adds questions that are not already here, so your edits are kept.
      </p>
      {msg && <p className="note">{msg}</p>}
      {questions.length > 0 && (
        <p className="small">
          <Badge tone="bad">{counts.must} must-ask</Badge> <Badge tone="warn">{counts.should} should-ask</Badge> <Badge>{counts.nice} nice-to-have</Badge>
        </p>
      )}
      {questions.length === 0 && <Empty>No questions yet. Fill in the profile, scores and fit map, then build the bank.</Empty>}
      {sorted.map((q) => {
        const open = openId === q.id
        const set = (patch: Partial<Question>) => put('questions', { ...q, ...patch })
        return (
          <div className={`card question prio-${q.priority}`} key={q.id}>
            <div className="row clickable" onClick={() => setOpenId(open ? null : q.id)}>
              <Badge tone={q.priority === 'must' ? 'bad' : q.priority === 'should' ? 'warn' : 'neutral'}>{PRIORITY_LABEL[q.priority]}</Badge>
              <span className="grow">{q.text || <em className="muted">New question</em>}</span>
              {q.criterion && <Badge tone="info">{criterionName(q.criterion)}</Badge>}
              <Badge>{ORIGIN_LABEL[q.origin]}</Badge>
              <span className="muted">{open ? '▾' : '▸'}</span>
            </div>
            {open && (
              <div className="question-detail">
                <TextArea label="Question" value={q.text} onChange={(v) => set({ text: v })} rows={2} />
                <div className="grid3">
                  <Select label="Priority" value={q.priority} options={PRIORITY_OPTIONS} onChange={(v) => set({ priority: v })} />
                  <Select<CriterionKey | ''> label="Rubric link" value={q.criterion ?? ''} options={CRITERION_OPTIONS} onChange={(v) => set({ criterion: v || undefined })} />
                  <Select
                    label="Hypothesis link"
                    value={q.hypothesisId ?? ''}
                    options={[{ value: '', label: 'None' }, ...hypotheses.filter((h) => h.status !== 'rejected').map((h) => ({ value: h.id, label: h.capability || 'untitled' }))]}
                    onChange={(v) => set({ hypothesisId: v || undefined })}
                  />
                </div>
                <div className="grid2">
                  <TextArea label="Good answer looks like" value={q.goodAnswer} onChange={(v) => set({ goodAnswer: v })} rows={2} />
                  <TextArea label="Red flag looks like" value={q.redFlag} onChange={(v) => set({ redFlag: v })} rows={2} />
                </div>
                <TextArea
                  label="Follow-ups (one per line)"
                  value={q.followUps.join('\n')}
                  onChange={(v) => set({ followUps: v.split('\n') })}
                  rows={3}
                />
                <div className="row">
                  <span className="grow" />
                  <button className="link danger" onClick={() => remove('questions', q.id)}>
                    Delete question
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {questions.length > 0 && <p className="muted small">Click a question to edit it.</p>}
    </Section>
  )
}
