/** Row types mirroring src/lib/db/schema.sql. */

export const PILLARS = ["BODY", "BUSINESS", "FINANCE", "CHARACTER", "LEARNING", "LIFE"] as const;
export type Pillar = (typeof PILLARS)[number];

/** The five scored pillars (LIFE is a container, not a score). */
export const SCORED_PILLARS = ["BODY", "BUSINESS", "CHARACTER", "FINANCE", "LEARNING"] as const;
export type ScoredPillar = (typeof SCORED_PILLARS)[number];

export type Trend = "UP" | "FLAT" | "DOWN";

export interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface User extends Timestamps {
  id: string;
  name: string;
  email: string | null;
  timezone: string;
  currency: string;
  locale: string;
  life_vision: string | null;
}

export interface Season extends Timestamps {
  id: string;
  name: string;
  objective: string | null;
  why: string | null;
  start_date: string;
  end_date: string | null;
  status: "PLANNED" | "ACTIVE" | "CLOSED";
  weight_body: number;
  weight_business: number;
  weight_character: number;
  weight_finance: number;
  weight_learning: number;
}

export type GoalHorizon = "VISION" | "THREE_YEAR" | "ONE_YEAR" | "QUARTER" | "MONTH" | "WEEK";

export interface Goal extends Timestamps {
  id: string;
  parent_id: string | null;
  horizon: GoalHorizon;
  pillar: Pillar;
  title: string;
  why: string | null;
  kpi: string | null;
  unit: string | null;
  start_value: number | null;
  current_value: number | null;
  target_value: number | null;
  direction: "UP" | "DOWN";
  metric_source: string | null;
  deadline: string | null;
  status: "ACTIVE" | "ACHIEVED" | "MISSED" | "PAUSED" | "ARCHIVED";
  next_action: string | null;
  sort_order: number;
  completed_at: string | null;
}

export interface Mission extends Timestamps {
  id: string;
  season_id: string | null;
  goal_id: string | null;
  title: string;
  objective: string | null;
  why: string | null;
  kind: "PRIMARY" | "SECONDARY";
  start_date: string;
  end_date: string;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  metric_source: string | null;
  status: "PLANNED" | "ACTIVE" | "COMPLETE" | "FAILED" | "ABANDONED";
  completed_at: string | null;
}

export interface Milestone extends Timestamps {
  id: string;
  mission_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  sort_order: number;
  weight: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETE" | "SKIPPED";
  completed_at: string | null;
}

export interface MissionKpi extends Timestamps {
  id: string;
  mission_id: string;
  name: string;
  unit: string | null;
  current_value: number | null;
  target_value: number | null;
  metric_source: string | null;
}

export interface Risk extends Timestamps {
  id: string;
  mission_id: string | null;
  project_id: string | null;
  title: string;
  detail: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  likelihood: "UNLIKELY" | "POSSIBLE" | "LIKELY" | "ALMOST_CERTAIN";
  mitigation: string | null;
  status: "OPEN" | "MITIGATED" | "ACCEPTED" | "CLOSED";
}

export interface Project extends Timestamps {
  id: string;
  mission_id: string | null;
  goal_id: string | null;
  business_id: string | null;
  pillar: Pillar;
  title: string;
  objective: string | null;
  expected_outcome: string | null;
  revenue_impact: number | null;
  cost: number | null;
  deadline: string | null;
  status: "PLANNED" | "ACTIVE" | "BLOCKED" | "COMPLETE" | "CANCELLED";
  next_action: string | null;
  completed_at: string | null;
}

export type TaskPriority = "MUST_WIN" | "SUPPORT" | "BACKLOG";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE" | "CANCELLED";

export interface Task extends Timestamps {
  id: string;
  project_id: string | null;
  mission_id: string | null;
  goal_id: string | null;
  pillar: Pillar;
  title: string;
  description: string | null;
  expected_outcome: string | null;
  priority: TaskPriority;
  scheduled_date: string | null;
  deadline: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  status: TaskStatus;
  blocked_reason: string | null;
  sort_order: number;
  completed_at: string | null;
}

/* --------------------------------------------------------------- BODY */

export type ExerciseModality =
  | "WEIGHT_REPS"
  | "BODYWEIGHT_REPS"
  | "WEIGHTED_BODYWEIGHT"
  | "TIME"
  | "DISTANCE_TIME"
  | "WEIGHT_DISTANCE_TIME"
  | "REPS_TIME";

export interface Exercise extends Timestamps {
  id: string;
  name: string;
  category: "STRENGTH" | "CONDITIONING" | "RUN" | "HYROX" | "MOBILITY";
  modality: ExerciseModality;
  muscle_group: string | null;
  is_compound: number;
  default_rest_sec: number;
  progression_rule: "DOUBLE_PROGRESSION" | "LINEAR" | "NONE";
  increment_kg: number;
  notes: string | null;
  archived: number;
}

