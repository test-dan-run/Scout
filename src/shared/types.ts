// Core data model for Scout Phase 1 (Prepare and Decide).
// Mirrors the "Data model" section of the design doc.

export type Id = string

export type CriterionKey =
  | 'workplace_fit'
  | 'deployment'
  | 'security'
  | 'openness'
  | 'maturity'
  | 'integration'
  | 'cost'
  | 'viability'

export type Confidence = 'low' | 'medium' | 'high'

/** A profile value with its citation and the date it was checked. */
export interface Sourced {
  value: string
  sourceUrl?: string
  /** ISO date (YYYY-MM-DD) the value was last checked against its source. */
  checkedAt?: string
}

export type ProfileFieldKey =
  | 'pitch'
  | 'products'
  | 'deployment'
  | 'targetCustomers'
  | 'notableCustomers'
  | 'pricing'
  | 'funding'
  | 'localPresence'
  | 'competitors'
  | 'recentNews'
  | 'openQuestions'

export interface Company {
  id: Id
  name: string
  segment: string
  website?: string
  profile: Partial<Record<ProfileFieldKey, Sourced>>
  createdAt: string
  updatedAt: string
}

export interface CriterionScore {
  criterion: CriterionKey
  /** 1 to 5, or null when not yet scored. */
  score: number | null
  confidence: Confidence
  evidence: string
  sourceUrl?: string
}

export type Recommendation = 'proceed' | 'hold' | 'do_not_proceed'

export type HardCheck = 'pass' | 'fail' | 'unknown'

export interface Engagement {
  id: Id
  companyId: Id
  round: number
  previousEngagementId?: Id
  stage: 'prepare' | 'engage' | 'decide' | 'closed'
  status: 'active' | Recommendation
  owner: string
  scores: CriterionScore[]
  /** Scores as they stood before the meeting, so the write-up can show what changed. */
  baselineScores?: CriterionScore[]
  /** Result of each hard requirement (Context Pack constraint with hard=true) for this company. */
  hardChecks: Record<Id, { result: HardCheck; note: string }>
  createdAt: string
  updatedAt: string
}

export interface Constraint {
  id: Id
  text: string
  /** A hard requirement overrides the rubric score when it fails. */
  hard: boolean
  criterion?: CriterionKey
}

export interface ProblemStatement {
  id: Id
  /** Short code such as P1, used in hypotheses and prompts. */
  code: string
  title: string
  description: string
  owner: string
  successMeasure: string
}

export interface PastEngagement {
  engagementId: Id
  companyName: string
  round: number
  date: string
  recommendation: Recommendation
  summary: string
}

export interface ContextPack {
  id: 'main'
  teamName: string
  mission: string
  priorities: string
  aiStack: string
  painPoints: string
  constraints: Constraint[]
  problems: ProblemStatement[]
  pastEngagements: PastEngagement[]
  updatedAt: string
}

export interface ExtractedItem {
  id: Id
  kind: 'concern' | 'question'
  text: string
  criterion?: CriterionKey
  /** null = not reviewed yet; true = confirmed by the scout; false = discarded. */
  confirmed: boolean | null
}

export interface ExpertInput {
  id: Id
  expertName: string
  role: string
  /** Company this input is about; empty means it applies to every company. */
  companyId?: Id
  topic: string
  criterion?: CriterionKey
  rawText: string
  extracted: ExtractedItem[]
  createdAt: string
  updatedAt: string
}

export interface Hypothesis {
  id: Id
  engagementId: Id
  capability: string
  problemId: Id
  outcome: string
  metric: string
  status: 'draft' | 'accepted' | 'rejected'
  verdict: 'untested' | 'supported' | 'weakened'
  evidence: string
  createdAt: string
  updatedAt: string
}

export type Priority = 'must' | 'should' | 'nice'
export type QuestionState = 'not_asked' | 'asked' | 'partly' | 'answered'
export type QuestionOrigin = 'rubric' | 'hypothesis' | 'expert' | 'standard' | 'carried' | 'manual'

export interface Question {
  id: Id
  engagementId: Id
  text: string
  priority: Priority
  origin: QuestionOrigin
  /** Stable key for generated questions so regenerating does not duplicate them. */
  originKey?: string
  criterion?: CriterionKey
  hypothesisId?: Id
  goodAnswer: string
  redFlag: string
  followUps: string[]
  state: QuestionState
  answer: string
  /** The answer matched a red flag. */
  flagged: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export interface AgendaBlock {
  title: string
  minutes: number
  points: string[]
}

export interface Brief {
  id: Id // same as engagementId
  engagementId: Id
  meetingWith: string
  meetingDate: string
  whyItMatters: string
  mustLearn: string[]
  opening: string
  agenda: AgendaBlock[]
  canShare: string
  cannotShare: string
  updatedAt: string
}

export interface FollowUp {
  owner: 'us' | 'them'
  text: string
}

export interface MeetingNotes {
  id: Id // same as engagementId
  engagementId: Id
  date: string
  attendees: string
  notes: string
  redFlags: string
  followUps: FollowUp[]
  updatedAt: string
}

export interface WriteupSection {
  key: string
  title: string
  body: string
}

export interface Writeup {
  id: Id // same as engagementId
  engagementId: Id
  suggested: Recommendation
  recommendation: Recommendation
  overrideReason: string
  sections: WriteupSection[]
  signedOffAt?: string
  signedOffBy?: string
  createdAt: string
  updatedAt: string
}

export type LlmProvider = 'none' | 'ollama' | 'lmstudio'

export interface Settings {
  id: 'main'
  userName: string
  llmProvider: LlmProvider
  llmBaseUrl: string
  llmModel: string
}

/** Every record kind the store knows, with its type. */
export interface RecordKinds {
  companies: Company
  engagements: Engagement
  contextPack: ContextPack
  experts: ExpertInput
  hypotheses: Hypothesis
  questions: Question
  briefs: Brief
  meetings: MeetingNotes
  writeups: Writeup
  settings: Settings
}

export type Kind = keyof RecordKinds

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}
