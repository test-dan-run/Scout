import { useState } from 'react'
import { briefToMarkdown, CONSENT_REMINDER, draftBrief } from '@shared/brief'
import { briefPolishPrompt } from '@shared/llm'
import type { AgendaBlock, Brief } from '@shared/types'
import { parseJsonLoose } from '@shared/util'
import { askLocalModel } from '../../api'
import { AsyncButton, Empty, ExportButtons, Markdown, Section, TextArea, TextField, slug } from '../../components/ui'
import { useData, type EngagementCtx } from '../../data'

export function BriefTab({ ctx }: { ctx: EngagementCtx }) {
  const { put, pack, settings } = useData()
  const { engagement, company, hypotheses, questions, brief } = ctx
  const [preview, setPreview] = useState(false)

  const draft = () => put('briefs', draftBrief({ engagementId: engagement.id, company, pack, hypotheses, questions, existing: brief }))

  if (!brief) {
    return (
      <Section title="Brief and speaker notes">
        <Empty>
          The brief is drafted from the fit map and the question bank. Build the question bank first for the best result.
          <div className="actions">
            <button className="primary" onClick={draft}>
              Draft brief
            </button>
          </div>
        </Empty>
      </Section>
    )
  }

  const set = (patch: Partial<Brief>) => put('briefs', { ...brief, ...patch })
  const setBlock = (i: number, patch: Partial<AgendaBlock>) => set({ agenda: brief.agenda.map((b, j) => (j === i ? { ...b, ...patch } : b)) })
  const md = briefToMarkdown(brief, company.name)

  return (
    <>
      <Section
        title="1-page brief"
        actions={
          <>
            <button onClick={() => window.confirm('Redraft the brief from the latest fit map and questions? Your edits to these fields will be replaced.') && draft()}>
              Redraft
            </button>
            <AsyncButton
              disabled={settings.llmProvider === 'none'}
              title={settings.llmProvider === 'none' ? 'Set up a local model in Settings' : 'Tighten the wording with the local model'}
              onClick={async () => {
                const p = briefPolishPrompt(company, pack, hypotheses, brief)
                const r = parseJsonLoose<{ whyItMatters?: string; opening?: string }>(await askLocalModel(p.system, p.user))
                if (!r?.whyItMatters && !r?.opening) throw new Error('The model reply was not usable.')
                set({ whyItMatters: r.whyItMatters || brief.whyItMatters, opening: r.opening || brief.opening })
              }}
            >
              Tighten with local model
            </AsyncButton>
            <button onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</button>
            <ExportButtons markdown={md} title={`Brief: ${company.name}`} name={`brief-${slug(company.name)}`} />
          </>
        }
      >
        {preview ? (
          <div className="paper">
            <Markdown source={md} />
          </div>
        ) : (
          <>
            <div className="grid2">
              <TextField label="Who we are meeting" value={brief.meetingWith} onChange={(v) => set({ meetingWith: v })} placeholder="Names and roles" />
              <TextField label="Meeting date" type="date" value={brief.meetingDate} onChange={(v) => set({ meetingDate: v })} />
            </div>
            <TextArea label="Why it matters to us" value={brief.whyItMatters} onChange={(v) => set({ whyItMatters: v })} rows={3} />
            <div className="field">
              <span className="field-label">Three things we must learn</span>
              {brief.mustLearn.map((m, i) => (
                <input key={i} value={m} onChange={(e) => set({ mustLearn: brief.mustLearn.map((x, j) => (j === i ? e.target.value : x)) })} />
              ))}
            </div>
            <TextArea label="Our opening" value={brief.opening} onChange={(v) => set({ opening: v })} rows={3} />
          </>
        )}
      </Section>

      {!preview && (
        <>
          <Section
            title="Speaker notes"
            actions={<button onClick={() => set({ agenda: [...brief.agenda, { title: 'New block', minutes: 5, points: [] }] })}>Add block</button>}
          >
            <p className="muted small">{CONSENT_REMINDER}</p>
            {brief.agenda.map((b, i) => (
              <div className="card" key={i}>
                <div className="row">
                  <div className="grow">
                    <TextField value={b.title} onChange={(v) => setBlock(i, { title: v })} />
                  </div>
                  <input className="minutes" type="number" min={1} value={b.minutes} onChange={(e) => setBlock(i, { minutes: Number(e.target.value) || 0 })} />
                  <span className="muted small">min</span>
                  <button className="link danger" onClick={() => set({ agenda: brief.agenda.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                </div>
                <TextArea value={b.points.join('\n')} onChange={(v) => setBlock(i, { points: v.split('\n') })} rows={Math.max(2, b.points.length)} hint="One talking point per line" />
              </div>
            ))}
            <p className="muted small">Total: {brief.agenda.reduce((n, b) => n + b.minutes, 0)} minutes</p>
          </Section>
          <Section title="What we can and cannot share">
            <div className="grid2">
              <TextArea label="We can share" value={brief.canShare} onChange={(v) => set({ canShare: v })} rows={4} />
              <TextArea label="We cannot share" value={brief.cannotShare} onChange={(v) => set({ cannotShare: v })} rows={4} />
            </div>
          </Section>
        </>
      )}
    </>
  )
}