export type WorkoutType =
  | "STRENGTH"
  | "RUN"
  | "CONDITIONING"
  | "HYROX"
  | "RECOVERY"
  | "MOBILITY";

export interface Workout extends Timestamps {
  id: string;
  name: string;
  type: WorkoutType;
  focus: string | null;
  description: string | null;
  est_minutes: number | null;
  archived: number;
}

export interface Prescription {
  target_sets: number;
  rep_min: number | null;
  rep_max: number | null;
  target_weight_kg: number | null;
  target_seconds: number | null;
  target_distance_m: number | null;
  target_pace_sec: number | null;
  target_rpe: number | null;
  target_rir_min: number | null;
  target_rir_max: number | null;
  rest_sec: number | null;
  tempo: string | null;
  notes: string | null;
}

export interface WorkoutExercise extends Timestamps, Prescription {
  id: string;
  workout_id: string;
  exercise_id: string;
  sort_order: number;
}

export type SessionStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "MODIFIED"
  | "SKIPPED"
  | "RECOVERY";

export interface WorkoutSession extends Timestamps {
  id: string;
  workout_id: string | null;
  date: string;
  name: string;
  type: WorkoutType;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  duration_min: number | null;
  session_rpe: number | null;
  notes: string | null;
  completed_at: string | null;
}

export interface SessionExercise extends Timestamps, Prescription {
  id: string;
  session_id: string;
  exercise_id: string;
  sort_order: number;
  target_source: "TEMPLATE" | "PROGRESSION" | "MANUAL" | "NONE";
  target_rationale: string | null;
}

export interface WorkoutSet extends Timestamps {
  id: string;
  session_exercise_id: string;
  session_id: string;
  exercise_id: string;
  date: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
  seconds: number | null;
  distance_m: number | null;
  rpe: number | null;
  rir: number | null;
  is_warmup: number;
  notes: string | null;
}

export type RunType = "EASY" | "ZONE2" | "TEMPO" | "INTERVALS" | "LONG" | "RACE" | "RECOVERY";

export interface Run extends Timestamps {
  id: string;
  session_id: string | null;
  date: string;
  type: RunType;
  distance_m: number | null;
  duration_sec: number | null;
  avg_pace_sec: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  elevation_m: number | null;
  rpe: number | null;
  target_distance_m: number | null;
  target_pace_sec: number | null;
  notes: string | null;
}

export interface RunInterval extends Timestamps {
  id: string;
  run_id: string;
  interval_index: number;
  distance_m: number | null;
  duration_sec: number | null;
  pace_sec: number | null;
  target_pace_sec: number | null;
  recovery_sec: number | null;
  avg_hr: number | null;
  notes: string | null;
}

export const HYROX_STATIONS = [
  "RUN",
  "SKIERG",
  "SLED_PUSH",
  "SLED_PULL",
  "BURPEE_BROAD_JUMP",
  "ROW",
  "FARMERS_CARRY",
  "SANDBAG_LUNGES",
  "WALL_BALLS",
] as const;
export type HyroxStationName = (typeof HYROX_STATIONS)[number];

export interface HyroxSession extends Timestamps {
  id: string;
  session_id: string | null;
  date: string;
  kind: "STATION_WORK" | "PARTIAL_SIM" | "FULL_SIM" | "RACE";
  division: "OPEN" | "PRO" | "DOUBLES";
  total_sec: number | null;
  run_total_sec: number | null;
  station_total_sec: number | null;
  transition_sec: number | null;
  notes: string | null;
}

export interface HyroxStation extends Timestamps {
  id: string;
  hyrox_session_id: string;
  station: HyroxStationName;
  sequence: number;
  duration_sec: number | null;
  distance_m: number | null;
  weight_kg: number | null;
  reps: number | null;
  pace_sec: number | null;
  transition_sec: number | null;
  rpe: number | null;
  notes: string | null;
}

export interface NutritionTarget extends Timestamps {
  id: string;
  effective_from: string;
  goal: "MUSCLE_GAIN" | "MAINTENANCE" | "FAT_LOSS" | "HYBRID";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  water_ml: number | null;
  weight_trend_kg_per_week: number | null;
}

export interface NutritionLog extends Timestamps {
  id: string;
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  water_ml: number;
  notes: string | null;
}

export interface Meal extends Timestamps {
  id: string;
  nutrition_log_id: string;
  date: string;
  name: string;
  slot: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK" | "MEAL" | "SHAKE";
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  logged_at: string;
}

export interface MealPreset extends Timestamps {
  id: string;
  name: string;
  slot: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  use_count: number;
}

