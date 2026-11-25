import { useState } from 'react'
import { carryForward } from '@shared/questionBank'
import { RECOMMENDATION_LABEL, suggestRecommendation } from '@shared/recommend'
import type { Engagement, Recommendation, Writeup } from '@shared/types'
import { newId, nowIso, today } from '@shared/util'
import { countUnsourced, draftWriteup, NO_SOURCE, writeupToMarkdown } from '@shared/writeup'
import { Badge, Empty, ExportButtons, Markdown, Section, Select, TextArea, TextField, slug } from '../../components/ui'
import { useData, type EngagementCtx } from '../../data'

const REC_OPTIONS = (['proceed', 'hold', 'do_not_proceed'] as Recommendation[]).map((r) => ({ value: r, label: RECOMMENDATION_LABEL[r] }))
const REC_TONE: Record<Recommendation, 'good' | 'warn' | 'bad'> = { proceed: 'good', hold: 'warn', do_not_proceed: 'bad' }

export function WriteupTab({ ctx, openRound }: { ctx: EngagementCtx; openRound: (id: string) => void }) {
  const { put, putMany, pack, settings, data } = useData()
  const { engagement, company, questions, hypotheses, experts, meeting, writeup } = ctx
  const [editKey, setEditKey] = useState<string | null>(null)
  const [signer, setSigner] = useState(settings.userName)
  const suggestion = suggestRecommendation(engagement, pack.constraints, questions)

  const draft = (existing?: Writeup) =>
    put('writeups', draftWriteup({ engagement, company, pack, hypotheses, questions, experts, meeting, suggestion }, existing))

  const nextRound = data.engagements.find((e) => e.previousEngagementId === engagement.id)

  const header = (
    <Section title="Suggested recommendation">
      <div className="row">
        <Badge tone={REC_TONE[suggestion.recommendation]}>{RECOMMENDATION_LABEL[suggestion.recommendation]}</Badge>
        <span className="muted small grow">
          Score of 3.5 or more with every hard requirement passed and every must-ask answered suggests Proceed. A failed hard
          requirement means Do not proceed, whatever the score. You make the final call.
        </span>
      </div>
      <ul>
        {suggestion.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </Section>
  )

  if (!writeup) {
    return (
      <>
        {header}
        <Section title="Write-up">
          <Empty>
            {meeting ? 'Draft the write-up from the profile, scores, fit map, question bank and meeting notes.' : 'No meeting notes yet. You can still draft a write-up, but it will have no meeting evidence.'}
            <div className="actions">
              <button className="primary" onClick={() => draft()}>
                Draft write-up
              </button>
            </div>
          </Empty>
        </Section>
      </>
    )
  }

  const set = (patch: Partial<Writeup>) => put('writeups', { ...writeup, ...patch })
  const signed = !!writeup.signedOffAt
  const overridden = writeup.recommendation !== writeup.suggested
  const unsourced = countUnsourced(writeup)
  const md = writeupToMarkdown(writeup, company.name, engagement.round)
  const canSign = !signed && (!overridden || writeup.overrideReason.trim().length > 0) && signer.trim().length > 0

  const signOff = () => {
    const at = nowIso()
    set({ signedOffAt: at, signedOffBy: signer.trim() })
    put('engagements', { ...engagement, stage: 'closed', status: writeup.recommendation })
    const reasons = writeup.sections.find((s) => s.key === 'recommendation')?.body ?? ''
    const summary = reasons
      .split('\n')
      .filter((l) => /^\d+\./.test(l))
      .map((l) => l.replace(/^\d+\.\s*/, ''))
      .join(' ')
    put('contextPack', {
      ...pack,
      pastEngagements: [
        ...pack.pastEngagements.filter((p) => p.engagementId !== engagement.id),
        { engagementId: engagement.id, companyName: company.name, round: engagement.round, date: today(), recommendation: writeup.recommendation, summary: summary.slice(0, 400) }
      ]
    })
    if (settings.userName !== signer.trim()) put('settings', { ...settings, userName: signer.trim() })
  }

  const openNewRound = () => {
    const now = nowIso()
    const next: Engagement = {
      id: newId('eng'),
      companyId: company.id,
      round: engagement.round + 1,
      previousEngagementId: engagement.id,
      stage: 'prepare',
      status: 'active',
      owner: engagement.owner,
      scores: engagement.scores.map((s) => ({ ...s })),
      hardChecks: { ...engagement.hardChecks },
      createdAt: now,
      updatedAt: now
    }
    put('engagements', next)
    putMany('questions', carryForward(questions, next.id))
    putMany(
      'hypotheses',
      hypotheses
        .filter((h) => h.status === 'accepted' && h.verdict !== 'supported')
        .map((h) => ({ ...h, id: newId('h'), engagementId: next.id, verdict: 'untested' as const, evidence: '', createdAt: now, updatedAt: now }))
    )
    openRound(next.id)
  }

  return (
    <>
      {header}
      <Section
        title="Write-up"
        actions={
          <>
            {!signed && (
              <button onClick={() => window.confirm('Redraft every section from the latest data? Your edits to the sections will be replaced.') && draft(writeup)}>
                Redraft
              </button>
            )}
            <ExportButtons markdown={md} title={`Write-up: ${company.name}`} name={`writeup-${slug(company.name)}${engagement.round > 1 ? `-r${engagement.round}` : ''}`} />
          </>
        }
      >
        <div className="row">
          <Select label="Recommendation" value={writeup.recommendation} options={REC_OPTIONS} onChange={(v) => !signed && set({ recommendation: v })} />
          {overridden && (
            <div className="grow">
              <TextField label={`Why you differ from the suggested ${RECOMMENDATION_LABEL[writeup.suggested]}`} value={writeup.overrideReason} onChange={(v) => !signed && set({ overrideReason: v })} />
            </div>
          )}
        </div>
        {unsourced > 0 && (
          <p className="note warn">
            {unsourced} claim(s) are marked {NO_SOURCE}. Add a source in the profile or scores and redraft, or edit the section.
          </p>
        )}
        {overridden && !signed && (
          <p className="muted small">Redraft after changing the recommendation so the reasons and next steps match it.</p>
        )}

        {writeup.sections.map((s) => (
          <div className="card writeup-section" key={s.key}>
            <div className="row">
              <h3 className="grow">{s.title}</h3>
              {!signed && (
                <button className="link" onClick={() => setEditKey(editKey === s.key ? null : s.key)}>
                  {editKey === s.key ? 'Done' : 'Edit'}
                </button>
              )}
            </div>
            {editKey === s.key ? (
              <TextArea value={s.body} onChange={(v) => set({ sections: writeup.sections.map((x) => (x.key === s.key ? { ...x, body: v } : x)) })} rows={Math.max(4, s.body.split('\n').length + 1)} />
            ) : (
              <Markdown source={s.body} />
            )}
          </div>
        ))}
      </Section>

      <Section title="Sign-off">
        {signed ? (
          <div className="row">
            <Badge tone="good">
              Signed off by {writeup.signedOffBy} on {writeup.signedOffAt!.slice(0, 10)}
            </Badge>
            <span className="grow" />
            {writeup.recommendation === 'hold' &&
              (nextRound ? (
                <button onClick={() => openRound(nextRound.id)}>Go to round {nextRound.round}</button>
              ) : (
                <button className="primary" onClick={openNewRound}>
                  Open round {engagement.round + 1}
                </button>
              ))}
            <button
              className="link"
              onClick={() => {
                set({ signedOffAt: undefined, signedOffBy: undefined })
                put('engagements', { ...engagement, stage: 'decide', status: 'active' })
              }}
            >
              Reopen for edits
            </button>
          </div>
        ) : (
          <div className="row">
            <div className="grow">
              <TextField label="Your name" value={signer} onChange={setSigner} />
            </div>
            <button className="primary align-end" disabled={!canSign} onClick={signOff}>
              Sign off as {RECOMMENDATION_LABEL[writeup.recommendation]}
            </button>
          </div>
        )}
        <p className="muted small">
          Scout never sends the write-up anywhere. Signing off records the outcome in the Context Pack. A Hold opens a new round
          with open must-asks carried forward.
        </p>
      </Section>
    </>
  )
}
