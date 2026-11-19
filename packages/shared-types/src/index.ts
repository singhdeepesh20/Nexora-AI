/** Types mirroring the NEXORA local API (/api/v1). Keep in sync with backend/nexora/api. */
import type { DistrictSpec, Bounds } from '@nexora/world-engine'

export interface Avatar { body_color: string; accent_color: string; position: { x: number; z: number; heading: number } }
export interface StudentSettings {
  graphics?: 'low' | 'medium' | 'high'; mentor_model?: string; mentor_mode?: MentorMode; show_fps?: boolean
  reduced_motion?: boolean; time_of_day?: 'auto' | 'morning' | 'afternoon' | 'evening' | 'night'; gate_first_entry_at?: string; onboarding?: 'pending' | 'done' | 'skipped'; onboarding_started_at?: string; onboarding_completed_at?: string
}
export interface Student { id: string; display_name: string; created_at: string; settings: StudentSettings; avatar: Avatar | null }

export interface District extends DistrictSpec {
  professor: string
  subjects: string[]
  concepts: string[]
  missions: string[]
  simulations: string[]
}
export interface WorldResponse {
  world: { bounds: Bounds; spawn: { x: number; z: number; heading: number }; plaza_radius: number }
  districts: District[]
  curriculum_version: string
}

export interface ConceptSummary {
  id: string; district: string; order: number; title: string; summary: string; prerequisites: string[]
  simulations: string[]; missions: string[]; skills: string[]; required_mission: string | null
}
export interface Concept extends ConceptSummary {
  objectives: string[]
  examples: { title: string; code?: string; text?: string }[]
  socratic_prompts: string[]
  lesson_markdown: string
}

export type ConceptStatus = 'locked' | 'available' | 'in_progress' | 'mastered'
export interface ConceptState {
  concept_id: string; status: ConceptStatus; mastery: number; best_assessment_score: number
  assessment_attempts: number; failed_attempts: number; required_mission: string | null
  required_mission_passed: boolean | null; missing_prerequisites: string[]; lesson_opened: boolean
  last_practiced_at: string | null; review_due: boolean
}
export interface Recommendation { concept_id: string; kind: 'learn' | 'continue' | 'review' | 'mission'; reason: string; title: string; district: string; mission_id?: string }
export interface SkillLevel { skill_id: string; name: string; description: string; level: number; concepts: string[]; mastered_concepts: string[] }
export interface LearningState {
  concepts: Record<string, ConceptState>
  recommendations: Recommendation[]
  skills: SkillLevel[]
  totals: { mastered: number; concepts: number }
}

export interface Question { id: string; type: 'choice' | 'numeric'; prompt: string; options?: string[] }
export interface Assessment { concept_id: string; version: string; pass_score: number; questions: Question[] }
export interface AssessmentResult {
  score: number; passed: boolean; pass_score: number
  results: { id: string; correct: boolean; given: unknown; expected: unknown; explanation: string }[]
  concept_state: ConceptState; unlocked: string[]; achievements: Achievement[]
}

export interface Achievement { code: string; title: string; earned_at?: string }

export interface MissionSummary {
  id: string; title: string; difficulty: string; district: string; summary: string; concepts: string[]
  prerequisites: string[]; locked: boolean; missing_prerequisites: string[]
  best: { best_score: number; passed: boolean; attempts: number } | null
}
export interface MissionDetail {
  id: string; title: string; difficulty: string; summary: string; description: string; requirements: string[]
  starter_code: string; test_names: string[]; submission_format: string
  evaluation: { weights: Record<string, number>; pass_rule: string }; time_limit_s: number
}
export interface TestResult { name: string; status: 'passed' | 'failed' | 'error'; message: string; duration_ms: number; stdout: string; category: string }
export interface Isolation { os_sandbox: string; strength: string; notes: string; network_blocked_by_os: boolean }
export interface MissionResult {
  mission_id: string; passed: boolean; score: number; problem: string | null; syntax_error: string | null
  categories: Record<string, { passed?: number; total?: number; score: number; checks?: { id: string; label: string; ratio: number; detail: unknown[] }[] }>
  tests: TestResult[]; stdout: string; stderr: string; duration_ms: number; isolation: Isolation; rule: string
  achievements: Achievement[]; newly_mastered: string[]
}

export interface SimulationInfo { id: string; title: string; district: string; description: string; kind: string; version: string }
export interface SimulationResponse<R = Record<string, unknown>> { simulation: string; version: string; config: Record<string, unknown>; result: R; experiment_id: string | null; achievements: Achievement[] }
export interface Experiment { id: string; simulation: string; engine_version: string; config: Record<string, unknown>; summary: Record<string, unknown>; note: string; created_at: string }

