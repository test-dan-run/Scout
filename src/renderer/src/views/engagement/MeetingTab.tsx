import { coverage, sortQuestions } from '@shared/questionBank'
import { PRIORITY_LABEL } from '@shared/catalog'
import { normaliseScores } from '@shared/rubric'
import type { FollowUp, MeetingNotes, Question, QuestionState } from '@shared/types'
import { nowIso, today } from '@shared/util'
import { Badge, Empty, Progress, Section, TextArea, TextField } from '../../components/ui'
import { useData, type EngagementCtx } from '../../data'

const STATES: { value: QuestionState; label: string }[] = [
  { value: 'not_asked', label: 'Not asked' },
  { value: 'asked', label: 'Asked, no answer' },
  { value: 'partly', label: 'Partly answered' },
  { value: 'answered', label: 'Answered' }
]

export function MeetingTab({ ctx }: { ctx: EngagementCtx }) {
  const { put } = useData()
  const { engagement, questions, meeting, brief } = ctx

  if (!meeting) {
    return (
      <Section title="Meeting notes">
        <Empty>
          Phase 1 works from typed notes. Start the meeting to record notes and tick off questions. Your current rubric scores are
          saved as the pre-meeting baseline, so the write-up can show what changed.
          <div className="actions">
            <button
              className="primary"
              onClick={() => {
                put('meetings', {
                  id: engagement.id,
                  engagementId: engagement.id,
                  date: brief?.meetingDate || today(),
                  attendees: brief?.meetingWith ?? '',
                  notes: '',
                  redFlags: '',
                  followUps: [],
                  updatedAt: nowIso()
                })
                put('engagements', {
                  ...engagement,
                  stage: 'engage',
                  baselineScores: engagement.baselineScores ?? normaliseScores(engagement.scores)
                })
              }}
            >
              Start meeting notes
            </button>
          </div>
        </Empty>
      </Section>
    )
  }

  const set = (patch: Partial<MeetingNotes>) => put('meetings', { ...meeting, ...patch })
  const setQ = (q: Question, patch: Partial<Question>) => put('questions', { ...q, ...patch })
  const setFollow = (i: number, patch: Partial<FollowUp>) => set({ followUps: meeting.followUps.map((f, j) => (j === i ? { ...f, ...patch } : f)) })
  const cov = coverage(questions)

  return (
    <div className="meeting">
      <div className="meeting-main">
        <Section title="Notes">
          <div className="grid2">
            <TextField label="Date" type="date" value={meeting.date} onChange={(v) => set({ date: v })} />
            <TextField label="Attendees" value={meeting.attendees} onChange={(v) => set({ attendees: v })} />
          </div>
          <TextArea label="Meeting notes" value={meeting.notes} onChange={(v) => set({ notes: v })} rows={16} placeholder="Type as you go, or paste notes after the meeting." />
          <TextArea label="Red flags heard" value={meeting.redFlags} onChange={(v) => set({ redFlags: v })} rows={3} hint="One per line" />
        </Section>
        <Section title="Follow-ups owed" actions={<button onClick={() => set({ followUps: [...meeting.followUps, { owner: 'them', text: '' }] })}>Add follow-up</button>}>
          {meeting.followUps.length === 0 && <Empty>None yet.</Empty>}
          {meeting.followUps.map((f, i) => (
            <div className="row" key={i}>
              <select value={f.owner} onChange={(e) => setFollow(i, { owner: e.target.value as FollowUp['owner'] })}>
                <option value="them">They owe us</option>
                <option value="us">We owe them</option>
              </select>
              <div className="grow">
                <TextField value={f.text} onChange={(v) => setFollow(i, { text: v })} />
              </div>
              <button className="link danger" onClick={() => set({ followUps: meeting.followUps.filter((_, j) => j !== i) })}>
                Remove
              </button>
            </div>
          ))}
        </Section>
      </div>

      <div className="meeting-side">
        <Section title="Questions">
          <Progress done={cov.mustCovered} total={cov.mustTotal} label="Must-asks answered" />
          {questions.length === 0 && <Empty>No question bank for this engagement.</Empty>}
          {sortQuestions(questions).map((q) => (
            <div className={`card tight question state-${q.state}`} key={q.id}>
              <div className="row">
                <Badge tone={q.priority === 'must' ? 'bad' : q.priority === 'should' ? 'warn' : 'neutral'}>{PRIORITY_LABEL[q.priority]}</Badge>
                <span className="grow">{q.text}</span>
              </div>
              <div className="row small">
                <select value={q.state} onChange={(e) => setQ(q, { state: e.target.value as QuestionState })}>
                  {STATES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <label className="check">
                  <input type="checkbox" checked={q.flagged} onChange={(e) => setQ(q, { flagged: e.target.checked })} /> Red flag
                </label>
              </div>
              {q.state !== 'not_asked' && (
                <textarea rows={2} value={q.answer} placeholder="What they said" onChange={(e) => setQ(q, { answer: e.target.value })} />
              )}
              {q.state !== 'not_asked' && q.state !== 'answered' && q.followUps.filter(Boolean).length > 0 && (
                <div className="muted small">Follow up: {q.followUps.filter(Boolean).join(' · ')}</div>
              )}
              {q.flagged && q.redFlag && <div className="muted small">Red flag pattern: {q.redFlag}</div>}
            </div>
          ))}
        </Section>
        <div className="actions">
          <button className="primary" onClick={() => put('engagements', { ...engagement, stage: 'decide' })}>
            Meeting done: go to write-up
          </button>
        </div>
        <p className="muted small">Update rubric scores and hypothesis verdicts in their tabs before drafting the write-up.</p>
      </div>
    </div>
  )
}
