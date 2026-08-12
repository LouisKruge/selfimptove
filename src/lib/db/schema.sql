-- COMMAND — Personal Operating System
-- Relational schema. Single-user, private, local-first (SQLite).
-- Conventions:
--   * ids            TEXT (uuid)
--   * timestamps     TEXT ISO-8601 UTC  (created_at / updated_at on every entity)
--   * dates          TEXT 'YYYY-MM-DD'  (local calendar day)
--   * money          INTEGER cents (ZAR)  — never floats
--   * booleans       INTEGER 0/1
-- Nothing is fabricated: every derived metric is computed from rows in here.

PRAGMA foreign_keys = ON;

------------------------------------------------------------------------------
-- IDENTITY
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT,
  timezone          TEXT NOT NULL DEFAULT 'Africa/Johannesburg',
  currency          TEXT NOT NULL DEFAULT 'ZAR',
  locale            TEXT NOT NULL DEFAULT 'en-ZA',
  life_vision       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key               TEXT PRIMARY KEY,
  value             TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

------------------------------------------------------------------------------
-- SEASONS  (pillar weighting over a period of focus)
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS seasons (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  objective         TEXT,
  why               TEXT,
  start_date        TEXT NOT NULL,
  end_date          TEXT,
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('PLANNED','ACTIVE','CLOSED')),
  weight_body       INTEGER NOT NULL DEFAULT 25,
  weight_business   INTEGER NOT NULL DEFAULT 30,
  weight_character  INTEGER NOT NULL DEFAULT 25,
  weight_finance    INTEGER NOT NULL DEFAULT 10,
  weight_learning   INTEGER NOT NULL DEFAULT 10,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  CHECK (weight_body + weight_business + weight_character
         + weight_finance + weight_learning = 100)
);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status);

------------------------------------------------------------------------------
-- GOAL ENGINE  (LIFE VISION -> 3Y -> 1Y -> 90D -> MONTH -> WEEK)
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS goals (
  id                TEXT PRIMARY KEY,
  parent_id         TEXT REFERENCES goals(id) ON DELETE SET NULL,
  horizon           TEXT NOT NULL
                      CHECK (horizon IN ('VISION','THREE_YEAR','ONE_YEAR','QUARTER','MONTH','WEEK')),
  pillar            TEXT NOT NULL
                      CHECK (pillar IN ('BODY','BUSINESS','FINANCE','CHARACTER','LEARNING','LIFE')),
  title             TEXT NOT NULL,
  why               TEXT,
  kpi               TEXT,                 -- what is being measured, in words
  unit              TEXT,                 -- 'ZAR','kg','km','%','count','min'
  start_value       REAL,                 -- baseline at goal creation (for progress)
  current_value     REAL,
  target_value      REAL,
  direction         TEXT NOT NULL DEFAULT 'UP'
                      CHECK (direction IN ('UP','DOWN')),
  metric_source     TEXT,                 -- auto-computed feed, see domain/metrics.ts
  deadline          TEXT,
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','ACHIEVED','MISSED','PAUSED','ARCHIVED')),
  next_action       TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_id);
CREATE INDEX IF NOT EXISTS idx_goals_pillar ON goals(pillar, status);
CREATE INDEX IF NOT EXISTS idx_goals_horizon ON goals(horizon, status);