export type MentorMode = 'auto' | 'explain' | 'socratic' | 'coding' | 'research'
export interface Mentor { id: string; name: string; domain: string; districts: string[]; color: string; style: string }
export interface ChatResponse { conversation_id: string; mentor_id: string; mode: MentorMode; source: string; reply: string; references: { concept_id: string; title: string; snippet: string }[] }
export interface AIStatus { provider: string | null; available: boolean; url?: string; models: { name: string; parameter_size?: string; quantization?: string }[]; help?: string }

export interface ProjectFile { name: string; size: number }
export interface Project { id: string; name: string; description: string; kind: string; updated_at: string; files: ProjectFile[] }
export interface RunResult { stdout: string; stderr: string; timed_out: boolean; exit_code: number | null; duration_ms: number; error: string | null; isolation: Isolation }
export interface SystemInfo { version: string; data_dir: string; schema_revision: string; curriculum_version: string; sandbox: Isolation & Record<string, unknown>; telemetry: string }

/* ------------------------------------------------------------------ engagement */
export type SimEventType =
  | 'LOSS_DIVERGENCE' | 'GRADIENT_EXPLOSION' | 'OVERFITTING_DETECTED' | 'UNDERFITTING_DETECTED' | 'NUMERICAL_INSTABILITY'
  | 'MEMORY_OVERFLOW' | 'NAN_DETECTED' | 'TRAINING_STALLED' | 'RETRIEVAL_FAILURE' | 'OSCILLATION' | 'SUCCESSFUL_CONVERGENCE'
export type Severity = 'info' | 'success' | 'warning' | 'critical'
export interface SimEvent { type: SimEventType; severity: Severity; title: string; message: string; metrics: Record<string, unknown> }
export interface XPAward { xp: number; reason: string }

export interface ChallengeSummary {
  id: string; version: string; lab: string; difficulty: 'easy' | 'medium' | 'hard'; title: string; description: string
  objective: string; initial_config: Record<string, unknown>; allowed: string[]; xp: number; achievement?: string | null
  onboarding: boolean; target: string[]; hint_count: number; attempts: number; passed: boolean
}
export interface ChallengeCheck { label: string; passed: boolean; actual: unknown }
export interface ChallengeResult {
  challenge_id: string; passed: boolean; first_pass: boolean; checks: ChallengeCheck[]; metrics: Record<string, unknown>
  events: SimEvent[]; config: Record<string, unknown>; result: Record<string, unknown>; explanation: string | null
  attempt_id: string; xp: XPAward[]; achievements: Achievement[]
}

export interface RankCheck { label: string; have: number; need: number; met: boolean; unit: 'count' | 'percent' }
export interface Progression {
  xp: number
  level: { level: number; level_floor: number; next_level_at: number; into_level: number; level_span: number }
  rank: { id: string; title: string; index: number; of: number; next: null | { id: string; title: string; checks: RankCheck[] } }
  evidence: { xp: number; mastered_concepts: number; missions_passed: number; challenges_passed: number; daily_solved: number }
  streak: { current: number; longest: number; active_today: boolean; total_active_days: number; calendar: { date: string; active: boolean }[] }
  history: { xp: number; reason: string; source_type: string; created_at: string }[]
  timezone: string
}

export interface DailyView {
  number: number; puzzle_id: string; version: string; title: string; topic: string; description: string; starter_code: string
  hidden_tests: number; started_at: string | null; solved: boolean; seconds: number | null; attempts: boolean[][]
  explanation: string | null; share_text: string | null; calendar_note?: string
  last?: { passed: boolean; outcomes: boolean[]; problem: string | null; failures: { message: string }[] }; xp?: XPAward[]
}

export interface ShareCard {
  layout: 'mission' | 'challenge' | 'onboarding' | 'daily' | 'rank'; eyebrow: string; title: string; headline: string
  stats: { label: string; value: string }[]; grid?: boolean[][]; rank: string; footer: string; name: string | null; verified_at: string | null
}

/* ------------------------------------------------------------------ campus life */
export interface Department { id: string; name: string; tracks: string[] }
export interface UniversityInfo { name: string; motto: string; philosophy: string; disclaimer: string }
export interface ClassmateInfo { id: string; name: string; archetype: string; department: string; department_name: string; presentation: 'F' | 'M' }
export interface CampusInfo { university: UniversityInfo; departments: Department[]; students: ClassmateInfo[] }
export interface IdCard {
  university: string; card_number: string; name: string; department_id: string; department: string; track: string
  enrollment_year: number; academic_year: number; semester: number; rank: string; issued_at: string; notice: string
}
export interface GateResult { verified: boolean; reason: 'ok' | 'no_card' | 'mismatch'; first_time?: boolean; lines: string[] }
export interface TalkResult { npc: ClassmateInfo; lines: string[]; relation: { status: 'stranger' | 'acquaintance' | 'friend'; conversations: number; friend_after: number } }
