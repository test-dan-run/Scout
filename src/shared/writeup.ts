import { PROFILE_FIELDS } from './catalog'
import { coverage, sortQuestions } from './questionBank'
import { RECOMMENDATION_LABEL, type RecommendationResult } from './recommend'
import { CRITERION_BY_KEY, normaliseScores, weightedScore } from './rubric'
import type {
  Company,
  ContextPack,
  Engagement,
  ExpertInput,
  Hypothesis,
  MeetingNotes,
  Question,
  Recommendation,
  Writeup,
  WriteupSection
} from './types'
import { nowIso } from './util'

export interface WriteupSources {
  engagement: Engagement
  company: Company
  pack: ContextPack
  hypotheses: Hypothesis[]
  questions: Question[]
  experts: ExpertInput[]
  meeting?: MeetingNotes
  suggestion: RecommendationResult
}

export const NO_SOURCE = '[no source]'

/** Collects numbered sources so every claim can cite one (design doc, "Evidence rule"). */
class Sources {
  private list: string[] = []
  cite(label: string | undefined): string {
    if (!label || !label.trim()) return ` ${NO_SOURCE}`
    let i = this.list.indexOf(label)
    if (i < 0) {
      this.list.push(label)
      i = this.list.length - 1
    }
    return ` [${i + 1}]`
  }
  toMarkdown(): string {
    if (!this.list.length) return 'No sources cited.'
    return this.list.map((s, i) => `${i + 1}. ${s}`).join('\n')
  }
}