export interface BodyMeasurement extends Timestamps {
  id: string;
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  shoulder_cm: number | null;
  thigh_cm: number | null;
  hip_cm: number | null;
  neck_cm: number | null;
  body_fat_pct: number | null;
  photo_note: string | null;
  notes: string | null;
}

export interface RecoveryLog extends Timestamps {
  id: string;
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  energy: number | null;
  stress: number | null;
  soreness: number | null;
  motivation: number | null;
  resting_hr: number | null;
  is_rest_day: number;
  notes: string | null;
}

export interface PersonalRecord extends Timestamps {
  id: string;
  domain: "STRENGTH" | "RUN" | "HYROX";
  exercise_id: string | null;
  station: string | null;
  run_distance_m: number | null;
  kind: "WEIGHT" | "REPS" | "VOLUME" | "E1RM" | "DISTANCE" | "PACE" | "TIME";
  value: number;
  display: string;
  previous_value: number | null;
  date: string;
  source_id: string | null;
}

/* ----------------------------------------------------------- BUSINESS */

export interface Business extends Timestamps {
  id: string;
  name: string;
  model: string | null;
  stage: "IDEA" | "VALIDATE" | "BUILD" | "LAUNCH" | "SCALE" | "SOLD" | "CLOSED";
  target_customer: string | null;
  offer: string | null;
  avg_deal_cents: number | null;
  mrr_target_cents: number | null;
}

export const LEAD_STAGES = [
  "PROSPECT",
  "CONTACTED",
  "RESPONDED",
  "MEETING",
  "PROPOSAL",
  "CUSTOMER",
  "RETAINED",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number] | "LOST";

export interface Lead extends Timestamps {
  id: string;
  business_id: string | null;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: string | null;
  stage: LeadStage;
  potential_cents: number;
  probability: number;
  last_contact_date: string | null;
  next_action: string | null;
  next_action_date: string | null;
  lost_reason: string | null;
  notes: string | null;
  closed_at: string | null;
}

export interface LeadStageEvent extends Timestamps {
  id: string;
  lead_id: string;
  from_stage: string | null;
  to_stage: string;
  date: string;
}

export interface Customer extends Timestamps {
  id: string;
  business_id: string | null;
  lead_id: string | null;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  status: "ACTIVE" | "PAUSED" | "CHURNED";
  mrr_cents: number;
  started_at: string;
  churned_at: string | null;
  notes: string | null;
}

export interface RevenueEntry extends Timestamps {
  id: string;
  business_id: string | null;
  customer_id: string | null;
  date: string;
  amount_cents: number;
  kind: "ONE_OFF" | "RECURRING";
  description: string | null;
  received: number;
}

export interface BusinessExpense extends Timestamps {
  id: string;
  business_id: string | null;
  date: string;
  amount_cents: number;
  category: string | null;
  description: string | null;
  recurring: number;
}

export interface BusinessKpi extends Timestamps {
  id: string;
  business_id: string | null;
  name: string;
  unit: string | null;
  target_value: number | null;
  metric_source: string | null;
  sort_order: number;
}

/* ------------------------------------------------------------ FINANCE */

export interface Account extends Timestamps {
  id: string;
  name: string;
  kind: "CASH" | "SAVINGS" | "CREDIT" | "INVESTMENT";
  balance_cents: number;
  include_in_cash: number;
}

export interface PersonalExpense extends Timestamps {
  id: string;
  date: string;
  amount_cents: number;
  category: string;
  description: string | null;
  essential: number;
  recurring: number;
}

export interface IncomeEntry extends Timestamps {
  id: string;
  date: string;
  amount_cents: number;
  source: string;
  description: string | null;
  recurring: number;
}

export interface ScheduledCashItem extends Timestamps {
  id: string;
  name: string;
  direction: "IN" | "OUT";
  amount_cents: number;
  cadence: "ONCE" | "WEEKLY" | "MONTHLY";
  day_of_month: number | null;
  day_of_week: number | null;
  next_date: string | null;
  category: string | null;
  debt_id: string | null;
  active: number;
}

export interface Debt extends Timestamps {
  id: string;
  name: string;
  kind: "LOAN" | "CREDIT_CARD" | "VEHICLE" | "BOND" | "FAMILY" | "OTHER";
  original_cents: number;
  balance_cents: number;
  interest_rate: number | null;
  min_payment_cents: number;
  due_day: number | null;
  status: "ACTIVE" | "SETTLED";
  settled_at: string | null;
}

export interface DebtPayment extends Timestamps {
  id: string;
  debt_id: string;
  date: string;
  amount_cents: number;
  balance_after: number | null;
}

export interface Investment extends Timestamps {
  id: string;
  name: string;
  asset_class: "EQUITY" | "ETF" | "BOND" | "PROPERTY" | "CASH" | "BUSINESS" | "CRYPTO" | "OTHER";
  objective: string | null;
  opened_at: string;
  cost_basis_cents: number;
  current_cents: number;
  notes: string | null;
}

