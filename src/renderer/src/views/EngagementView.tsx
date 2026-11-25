import { useState } from 'react'
import { coverage } from '@shared/questionBank'
import { RECOMMENDATION_LABEL } from '@shared/recommend'
import { normaliseScores, weightedScore } from '@shared/rubric'
import { Badge, Progress } from '../components/ui'
import { useData, useEngagement, type EngagementCtx } from '../data'
import { BriefTab } from './engagement/BriefTab'
import { FitMapTab } from './engagement/FitMapTab'
import { MeetingTab } from './engagement/MeetingTab'
import { ProfileTab } from './engagement/ProfileTab'
import { QuestionsTab } from './engagement/QuestionsTab'
import { WriteupTab } from './engagement/WriteupTab'

const TABS = [
  { key: 'profile', label: 'Profile and scores' },
  { key: 'fit', label: 'Fit map' },
  { key: 'questions', label: 'Question bank' },
  { key: 'brief', label: 'Brief and speaker notes' },
  { key: 'meeting', label: 'Meeting notes' },
  { key: 'writeup', label: 'Write-up' }
] as const

export type TabKey = (typeof TABS)[number]['key']

export function EngagementView({ id, open, back }: { id: string; open: (id: string) => void; back: () => void }) {
  const ctx = useEngagement(id)
  const { data, removeEngagement, remove } = useData()
  const [tab, setTab] = useState<TabKey>('profile')
  const { engagement, company } = ctx

  if (!engagement || !company) {
    return (
      <div className="page">
        <p>This engagement no longer exists.</p>
        <button onClick={back}>Back to companies</button>
      </div>
    )
  }

  const full = ctx as EngagementCtx
  const ws = weightedScore(normaliseScores(engagement.scores))
  const cov = coverage(ctx.questions)
  const rounds = data.engagements.filter((e) => e.companyId === company.id).sort((a, b) => a.round - b.round)

  return (
    <div className="page">
      <header className="page-head">
        <div className="row">
          <h1 className="grow">
            {company.name}
            {engagement.round > 1 && <span className="muted"> · round {engagement.round}</span>}
          </h1>
          {engagement.status !== 'active' && (
            <Badge tone={engagement.status === 'proceed' ? 'good' : engagement.status === 'hold' ? 'warn' : 'bad'}>{RECOMMENDATION_LABEL[engagement.status]}</Badge>
          )}
          <Badge>{company.segment}</Badge>
          <Badge tone="info">Score {ws.score != null ? ws.score.toFixed(2) : '–'}</Badge>
          {rounds.length > 1 && (
            <select value={engagement.id} onChange={(e) => open(e.target.value)}>
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  Round {r.round}
                </option>
              ))}
            </select>
          )}
          <button
            className="link danger"
            onClick={() => {
              if (!window.confirm(`Delete this engagement with ${company.name}? This cannot be undone.`)) return
              removeEngagement(engagement.id)
              if (rounds.length === 1) remove('companies', company.id)
              back()
            }}
          >
            Delete
          </button>
        </div>
        {cov.mustTotal > 0 && <Progress done={cov.mustCovered} total={cov.mustTotal} label="Must-asks answered" />}
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'profile' && <ProfileTab ctx={full} />}
      {tab === 'fit' && <FitMapTab ctx={full} />}
      {tab === 'questions' && <QuestionsTab ctx={full} />}
      {tab === 'brief' && <BriefTab ctx={full} />}
      {tab === 'meeting' && <MeetingTab ctx={full} />}
      {tab === 'writeup' && <WriteupTab ctx={full} openRound={open} />}
    </div>
  )
}