/** Drafts the write-up sections from everything gathered in Stages 1 to 3. */
export function draftWriteup(src: WriteupSources, existing?: Writeup): Writeup {
  const { engagement, company, pack, meeting, suggestion } = src
  const sources = new Sources()
  const meetingSource = meeting?.notes.trim()
    ? `Meeting notes, ${meeting.date || 'undated'}${meeting.attendees ? ` (${meeting.attendees.replace(/\n/g, ', ')})` : ''}`
    : undefined
  const qs = sortQuestions(src.questions)
  const cov = coverage(qs)
  const scores = normaliseScores(engagement.scores)
  const ws = weightedScore(scores)
  const problems = new Map(pack.problems.map((p) => [p.id, p]))

  // Recommendation and top reasons.
  const rec = existing?.recommendation ?? suggestion.recommendation
  const reasons = topReasons(src, rec)
  const recBody = [
    `**${RECOMMENDATION_LABEL[rec]}.**${
      existing && existing.recommendation !== suggestion.recommendation
        ? ` (Scout suggested ${RECOMMENDATION_LABEL[suggestion.recommendation]}; overridden: ${existing.overrideReason || 'reason not given'}.)`
        : ''
    }`,
    '',
    ...reasons.map((r, i) => `${i + 1}. ${r}`)
  ].join('\n')

  // Company snapshot.
  const snapshot = [
    `**${company.name}** · ${company.segment}${company.website ? ` · ${company.website}` : ''}`,
    '',
    ...PROFILE_FIELDS.filter((f) => f.key !== 'openQuestions' && company.profile[f.key]?.value.trim()).map((f) => {
      const v = company.profile[f.key]!
      const label = v.sourceUrl ? `${v.sourceUrl}${v.checkedAt ? ` (checked ${v.checkedAt})` : ''}` : undefined
      return `- **${f.label}:** ${oneLine(v.value)}${sources.cite(label)}`
    }),
    ...((company.people ?? []).length
      ? [
          '',
          '**Key people**',
          '',
          ...(company.people ?? []).map(
            (p) =>
              `- **${p.name}**${p.role ? `, ${p.role}` : ''}${p.background ? `: ${oneLine(p.background)}` : ''}${
                p.notablePriorOrgs.length ? ` (previously ${p.notablePriorOrgs.join(', ')})` : ''
              }${sources.cite(p.sourceUrl)}`
          )
        ]
      : [])
  ].join('\n')

  // Rubric scores, with change since before the meeting.
  const base = new Map((engagement.baselineScores ?? []).map((s) => [s.criterion, s]))
  const scoreLines = scores.map((s) => {
    const def = CRITERION_BY_KEY[s.criterion]
    const before = base.get(s.criterion)
    const change =
      before && before.score !== s.score
        ? ` (was ${before.score ?? 'unscored'} before the meeting)`
        : ''
    const scoreText = s.score == null ? 'unscored' : `${s.score}/5, ${s.confidence} confidence`
    const evidence = s.evidence.trim() ? ` ${oneLine(s.evidence)}` : ''
    const cite = s.score == null ? '' : sources.cite(s.sourceUrl || (s.evidence.trim() ? meetingSource : undefined))
    return `- **${def.name}** (${Math.round(def.weight * 100)}%): ${scoreText}${change}.${evidence}${cite}`
  })
  const scoreBody = [
    ws.score == null
      ? 'No criteria are scored yet.'
      : `Weighted score **${ws.score.toFixed(2)} / 5** over ${Math.round(ws.coverage * 100)}% of rubric weight.`,
    '',
    ...scoreLines,
    ...hardRequirementLines(src)
  ].join('\n')

  // Hypotheses.
  const hyp = src.hypotheses.filter((h) => h.status === 'accepted')
  const hypBody = hyp.length
    ? hyp
        .map((h) => {
          const p = problems.get(h.problemId)
          const verdict = h.verdict === 'untested' ? 'Untested' : h.verdict === 'supported' ? 'Supported' : 'Weakened'
          const ev = h.evidence.trim() ? ` ${oneLine(h.evidence)}${sources.cite(meetingSource)}` : ''
          return `- **${verdict}:** If we used ${h.capability} for ${p ? `${p.code} (${p.title})` : 'our problem'}, we expect ${h.outcome}, measured by ${h.metric}.${ev}`
        })
        .join('\n')
    : 'No accepted augmentation hypotheses.'

  // Unanswered must-asks.
  const openBody = cov.mustOpen.length
    ? cov.mustOpen
        .map((q) => `- ${q.text} (${q.state === 'not_asked' ? 'not asked' : q.state === 'partly' ? 'partly answered' : 'asked, not answered'})`)
        .join('\n')
    : `All ${cov.mustTotal} must-ask questions were answered.`

  // Risks and red flags.
  const riskLines: string[] = []
  for (const q of qs.filter((q) => q.flagged)) {
    riskLines.push(`- Red flag on "${q.text}": ${oneLine(q.answer) || 'see meeting notes'}${sources.cite(meetingSource)}`)
  }
  for (const line of splitLines(meeting?.redFlags)) riskLines.push(`- ${line}${sources.cite(meetingSource)}`)
  for (const e of src.experts) {
    if (e.companyId && e.companyId !== company.id) continue
    for (const item of e.extracted) {
      if (item.confirmed && item.kind === 'concern') {
        const answered = qs.find((q) => q.originKey === `expert:${e.id}:${item.id}`)?.state === 'answered'
        if (!answered) riskLines.push(`- Open expert concern: ${item.text}${sources.cite(`Expert input from ${e.expertName || 'expert'}${e.role ? `, ${e.role}` : ''} (${e.createdAt.slice(0, 10)})`)}`)
      }
    }
  }
  const riskBody = riskLines.length ? riskLines.join('\n') : 'No red flags recorded.'

  // Next steps.
  const next: string[] = []
  if (rec === 'proceed') {
    next.push('- Proposed pilot scope: _to fill in_', '- Pilot owner: _to fill in_', '- Success measure: _to fill in_')
  } else if (rec === 'hold') {
    next.push('- Open a new round. Open must-asks carry forward as must-ask questions.')
    for (const c of suggestion.unknownHard) next.push(`- Confirm hard requirement: ${c.text}`)
  } else {
    next.push('- Record the reasons above so we do not re-scout this company without new information.')
  }
  for (const f of meeting?.followUps ?? []) {
    if (f.text.trim()) next.push(`- ${f.owner === 'us' ? 'We owe' : `${company.name} owes`}: ${f.text}`)
  }

  const sections: WriteupSection[] = [
    { key: 'recommendation', title: 'Recommendation', body: recBody },
    { key: 'snapshot', title: 'Company snapshot', body: snapshot },
    { key: 'scores', title: 'Rubric scores', body: scoreBody },
    { key: 'hypotheses', title: 'Augmentation hypotheses', body: hypBody },
    { key: 'unanswered', title: 'Must-ask questions left unanswered', body: openBody },
    { key: 'risks', title: 'Risks and red flags', body: riskBody },
    { key: 'next', title: 'Next steps and follow-ups', body: next.join('\n') },
    { key: 'sources', title: 'Sources', body: sources.toMarkdown() }
  ]

  const now = nowIso()
  return {
    id: engagement.id,
    engagementId: engagement.id,
    suggested: suggestion.recommendation,
    recommendation: rec,
    overrideReason: existing?.overrideReason ?? '',
    sections,
    signedOffAt: undefined,
    signedOffBy: undefined,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  }
}