export interface InvestmentContribution extends Timestamps {
  id: string;
  investment_id: string;
  date: string;
  amount_cents: number;
  note: string | null;
}

export interface Asset extends Timestamps {
  id: string;
  name: string;
  kind: "PROPERTY" | "VEHICLE" | "BUSINESS_EQUITY" | "OTHER";
  value_cents: number;
}

export interface NetWorthSnapshot extends Timestamps {
  id: string;
  date: string;
  cash_cents: number;
  investments_cents: number;
  property_cents: number;
  business_cents: number;
  other_assets_cents: number;
  liabilities_cents: number;
  net_worth_cents: number;
}

/* ---------------------------------------------------------- CHARACTER */

export interface Habit extends Timestamps {
  id: string;
  name: string;
  pillar: Pillar;
  description: string | null;
  target_per_week: number;
  sort_order: number;
  active: number;
}

export interface HabitLog extends Timestamps {
  id: string;
  habit_id: string;
  date: string;
  done: number;
  note: string | null;
}

export interface Promise_ extends Timestamps {
  id: string;
  text: string;
  pillar: Pillar;
  date: string;
  due_time: string | null;
  status: "OPEN" | "KEPT" | "BROKEN" | "MODIFIED";
  reason: string | null;
  resolved_at: string | null;
}

export type DecisionLevel = "GREEN" | "YELLOW" | "RED";

export interface Decision extends Timestamps {
  id: string;
  title: string;
  problem: string | null;
  objective: string | null;
  level: DecisionLevel;
  pillar: Pillar;
  reversibility: "REVERSIBLE" | "COSTLY" | "IRREVERSIBLE";
  emotional_state: string | null;
  emotional_intensity: number | null;
  amount_cents: number | null;
  cooling_until: string | null;
  decided_at: string | null;
  decision: string | null;
  status: "COOLING" | "READY" | "DECIDED" | "ABANDONED";
  outcome: string | null;
  outcome_rating: number | null;
  outcome_recorded_at: string | null;
  lesson: string | null;
}

export interface DecisionOption extends Timestamps {
  id: string;
  decision_id: string;
  label: string;
  upside: string | null;
  downside: string | null;
  probability: number | null;
  chosen: number;
  sort_order: number;
}

/* ----------------------------------------------------------- LEARNING */

export interface Skill extends Timestamps {
  id: string;
  name: string;
  why: string | null;
  current_level: number;
  target_level: number;
  evidence: string | null;
  active: number;
}

export interface LearningItem extends Timestamps {
  id: string;
  skill_id: string | null;
  title: string;
  source: string | null;
  kind: "STUDY" | "PRACTICE" | "APPLICATION" | "TEST";
  date: string;
  minutes: number;
  what_i_learned: string | null;
  why_it_matters: string | null;
  how_i_will_apply: string | null;
  result: string | null;
  applied: number;
  applied_at: string | null;
  revenue_cents: number | null;
}

/* -------------------------------------------------------------- IDEAS */

export interface Idea extends Timestamps {
  id: string;
  title: string;
  summary: string | null;
  stage: "CAPTURE" | "RESEARCH" | "VALIDATE" | "SCORED" | "PARKED" | "ACTIVE" | "KILLED";
  score_potential: number | null;
  score_difficulty: number | null;
  score_cost: number | null;
  score_speed: number | null;
  score_fit: number | null;
  score_advantage: number | null;
  research_notes: string | null;
  validation_notes: string | null;
  promoted_project_id: string | null;
  activated_at: string | null;
}

/* --------------------------------------------------- SCORES + REVIEWS */

export interface DailyScore extends Timestamps {
  id: string;
  date: string;
  body: number | null;
  business: number | null;
  finance: number | null;
  character: number | null;
  learning: number | null;
  overall: number | null;
  detail_json: string | null;
  computed_at: string;
}

export type ReviewKind = "DAILY" | "WEEKLY" | "MONTHLY" | "NINETY_DAY";

export interface Review extends Timestamps {
  id: string;
  kind: ReviewKind;
  period_start: string;
  period_end: string;
  status: "DRAFT" | "COMPLETE";
  answers_json: string;
  snapshot_json: string | null;
  completed_at: string | null;
}

export interface Note extends Timestamps {
  id: string;
  title: string | null;
  body: string;
  pillar: string | null;
  entity_type: string | null;
  entity_id: string | null;
}

export interface Notification extends Timestamps {
  id: string;
  key: string;
  severity: "INFO" | "ATTENTION" | "CRITICAL" | "WIN";
  pillar: string | null;
  title: string;
  body: string | null;
  href: string | null;
  read_at: string | null;
  dismissed_at: string | null;
}
