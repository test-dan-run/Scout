import { coverage } from './questionBank'
import { normaliseScores, weightedScore } from './rubric'
import type { Constraint, Engagement, Question, Recommendation } from './types'

export const PROCEED_THRESHOLD = 3.5
export const DO_NOT_PROCEED_THRESHOLD = 2.5

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  proceed: 'Proceed',
  hold: 'Hold',
  do_not_proceed: 'Do not proceed'
}

export interface RecommendationResult {
  recommendation: Recommendation
  score: number | null
  coverage: number
  reasons: string[]
  failedHard: Constraint[]
  unknownHard: Constraint[]
  openMustAsks: number
}

/**
 * Suggests a recommendation (design doc, Stage 4):
 * - any failed hard requirement means Do not proceed, whatever the score;
 * - a weighted score of 3.5 or more, with every hard requirement passed and
 *   every must-ask answered, suggests Proceed;
 * - a score under 2.5 suggests Do not proceed;
 * - anything else is Hold, listing what is still needed.
 * The scout always makes the final call.
 */
export function suggestRecommendation(
  engagement: Engagement,
  hardConstraints: Constraint[],
  questions: Question[]
): RecommendationResult {
  const ws = weightedScore(normaliseScores(engagement.scores))
  const cov = coverage(questions)
  const hard = hardConstraints.filter((c) => c.hard)
  const failedHard = hard.filter((c) => engagement.hardChecks[c.id]?.result === 'fail')
  const unknownHard = hard.filter((c) => (engagement.hardChecks[c.id]?.result ?? 'unknown') === 'unknown')
  const reasons: string[] = []
  const base = { score: ws.score, coverage: ws.coverage, failedHard, unknownHard, openMustAsks: cov.mustOpen.length }

  if (failedHard.length > 0) {
    reasons.push(...failedHard.map((c) => `Fails hard requirement: ${c.text}`))
    return { ...base, recommendation: 'do_not_proceed', reasons }
  }
  if (ws.score == null) {
    reasons.push('No rubric criteria are scored yet.')
    return { ...base, recommendation: 'hold', reasons }
  }
  if (ws.score < DO_NOT_PROCEED_THRESHOLD) {
    reasons.push(`Weighted score ${ws.score.toFixed(2)} is below ${DO_NOT_PROCEED_THRESHOLD}.`)
    return { ...base, recommendation: 'do_not_proceed', reasons }
  }
  if (ws.score >= PROCEED_THRESHOLD && unknownHard.length === 0 && cov.mustOpen.length === 0) {
    reasons.push(`Weighted score ${ws.score.toFixed(2)} meets the ${PROCEED_THRESHOLD} bar.`)
    if (hard.length) reasons.push('All hard requirements pass.')
    reasons.push('Every must-ask question was answered.')
    return { ...base, recommendation: 'proceed', reasons }
  }
  if (ws.score < PROCEED_THRESHOLD) {
    reasons.push(`Weighted score ${ws.score.toFixed(2)} is below the ${PROCEED_THRESHOLD} bar for Proceed.`)
  } else {
    reasons.push(`Weighted score ${ws.score.toFixed(2)} meets the ${PROCEED_THRESHOLD} bar.`)
  }
  if (unknownHard.length) reasons.push(`${unknownHard.length} hard requirement(s) not yet confirmed.`)
  if (cov.mustOpen.length) reasons.push(`${cov.mustOpen.length} must-ask question(s) still open.`)
  if (ws.coverage < 1) reasons.push(`Only ${Math.round(ws.coverage * 100)}% of rubric weight is scored.`)
  return { ...base, recommendation: 'hold', reasons }
}