function topReasons(src: WriteupSources, rec: Recommendation): string[] {
  const out: string[] = []
  const s = src.suggestion
  if (s.failedHard.length) out.push(...s.failedHard.map((c) => `Fails a hard requirement: ${c.text}.`))
  const scores = normaliseScores(src.engagement.scores).filter((x) => x.score != null)
  const sorted = [...scores].sort((a, b) => (b.score! - a.score!) || CRITERION_BY_KEY[b.criterion].weight - CRITERION_BY_KEY[a.criterion].weight)
  if (rec === 'proceed') {
    for (const x of sorted.slice(0, 2)) out.push(`Strong on ${CRITERION_BY_KEY[x.criterion].name.toLowerCase()} (${x.score}/5).`)
    const sup = src.hypotheses.filter((h) => h.status === 'accepted' && h.verdict === 'supported')
    if (sup.length) out.push(`${sup.length} augmentation hypothesis(es) supported by the meeting.`)
  } else if (rec === 'hold') {
    if (s.openMustAsks) out.push(`${s.openMustAsks} must-ask question(s) are still open.`)
    if (s.unknownHard.length) out.push(`${s.unknownHard.length} hard requirement(s) not yet confirmed.`)
    if (s.score != null) out.push(`Weighted score so far is ${s.score.toFixed(2)} / 5.`)
  } else {
    for (const x of [...sorted].reverse().slice(0, 2)) out.push(`Weak on ${CRITERION_BY_KEY[x.criterion].name.toLowerCase()} (${x.score}/5).`)
    if (s.score != null) out.push(`Weighted score is ${s.score.toFixed(2)} / 5.`)
  }
  if (!out.length) out.push(...s.reasons)
  return out.slice(0, 3)
}

function hardRequirementLines(src: WriteupSources): string[] {
  const hard = src.pack.constraints.filter((c) => c.hard)
  if (!hard.length) return []
  return [
    '',
    '**Hard requirements**',
    '',
    ...hard.map((c) => {
      const chk = src.engagement.hardChecks[c.id]
      const result = chk?.result ?? 'unknown'
      const label = result === 'pass' ? 'Pass' : result === 'fail' ? 'Fail' : 'Not confirmed'
      return `- ${label}: ${c.text}${chk?.note ? `. ${oneLine(chk.note)}` : ''}`
    })
  ]
}

export function writeupToMarkdown(w: Writeup, companyName: string, round: number): string {
  const head = [
    `# Write-up: ${companyName}${round > 1 ? ` (round ${round})` : ''}`,
    '',
    w.signedOffAt
      ? `_Signed off by ${w.signedOffBy || 'the scout'} on ${w.signedOffAt.slice(0, 10)}._`
      : '_Draft, not yet signed off._',
    ''
  ]
  const body = w.sections.flatMap((s) => [`## ${s.title}`, '', s.body.trim(), ''])
  return [...head, ...body].join('\n')
}

/** Counts claims that break the evidence rule, so the scout can fix them before sign-off. */
export function countUnsourced(w: Writeup): number {
  return w.sections.reduce((n, s) => n + (s.body.split(NO_SOURCE).length - 1), 0)
}

function oneLine(s: string): string {
  return s.replace(/\s*\n+\s*/g, '; ').trim()
}

function splitLines(s: string | undefined): string[] {
  return (s ?? '')
    .split('\n')
    .map((l) => l.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean)
}