------------------------------------------------------------------------------
-- MISSION ENGINE  (only one PRIMARY may be ACTIVE — enforced by unique index)
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS missions (
  id                TEXT PRIMARY KEY,
  season_id         TEXT REFERENCES seasons(id) ON DELETE SET NULL,
  goal_id           TEXT REFERENCES goals(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  objective         TEXT,
  why               TEXT,
  kind              TEXT NOT NULL DEFAULT 'PRIMARY'
                      CHECK (kind IN ('PRIMARY','SECONDARY')),
  start_date        TEXT NOT NULL,
  end_date          TEXT NOT NULL,
  target_value      REAL,
  current_value     REAL,
  unit              TEXT,
  metric_source     TEXT,
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('PLANNED','ACTIVE','COMPLETE','FAILED','ABANDONED')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  completed_at      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_single_active_primary_mission
  ON missions(kind, status) WHERE kind = 'PRIMARY' AND status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);

CREATE TABLE IF NOT EXISTS milestones (
  id                TEXT PRIMARY KEY,
  mission_id        TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  target_date       TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  weight            INTEGER NOT NULL DEFAULT 1,
  status            TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETE','SKIPPED')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_milestones_mission ON milestones(mission_id, sort_order);

CREATE TABLE IF NOT EXISTS mission_kpis (
  id                TEXT PRIMARY KEY,
  mission_id        TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  unit              TEXT,
  current_value     REAL,
  target_value      REAL,
  metric_source     TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mission_kpis_mission ON mission_kpis(mission_id);

CREATE TABLE IF NOT EXISTS risks (
  id                TEXT PRIMARY KEY,
  mission_id        TEXT REFERENCES missions(id) ON DELETE CASCADE,
  project_id        TEXT,
  title             TEXT NOT NULL,
  detail            TEXT,
  severity          TEXT NOT NULL DEFAULT 'MEDIUM'
                      CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  likelihood        TEXT NOT NULL DEFAULT 'POSSIBLE'
                      CHECK (likelihood IN ('UNLIKELY','POSSIBLE','LIKELY','ALMOST_CERTAIN')),
  mitigation        TEXT,
  status            TEXT NOT NULL DEFAULT 'OPEN'
                      CHECK (status IN ('OPEN','MITIGATED','ACCEPTED','CLOSED')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_risks_mission ON risks(mission_id, status);

------------------------------------------------------------------------------
-- PROJECTS + TASKS
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS projects (
  id                TEXT PRIMARY KEY,
  mission_id        TEXT REFERENCES missions(id) ON DELETE SET NULL,
  goal_id           TEXT REFERENCES goals(id) ON DELETE SET NULL,
  business_id       TEXT,
  pillar            TEXT NOT NULL DEFAULT 'BUSINESS'
                      CHECK (pillar IN ('BODY','BUSINESS','FINANCE','CHARACTER','LEARNING','LIFE')),
  title             TEXT NOT NULL,
  objective         TEXT,
  expected_outcome  TEXT,
  revenue_impact    INTEGER,              -- cents
  cost              INTEGER,              -- cents
  deadline          TEXT,
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('PLANNED','ACTIVE','BLOCKED','COMPLETE','CANCELLED')),
  next_action       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_mission ON projects(mission_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS tasks (
  id                TEXT PRIMARY KEY,
  project_id        TEXT REFERENCES projects(id) ON DELETE SET NULL,
  mission_id        TEXT REFERENCES missions(id) ON DELETE SET NULL,
  goal_id           TEXT REFERENCES goals(id) ON DELETE SET NULL,
  pillar            TEXT NOT NULL DEFAULT 'BUSINESS'
                      CHECK (pillar IN ('BODY','BUSINESS','FINANCE','CHARACTER','LEARNING','LIFE')),
  title             TEXT NOT NULL,
  description       TEXT,
  expected_outcome  TEXT,
  priority          TEXT NOT NULL DEFAULT 'SUPPORT'
                      CHECK (priority IN ('MUST_WIN','SUPPORT','BACKLOG')),
  scheduled_date    TEXT,                 -- the day it is meant to be executed
  deadline          TEXT,
  estimated_minutes INTEGER,
  actual_minutes    INTEGER,
  status            TEXT NOT NULL DEFAULT 'TODO'
                      CHECK (status IN ('TODO','IN_PROGRESS','BLOCKED','COMPLETE','CANCELLED')),
  blocked_reason    TEXT,
  delegated_to      TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_day ON tasks(scheduled_date, status);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_mission ON tasks(mission_id);

------------------------------------------------------------------------------
-- BODY :: EXERCISE CATALOG + WORKOUT LIBRARY
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS exercises (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  category          TEXT NOT NULL DEFAULT 'STRENGTH'
                      CHECK (category IN ('STRENGTH','CONDITIONING','RUN','HYROX','MOBILITY')),
  modality          TEXT NOT NULL DEFAULT 'WEIGHT_REPS'
                      CHECK (modality IN ('WEIGHT_REPS','BODYWEIGHT_REPS','WEIGHTED_BODYWEIGHT',
                                          'TIME','DISTANCE_TIME','WEIGHT_DISTANCE_TIME','REPS_TIME')),
  muscle_group      TEXT,                 -- CHEST/BACK/LEGS/SHOULDERS/ARMS/CORE/FULL/ENGINE
  is_compound       INTEGER NOT NULL DEFAULT 0,
  default_rest_sec  INTEGER NOT NULL DEFAULT 90,
  progression_rule  TEXT NOT NULL DEFAULT 'DOUBLE_PROGRESSION'
                      CHECK (progression_rule IN ('DOUBLE_PROGRESSION','LINEAR','NONE')),
  increment_kg      REAL NOT NULL DEFAULT 2.5,
  notes             TEXT,
  archived          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category, archived);

-- Reusable workout templates: PUSH A, ZONE 2, HYROX SIMULATION, ...
CREATE TABLE IF NOT EXISTS workouts (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'STRENGTH'
                      CHECK (type IN ('STRENGTH','RUN','CONDITIONING','HYROX','RECOVERY','MOBILITY')),
  focus             TEXT,
  description       TEXT,
  est_minutes       INTEGER,
  archived          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workouts_type ON workouts(type, archived);

-- Prescriptions inside a template
CREATE TABLE IF NOT EXISTS workout_exercises (
  id                TEXT PRIMARY KEY,
  workout_id        TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id       TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  target_sets       INTEGER NOT NULL DEFAULT 3,
  rep_min           INTEGER,
  rep_max           INTEGER,
  target_weight_kg  REAL,
  target_seconds    INTEGER,
  target_distance_m REAL,
  target_pace_sec   INTEGER,              -- seconds per km
  target_rpe        REAL,
  target_rir_min    INTEGER,
  target_rir_max    INTEGER,
  rest_sec          INTEGER,
  tempo             TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout
  ON workout_exercises(workout_id, sort_order);

------------------------------------------------------------------------------
-- BODY :: SESSIONS (planned / executed instances) + SETS
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS workout_sessions (
  id                TEXT PRIMARY KEY,
  workout_id        TEXT REFERENCES workouts(id) ON DELETE SET NULL,
  date              TEXT NOT NULL,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'STRENGTH'
                      CHECK (type IN ('STRENGTH','RUN','CONDITIONING','HYROX','RECOVERY','MOBILITY')),
  status            TEXT NOT NULL DEFAULT 'PLANNED'
                      CHECK (status IN ('PLANNED','IN_PROGRESS','COMPLETED','MODIFIED','SKIPPED','RECOVERY')),
  started_at        TEXT,
  ended_at          TEXT,
  duration_min      INTEGER,
  session_rpe       REAL,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  completed_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON workout_sessions(date, status);

-- Snapshot of the prescription for this specific session (targets are editable per session)
CREATE TABLE IF NOT EXISTS session_exercises (
  id                TEXT PRIMARY KEY,
  session_id        TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id       TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  target_sets       INTEGER NOT NULL DEFAULT 3,
  rep_min           INTEGER,
  rep_max           INTEGER,
  target_weight_kg  REAL,
  target_seconds    INTEGER,
  target_distance_m REAL,
  target_pace_sec   INTEGER,
  target_rpe        REAL,
  target_rir_min    INTEGER,
  target_rir_max    INTEGER,
  rest_sec          INTEGER,
  tempo             TEXT,
  notes             TEXT,
  target_source     TEXT NOT NULL DEFAULT 'TEMPLATE'
                      CHECK (target_source IN ('TEMPLATE','PROGRESSION','MANUAL','NONE')),
  target_rationale  TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session
  ON session_exercises(session_id, sort_order);

CREATE TABLE IF NOT EXISTS workout_sets (
  id                  TEXT PRIMARY KEY,
  session_exercise_id TEXT NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  session_id          TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id         TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  date                TEXT NOT NULL,
  set_index           INTEGER NOT NULL,
  weight_kg           REAL,
  reps                INTEGER,
  seconds             INTEGER,
  distance_m          REAL,
  rpe                 REAL,
  rir                 INTEGER,
  is_warmup           INTEGER NOT NULL DEFAULT 0,
  notes               TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  CHECK (reps IS NULL OR reps >= 0),
  CHECK (weight_kg IS NULL OR weight_kg >= 0),
  CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  CHECK (rir IS NULL OR (rir >= 0 AND rir <= 10))
);
CREATE INDEX IF NOT EXISTS idx_sets_exercise_date ON workout_sets(exercise_id, date);
CREATE INDEX IF NOT EXISTS idx_sets_session ON workout_sets(session_id);
CREATE INDEX IF NOT EXISTS idx_sets_sx ON workout_sets(session_exercise_id, set_index);

------------------------------------------------------------------------------
-- BODY :: RUNNING
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS runs (
  id                TEXT PRIMARY KEY,
  session_id        TEXT REFERENCES workout_sessions(id) ON DELETE SET NULL,
  date              TEXT NOT NULL,
  type              TEXT NOT NULL DEFAULT 'EASY'
                      CHECK (type IN ('EASY','ZONE2','TEMPO','INTERVALS','LONG','RACE','RECOVERY')),
  distance_m        REAL,
  duration_sec      INTEGER,
  avg_pace_sec      INTEGER,              -- sec/km, derived on write
  avg_hr            INTEGER,
  max_hr            INTEGER,
  elevation_m       REAL,
  rpe               REAL,
  target_distance_m REAL,
  target_pace_sec   INTEGER,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  CHECK (distance_m IS NULL OR distance_m >= 0),
  CHECK (duration_sec IS NULL OR duration_sec >= 0)
);
CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date);

CREATE TABLE IF NOT EXISTS run_intervals (
  id                TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  interval_index    INTEGER NOT NULL,
  distance_m        REAL,
  duration_sec      INTEGER,
  pace_sec          INTEGER,
  target_pace_sec   INTEGER,
  recovery_sec      INTEGER,
  avg_hr            INTEGER,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_run_intervals_run ON run_intervals(run_id, interval_index);

------------------------------------------------------------------------------
-- BODY :: HYROX
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS hyrox_sessions (
  id                TEXT PRIMARY KEY,
  session_id        TEXT REFERENCES workout_sessions(id) ON DELETE SET NULL,
  date              TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'STATION_WORK'
                      CHECK (kind IN ('STATION_WORK','PARTIAL_SIM','FULL_SIM','RACE')),
  division          TEXT NOT NULL DEFAULT 'OPEN'
                      CHECK (division IN ('OPEN','PRO','DOUBLES')),
  total_sec         INTEGER,
  run_total_sec     INTEGER,
  station_total_sec INTEGER,
  transition_sec    INTEGER,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hyrox_date ON hyrox_sessions(date);

CREATE TABLE IF NOT EXISTS hyrox_stations (
  id                TEXT PRIMARY KEY,
  hyrox_session_id  TEXT NOT NULL REFERENCES hyrox_sessions(id) ON DELETE CASCADE,
  station           TEXT NOT NULL
                      CHECK (station IN ('RUN','SKIERG','SLED_PUSH','SLED_PULL','BURPEE_BROAD_JUMP',
                                         'ROW','FARMERS_CARRY','SANDBAG_LUNGES','WALL_BALLS')),
  sequence          INTEGER NOT NULL,
  duration_sec      INTEGER,
  distance_m        REAL,
  weight_kg         REAL,
  reps              INTEGER,
  pace_sec          INTEGER,
  transition_sec    INTEGER,
  rpe               REAL,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hyrox_stations_session
  ON hyrox_stations(hyrox_session_id, sequence);
CREATE INDEX IF NOT EXISTS idx_hyrox_stations_station ON hyrox_stations(station);

------------------------------------------------------------------------------
-- BODY :: NUTRITION
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nutrition_targets (
  id                TEXT PRIMARY KEY,
  effective_from    TEXT NOT NULL,
  goal              TEXT NOT NULL DEFAULT 'HYBRID'
                      CHECK (goal IN ('MUSCLE_GAIN','MAINTENANCE','FAT_LOSS','HYBRID')),
  calories          INTEGER NOT NULL,
  protein_g         INTEGER NOT NULL,
  carbs_g           INTEGER NOT NULL,
  fat_g             INTEGER NOT NULL,
  fiber_g           INTEGER,
  water_ml          INTEGER,
  weight_trend_kg_per_week REAL,          -- intended trend, e.g. +0.25
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nutrition_targets_from ON nutrition_targets(effective_from);

CREATE TABLE IF NOT EXISTS nutrition_logs (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL UNIQUE,
  calories          INTEGER NOT NULL DEFAULT 0,
  protein_g         REAL NOT NULL DEFAULT 0,
  carbs_g           REAL NOT NULL DEFAULT 0,
  fat_g             REAL NOT NULL DEFAULT 0,
  fiber_g           REAL NOT NULL DEFAULT 0,
  water_ml          INTEGER NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_date ON nutrition_logs(date);

CREATE TABLE IF NOT EXISTS meals (
  id                TEXT PRIMARY KEY,
  nutrition_log_id  TEXT NOT NULL REFERENCES nutrition_logs(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,
  name              TEXT NOT NULL,
  slot              TEXT NOT NULL DEFAULT 'MEAL'
                      CHECK (slot IN ('BREAKFAST','LUNCH','DINNER','SNACK','MEAL','SHAKE')),
  calories          INTEGER NOT NULL DEFAULT 0,
  protein_g         REAL NOT NULL DEFAULT 0,
  carbs_g           REAL NOT NULL DEFAULT 0,
  fat_g             REAL NOT NULL DEFAULT 0,
  fiber_g           REAL NOT NULL DEFAULT 0,
  logged_at         TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  CHECK (calories >= 0 AND protein_g >= 0 AND carbs_g >= 0 AND fat_g >= 0)
);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

-- Reusable foods so logging is a two-tap operation
CREATE TABLE IF NOT EXISTS meal_presets (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  slot              TEXT NOT NULL DEFAULT 'MEAL',
  calories          INTEGER NOT NULL DEFAULT 0,
  protein_g         REAL NOT NULL DEFAULT 0,
  carbs_g           REAL NOT NULL DEFAULT 0,
  fat_g             REAL NOT NULL DEFAULT 0,
  fiber_g           REAL NOT NULL DEFAULT 0,
  use_count         INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

------------------------------------------------------------------------------
-- BODY :: COMPOSITION + RECOVERY
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS body_measurements (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL UNIQUE,
  weight_kg         REAL,
  waist_cm          REAL,
  chest_cm          REAL,
  arm_cm            REAL,
  shoulder_cm       REAL,
  thigh_cm          REAL,
  hip_cm            REAL,
  neck_cm           REAL,
  body_fat_pct      REAL,
  photo_note        TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  CHECK (weight_kg IS NULL OR (weight_kg > 20 AND weight_kg < 400)),
  CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 1 AND body_fat_pct <= 70))
);
CREATE INDEX IF NOT EXISTS idx_measurements_date ON body_measurements(date);

CREATE TABLE IF NOT EXISTS recovery_logs (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL UNIQUE,
  sleep_hours       REAL,
  sleep_quality     INTEGER CHECK (sleep_quality IS NULL OR (sleep_quality BETWEEN 1 AND 5)),
  energy            INTEGER CHECK (energy IS NULL OR (energy BETWEEN 1 AND 5)),
  stress            INTEGER CHECK (stress IS NULL OR (stress BETWEEN 1 AND 5)),
  soreness          INTEGER CHECK (soreness IS NULL OR (soreness BETWEEN 1 AND 5)),
  motivation        INTEGER CHECK (motivation IS NULL OR (motivation BETWEEN 1 AND 5)),
  resting_hr        INTEGER,
  is_rest_day       INTEGER NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recovery_date ON recovery_logs(date);

------------------------------------------------------------------------------
-- BODY :: PERSONAL RECORDS
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS personal_records (
  id                TEXT PRIMARY KEY,
  domain            TEXT NOT NULL
                      CHECK (domain IN ('STRENGTH','RUN','HYROX')),
  exercise_id       TEXT REFERENCES exercises(id) ON DELETE CASCADE,
  station           TEXT,
  run_distance_m    REAL,
  kind              TEXT NOT NULL
                      CHECK (kind IN ('WEIGHT','REPS','VOLUME','E1RM','DISTANCE','PACE','TIME')),
  value             REAL NOT NULL,
  display           TEXT NOT NULL,
  previous_value    REAL,
  date              TEXT NOT NULL,
  source_id         TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pr_lookup ON personal_records(domain, exercise_id, kind, date);
CREATE INDEX IF NOT EXISTS idx_pr_date ON personal_records(date);

------------------------------------------------------------------------------
-- BUSINESS
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS businesses (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  model             TEXT,
  stage             TEXT NOT NULL DEFAULT 'BUILD'
                      CHECK (stage IN ('IDEA','VALIDATE','BUILD','LAUNCH','SCALE','SOLD','CLOSED')),
  target_customer   TEXT,
  offer             TEXT,
  avg_deal_cents    INTEGER,
  mrr_target_cents  INTEGER,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id                TEXT PRIMARY KEY,
  business_id       TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  company           TEXT NOT NULL,
  contact_name      TEXT,
  contact_email     TEXT,
  contact_phone     TEXT,
  source            TEXT,
  stage             TEXT NOT NULL DEFAULT 'PROSPECT'
                      CHECK (stage IN ('PROSPECT','CONTACTED','RESPONDED','MEETING',
                                       'PROPOSAL','CUSTOMER','RETAINED','LOST')),
  potential_cents   INTEGER NOT NULL DEFAULT 0,
  probability       INTEGER NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  last_contact_date TEXT,
  next_action       TEXT,
  next_action_date  TEXT,
  lost_reason       TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  closed_at         TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_next ON leads(next_action_date);

-- Immutable stage history — the ONLY source for conversion rates.
CREATE TABLE IF NOT EXISTS lead_stage_events (
  id                TEXT PRIMARY KEY,
  lead_id           TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_stage        TEXT,
  to_stage          TEXT NOT NULL,
  date              TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_stage_events(lead_id, date);
CREATE INDEX IF NOT EXISTS idx_lead_events_stage ON lead_stage_events(to_stage, date);

CREATE TABLE IF NOT EXISTS customers (
  id                TEXT PRIMARY KEY,
  business_id       TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  lead_id           TEXT REFERENCES leads(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  contact_name      TEXT,
  contact_email     TEXT,
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','PAUSED','CHURNED')),
  mrr_cents         INTEGER NOT NULL DEFAULT 0,
  started_at        TEXT NOT NULL,
  churned_at        TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

CREATE TABLE IF NOT EXISTS revenue_entries (
  id                TEXT PRIMARY KEY,
  business_id       TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  customer_id       TEXT REFERENCES customers(id) ON DELETE SET NULL,
  date              TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'ONE_OFF'
                      CHECK (kind IN ('ONE_OFF','RECURRING')),
  description       TEXT,
  received          INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  CHECK (amount_cents >= 0)
);
CREATE INDEX IF NOT EXISTS idx_revenue_date ON revenue_entries(date);

CREATE TABLE IF NOT EXISTS business_expenses (
  id                TEXT PRIMARY KEY,
  business_id       TEXT REFERENCES businesses(id) ON DELETE SET NULL,
  date              TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  category          TEXT,
  description       TEXT,
  recurring         INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bexp_date ON business_expenses(date);

CREATE TABLE IF NOT EXISTS business_kpis (
  id                TEXT PRIMARY KEY,
  business_id       TEXT REFERENCES businesses(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  unit              TEXT,
  target_value      REAL,
  metric_source     TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

------------------------------------------------------------------------------
-- FINANCE
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounts (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'CASH'
                      CHECK (kind IN ('CASH','SAVINGS','CREDIT','INVESTMENT')),
  balance_cents     INTEGER NOT NULL DEFAULT 0,
  include_in_cash   INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_expenses (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  category          TEXT NOT NULL DEFAULT 'OTHER',
  description       TEXT,
  essential         INTEGER NOT NULL DEFAULT 1,
  recurring         INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pexp_date ON personal_expenses(date);

CREATE TABLE IF NOT EXISTS income_entries (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  source            TEXT NOT NULL DEFAULT 'BUSINESS',
  description       TEXT,
  recurring         INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_income_date ON income_entries(date);

-- Known future money movements — the basis of the cash-flow forecast.
CREATE TABLE IF NOT EXISTS scheduled_cash_items (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  direction         TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  cadence           TEXT NOT NULL DEFAULT 'MONTHLY'
                      CHECK (cadence IN ('ONCE','WEEKLY','MONTHLY')),
  day_of_month      INTEGER CHECK (day_of_month IS NULL OR (day_of_month BETWEEN 1 AND 31)),
  day_of_week       INTEGER CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 6)),
  next_date         TEXT,
  category          TEXT,
  debt_id           TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sched_active ON scheduled_cash_items(active, next_date);

CREATE TABLE IF NOT EXISTS debts (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'LOAN'
                      CHECK (kind IN ('LOAN','CREDIT_CARD','VEHICLE','BOND','FAMILY','OTHER')),
  original_cents    INTEGER NOT NULL DEFAULT 0,
  balance_cents     INTEGER NOT NULL DEFAULT 0,
  interest_rate     REAL,
  min_payment_cents INTEGER NOT NULL DEFAULT 0,
  due_day           INTEGER CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31)),
  status            TEXT NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','SETTLED')),
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  settled_at        TEXT
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id                TEXT PRIMARY KEY,
  debt_id           TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  balance_after     INTEGER,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_debt_payments ON debt_payments(debt_id, date);

CREATE TABLE IF NOT EXISTS investments (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  asset_class       TEXT NOT NULL DEFAULT 'EQUITY'
                      CHECK (asset_class IN ('EQUITY','ETF','BOND','PROPERTY','CASH','BUSINESS','CRYPTO','OTHER')),
  objective         TEXT,
  opened_at         TEXT NOT NULL,
  cost_basis_cents  INTEGER NOT NULL DEFAULT 0,
  current_cents     INTEGER NOT NULL DEFAULT 0,
  notes             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS investment_contributions (
  id                TEXT PRIMARY KEY,
  investment_id     TEXT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  note              TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contrib_inv ON investment_contributions(investment_id, date);

CREATE TABLE IF NOT EXISTS assets (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'OTHER'
                      CHECK (kind IN ('PROPERTY','VEHICLE','BUSINESS_EQUITY','OTHER')),
  value_cents       INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL UNIQUE,
  cash_cents        INTEGER NOT NULL DEFAULT 0,
  investments_cents INTEGER NOT NULL DEFAULT 0,
  property_cents    INTEGER NOT NULL DEFAULT 0,
  business_cents    INTEGER NOT NULL DEFAULT 0,
  other_assets_cents INTEGER NOT NULL DEFAULT 0,
  liabilities_cents INTEGER NOT NULL DEFAULT 0,
  net_worth_cents   INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nw_date ON net_worth_snapshots(date);

------------------------------------------------------------------------------
-- CHARACTER
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS habits (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  pillar            TEXT NOT NULL DEFAULT 'CHARACTER'
                      CHECK (pillar IN ('BODY','BUSINESS','FINANCE','CHARACTER','LEARNING','LIFE')),
  description       TEXT,
  target_per_week   INTEGER NOT NULL DEFAULT 7 CHECK (target_per_week BETWEEN 1 AND 7),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id                TEXT PRIMARY KEY,
  habit_id          TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date              TEXT NOT NULL,
  done              INTEGER NOT NULL DEFAULT 1,
  note              TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (habit_id, date)
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);

CREATE TABLE IF NOT EXISTS promises (
  id                TEXT PRIMARY KEY,
  text              TEXT NOT NULL,
  pillar            TEXT NOT NULL DEFAULT 'CHARACTER'
                      CHECK (pillar IN ('BODY','BUSINESS','FINANCE','CHARACTER','LEARNING','LIFE')),
  date              TEXT NOT NULL,
  due_time          TEXT,
  status            TEXT NOT NULL DEFAULT 'OPEN'
                      CHECK (status IN ('OPEN','KEPT','BROKEN','MODIFIED')),
  reason            TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  resolved_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_promises_date ON promises(date, status);

CREATE TABLE IF NOT EXISTS decisions (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  problem           TEXT,
  objective         TEXT,
  level             TEXT NOT NULL DEFAULT 'GREEN'
                      CHECK (level IN ('GREEN','YELLOW','RED')),
  pillar            TEXT NOT NULL DEFAULT 'LIFE'
                      CHECK (pillar IN ('BODY','BUSINESS','FINANCE','CHARACTER','LEARNING','LIFE')),
  reversibility     TEXT NOT NULL DEFAULT 'REVERSIBLE'
                      CHECK (reversibility IN ('REVERSIBLE','COSTLY','IRREVERSIBLE')),
  emotional_state   TEXT,
  emotional_intensity INTEGER CHECK (emotional_intensity IS NULL OR (emotional_intensity BETWEEN 1 AND 5)),
  amount_cents      INTEGER,
  cooling_until     TEXT,                 -- ISO timestamp; firewall release time
  decided_at        TEXT,
  decision          TEXT,
  status            TEXT NOT NULL DEFAULT 'COOLING'
                      CHECK (status IN ('COOLING','READY','DECIDED','ABANDONED')),
  outcome           TEXT,
  outcome_rating    INTEGER CHECK (outcome_rating IS NULL OR (outcome_rating BETWEEN 1 AND 5)),
  outcome_recorded_at TEXT,
  lesson            TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status, level);

CREATE TABLE IF NOT EXISTS decision_options (
  id                TEXT PRIMARY KEY,
  decision_id       TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  upside            TEXT,
  downside          TEXT,
  probability       INTEGER CHECK (probability IS NULL OR (probability BETWEEN 0 AND 100)),
  chosen            INTEGER NOT NULL DEFAULT 0,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_decision_options ON decision_options(decision_id, sort_order);

------------------------------------------------------------------------------
-- LEARNING
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS skills (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  why               TEXT,
  current_level     INTEGER NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 0 AND 10),
  target_level      INTEGER NOT NULL DEFAULT 8 CHECK (target_level BETWEEN 0 AND 10),
  evidence          TEXT,
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_items (
  id                TEXT PRIMARY KEY,
  skill_id          TEXT REFERENCES skills(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  source            TEXT,
  kind              TEXT NOT NULL DEFAULT 'STUDY'
                      CHECK (kind IN ('STUDY','PRACTICE','APPLICATION','TEST')),
  date              TEXT NOT NULL,
  minutes           INTEGER NOT NULL DEFAULT 0 CHECK (minutes >= 0),
  what_i_learned    TEXT,
  why_it_matters    TEXT,
  how_i_will_apply  TEXT,
  result            TEXT,
  applied           INTEGER NOT NULL DEFAULT 0,
  applied_at        TEXT,
  revenue_cents     INTEGER,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learning_date ON learning_items(date);
CREATE INDEX IF NOT EXISTS idx_learning_skill ON learning_items(skill_id);

------------------------------------------------------------------------------
-- IDEA VAULT
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ideas (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  summary           TEXT,
  stage             TEXT NOT NULL DEFAULT 'CAPTURE'
                      CHECK (stage IN ('CAPTURE','RESEARCH','VALIDATE','SCORED','PARKED','ACTIVE','KILLED')),
  score_potential   INTEGER CHECK (score_potential IS NULL OR (score_potential BETWEEN 1 AND 10)),
  score_difficulty  INTEGER CHECK (score_difficulty IS NULL OR (score_difficulty BETWEEN 1 AND 10)),
  score_cost        INTEGER CHECK (score_cost IS NULL OR (score_cost BETWEEN 1 AND 10)),
  score_speed       INTEGER CHECK (score_speed IS NULL OR (score_speed BETWEEN 1 AND 10)),
  score_fit         INTEGER CHECK (score_fit IS NULL OR (score_fit BETWEEN 1 AND 10)),
  score_advantage   INTEGER CHECK (score_advantage IS NULL OR (score_advantage BETWEEN 1 AND 10)),
  research_notes    TEXT,
  validation_notes  TEXT,
  promoted_project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  activated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_ideas_stage ON ideas(stage);

------------------------------------------------------------------------------
-- SCORES + REVIEWS
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS daily_scores (
  id                TEXT PRIMARY KEY,
  date              TEXT NOT NULL UNIQUE,
  body              REAL,
  business          REAL,
  finance           REAL,
  character         REAL,
  learning          REAL,
  overall           REAL,
  detail_json       TEXT,                 -- component breakdown, for explainability
  computed_at       TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_scores_date ON daily_scores(date);

CREATE TABLE IF NOT EXISTS reviews (
  id                TEXT PRIMARY KEY,
  kind              TEXT NOT NULL CHECK (kind IN ('DAILY','WEEKLY','MONTHLY','NINETY_DAY')),
  period_start      TEXT NOT NULL,
  period_end        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','COMPLETE')),
  answers_json      TEXT NOT NULL DEFAULT '{}',
  snapshot_json     TEXT,                 -- metrics frozen at completion time
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  completed_at      TEXT,
  UNIQUE (kind, period_start)
);
CREATE INDEX IF NOT EXISTS idx_reviews_kind ON reviews(kind, period_start);

------------------------------------------------------------------------------
-- NOTES + NOTIFICATIONS
------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notes (
  id                TEXT PRIMARY KEY,
  title             TEXT,
  body              TEXT NOT NULL,
  pillar            TEXT,
  entity_type       TEXT,
  entity_id         TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_entity ON notes(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS notifications (
  id                TEXT PRIMARY KEY,
  key               TEXT NOT NULL,        -- dedupe key, e.g. 'weekly-review:2026-W33'
  severity          TEXT NOT NULL DEFAULT 'INFO'
                      CHECK (severity IN ('INFO','ATTENTION','CRITICAL','WIN')),
  pillar            TEXT,
  title             TEXT NOT NULL,
  body              TEXT,
  href              TEXT,
  read_at           TEXT,
  dismissed_at      TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (key)
);
CREATE INDEX IF NOT EXISTS idx_notifications_open
  ON notifications(dismissed_at, created_at);
