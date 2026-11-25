import { sortQuestions } from './questionBank'
import type { Brief, Company, ContextPack, Hypothesis, Question } from './types'
import { nowIso } from './util'

export const CONSENT_REMINDER =
  'At the start, ask for consent before recording or taking detailed notes, and say what we will keep.'

export interface BriefSources {
  engagementId: string
  company: Company
  pack: ContextPack
  hypotheses: Hypothesis[]
  questions: Question[]
  existing?: Brief
}

/** Drafts the 1-page brief and speaker notes from the profile, fit map and question bank. */
export function draftBrief(src: BriefSources): Brief {
  const { company, pack } = src
  const accepted = src.hypotheses.filter((h) => h.status === 'accepted')
  const problems = new Map(pack.problems.map((p) => [p.id, p]))
  const linkedProblems = [...new Set(accepted.map((h) => problems.get(h.problemId)).filter(Boolean))]

  const why =
    linkedProblems.length > 0
      ? `${company.name} may help with ${linkedProblems
          .map((p) => `${p!.code} (${p!.title})`)
          .join(', ')}. ${accepted
          .slice(0, 2)
          .map((h) => `If we used ${h.capability}, we expect ${h.outcome}.`)
          .join(' ')}`
      : `${company.name} is in the ${company.segment} segment${
          company.profile.pitch?.value ? `: ${company.profile.pitch.value.trim().replace(/\.$/, "")}` : ''
        }. We have not yet linked it to a problem statement; add a hypothesis in the fit map.`

  const must = sortQuestions(src.questions).filter((q) => q.priority === 'must' && q.state !== 'answered')
  const mustLearn = must.slice(0, 3).map((q) => q.text)
  while (mustLearn.length < 3) mustLearn.push('')

  const team = pack.teamName || 'our team'
  const opening = `Thank you for meeting us. We are ${team}${
    pack.mission ? `, and our job is to ${lowerFirst(pack.mission)}` : ''
  }. We are looking at options in the ${company.segment} space and want to understand where ${
    company.name
  } fits. We have a few specific questions, and we would also like to hear what you think we should be asking.`

  const deepDive = must.slice(0, 6).map((q) => q.text)
  const agenda = [
    { title: 'Introductions and consent', minutes: 5, points: [CONSENT_REMINDER, 'Who is in the room and their roles.'] },
    {
      title: 'Our context',
      minutes: 5,
      points: [
        pack.priorities ? `Our priorities: ${firstLine(pack.priorities)}` : 'Our current priorities, at a high level.',
        'Share only what is in the "can share" list below.'
      ]
    },
    {
      title: `${company.name} overview`,
      minutes: 15,
      points: [
        'Let them present, but steer toward deployment, data handling and production customers.',
        ...(company.profile.products?.value ? [`Products we know of: ${firstLine(company.profile.products.value)}`] : [])
      ]
    },
    {
      title: 'Deep dive: must-ask questions',
      minutes: 20,
      points: deepDive.length ? deepDive : ['Work through the must-ask questions in the question bank.']
    },
    {
      title: 'Next steps',
      minutes: 5,
      points: ['Agree on follow-ups owed by each side, with dates.', 'Ask who our named contact will be.']
    }
  ]

  return {
    id: src.engagementId,
    engagementId: src.engagementId,
    meetingWith: src.existing?.meetingWith ?? '',
    meetingDate: src.existing?.meetingDate ?? '',
    whyItMatters: why,
    mustLearn,
    opening,
    agenda,
    canShare: src.existing?.canShare || 'Our team mission and priorities at a high level.\nThe kinds of problems we are trying to solve.',
    cannotShare:
      src.existing?.cannotShare ||
      'Internal system names and architecture details.\nBudgets, other vendors we are talking to, and procurement timelines.\nAnything classified above public.',
    updatedAt: nowIso()
  }
}

export function briefToMarkdown(b: Brief, companyName: string): string {
  const lines: string[] = []
  lines.push(`# Meeting brief: ${companyName}`)
  lines.push('')
  if (b.meetingDate || b.meetingWith) {
    lines.push(`**Meeting:** ${[b.meetingDate, b.meetingWith].filter(Boolean).join(' · ')}`)
    lines.push('')
  }
  lines.push('## Why it matters to us', '', b.whyItMatters, '')
  lines.push('## Three things we must learn', '')
  b.mustLearn.filter(Boolean).forEach((m, i) => lines.push(`${i + 1}. ${m}`))
  lines.push('', '## Our opening', '', b.opening, '')
  lines.push('## Speaker notes', '')
  for (const block of b.agenda) {
    lines.push(`### ${block.title} (${block.minutes} min)`, '')
    for (const p of block.points) if (p.trim()) lines.push(`- ${p.trim()}`)
    lines.push('')
  }
  lines.push('## What we can share', '', ...bullets(b.canShare), '')
  lines.push('## What we cannot share', '', ...bullets(b.cannotShare), '')
  lines.push(`_${CONSENT_REMINDER}_`)
  return lines.join('\n')
}

function bullets(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `- ${l.replace(/^[-*]\s*/, '')}`)
}

function firstLine(s: string): string {
  return s.split('\n').map((l) => l.trim()).filter(Boolean)[0] ?? ''
}

function lowerFirst(s: string): string {
  const t = s.trim().replace(/\.$/, '')
  return t.charAt(0).toLowerCase() + t.slice(1)
}
