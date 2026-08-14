/**
 * Stefan's COMMAND configuration.
 *
 * This is the operator's own system — goals, missions, training week, nutrition
 * targets, business roadmap, financial framework, habits, idea vault and review
 * cadence — expressed as data so it can be applied to whichever database
 * COMMAND is pointed at.
 *
 * THE RULE THAT GOVERNS THIS FILE
 *
 * Everything here is a target, a system or a structure. Nothing here is a
 * measurement. Strength numbers, HYROX times, body measurements, cash balances,
 * debt balances, investment holdings, revenue and customer counts are all left
 * unset, because they have not been recorded. They stay NULL so the interface
 * reports them honestly as "not recorded" rather than as zero — a zero would be
 * a claim about reality that nobody has made.
 *
 * The three figures that ARE established, and are therefore recorded:
 *   · bodyweight 81 kg
 *   · height 178 cm
 *   · 5K benchmark 37:00
 */

/* ------------------------------------------------------------------ profile */

export const PROFILE = {
  name: "Stefan",
  timezone: "Africa/Johannesburg",
  currency: "ZAR",
  locale: "en-ZA",
  heightCm: 178,
  bodyweightKg: 81,
  northStar:
    "Build a strong, capable body, a high-income business, financial independence, exceptional discipline and freedom to spend time with the people who matter.",
};

/** 5K benchmark in seconds. 37:00. The only running figure that exists. */
export const FIVE_K_SECONDS = 37 * 60;

export const SETTINGS: Array<[string, string]> = [
  ["sleep_target_hours", "7.5"],
  ["savings_rate_target", "0.2"],
  ["learning_days_target", "5"],
  ["learning_minutes_target", "300"],
  ["major_spend_cents", "500000"],
  ["streak_threshold", "60"],
  ["week_starts_on", "MONDAY"],
  ["units", "METRIC"],
  ["country", "South Africa"],
  ["height_cm", "178"],
  ["promise_rate_target", "90"],
  ["habit_rate_target", "85"],
  ["training_adherence_target", "85"],
  ["must_win_rate_target", "85"],
  ["review_rate_target", "100"],
];

/* -------------------------------------------------------------------- season */

export const SEASON = {
  name: "FOUNDATION",
  objective:
    "Build the person, systems, body, business and financial structure capable of long-term compounding.",
  why: "Everything compounds off a foundation or collapses without one.",
  weights: { body: 25, business: 30, character: 25, finance: 10, learning: 10 },
};

/* --------------------------------------------------------------------- goals */

interface GoalSeed {
  key: string;
  parent?: string;
  horizon: "VISION" | "THREE_YEAR" | "ONE_YEAR";
  pillar: "BODY" | "BUSINESS" | "FINANCE" | "CHARACTER" | "LEARNING" | "LIFE";
  title: string;
  why?: string;
  kpi?: string;
  unit?: string;
  start?: number;
  current?: number;
  target?: number;
  direction?: "UP" | "DOWN";
  nextAction?: string;
}

const NOT_RECORDED = "STATUS: NOT RECORDED — record the baseline before this can be tracked.";

export const GOALS: GoalSeed[] = [
  {
    key: "north-star",
    horizon: "VISION",
    pillar: "LIFE",
    title: PROFILE.northStar,
    why: "Every other goal in this system exists to serve this one.",
  },

  /* ------------------------------------------------------------ long term */
  {
    key: "body-long",
    parent: "north-star",
    horizon: "THREE_YEAR",
    pillar: "BODY",
    title: "Become a strong, muscular, lean hybrid athlete",
    why: "Capability is the platform everything else is executed from.",
    nextAction: "Run the strength and HYROX baseline tests.",
  },
  {
    key: "business-long",
    parent: "north-star",
    horizon: "THREE_YEAR",
    pillar: "BUSINESS",
    title: "Reach R150,000+ per month",
    why: "Income at this level converts effort into optionality and time.",
    kpi: "Monthly business income",
    unit: "ZAR",
    target: 150000,
    nextAction: "Find one valuable problem and build one scalable solution around it.",
  },
  {
    key: "finance-long",
    parent: "north-star",
    horizon: "THREE_YEAR",
    pillar: "FINANCE",
    title: "Move from financial control toward asset ownership and independence",
    why: "Freedom is bought with owned assets, not with income alone.",
    kpi: "Net worth",
    unit: "ZAR",
    nextAction: NOT_RECORDED,
  },
  {
    key: "character-long",
    parent: "north-star",
    horizon: "THREE_YEAR",
    pillar: "CHARACTER",
    title: "Become someone who consistently does what he says he will do",
    why: "Every other outcome is downstream of this one.",
    kpi: "Discipline score",
    unit: "%",
    target: 90,
  },
  {
    key: "growth-long",
    parent: "north-star",
    horizon: "THREE_YEAR",
    pillar: "LEARNING",
    title: "Develop high-value business, technical, sales and leadership skills",
    why: "Skill is the only input that raises the ceiling on all the others.",
  },
  {
    key: "life-long",
    parent: "north-star",
    horizon: "THREE_YEAR",
    pillar: "LIFE",
    title: "Maintain meaningful time with family while building all of the above",
    why: "A machine built at the cost of the people it was built for has failed.",
  },

  /* -------------------------------------------------------- twelve months */
  {
    key: "body-1y-muscle",
    parent: "body-long",
    horizon: "ONE_YEAR",
    pillar: "BODY",
    title: "Build muscle and increase strength on the main lifts",
    kpi: "Estimated 1RM across bench, squat, RDL, press, row",
    nextAction: "Baseline test the six main lifts — STATUS: NOT RECORDED.",
  },
  {
    key: "body-1y-run",
    parent: "body-long",
    horizon: "ONE_YEAR",
    pillar: "BODY",
    title: "Improve 5K from 37:00 toward 30:00",
    why: "The engine is the limiter in every hybrid event.",
    kpi: "5K time",
    unit: "sec",
    start: FIVE_K_SECONDS,
    current: FIVE_K_SECONDS,
    target: 30 * 60,
    direction: "DOWN",
    nextAction: "Wednesday running engine — 6 × 800 m.",
  },
  {
    key: "body-1y-hyrox",
    parent: "body-long",
    horizon: "ONE_YEAR",
    pillar: "BODY",
    title: "Improve HYROX performance across all eight stations",
    kpi: "Total simulation time",
    unit: "sec",
    direction: "DOWN",
    nextAction: "Run the HYROX baseline simulation — STATUS: NOT RECORDED.",
  },
  {
    key: "body-1y-adherence",
    parent: "body-long",
    horizon: "ONE_YEAR",
    pillar: "BODY",
    title: "Maintain 85%+ training adherence",
    kpi: "Sessions completed against sessions planned",
    unit: "%",
    target: 85,
  },

  {
    key: "biz-1y-validate",
    parent: "business-long",
    horizon: "ONE_YEAR",
    pillar: "BUSINESS",
    title: "Build and validate a real business",
    why: "Validation before build. Demand before complexity.",
    nextAction: "Identify the one problem worth solving.",
  },
  {
    key: "biz-1y-customers",
    parent: "business-long",
    horizon: "ONE_YEAR",
    pillar: "BUSINESS",
    title: "Acquire paying customers",
    kpi: "Paying customers",
    unit: "count",
    nextAction: NOT_RECORDED,
  },
  {
    key: "biz-1y-sales",
    parent: "business-long",
    horizon: "ONE_YEAR",
    pillar: "BUSINESS",
    title: "Create repeatable sales",
    kpi: "Close rate from recorded stage history",
    unit: "%",
    nextAction: "Log the funnel daily until conversion rates become real.",
  },
  {
    key: "biz-1y-delivery",
    parent: "business-long",
    horizon: "ONE_YEAR",
    pillar: "BUSINESS",
    title: "Create repeatable delivery",
    kpi: "Retained customers",
    unit: "count",
  },
  {
    key: "biz-1y-systems",
    parent: "business-long",
    horizon: "ONE_YEAR",
    pillar: "BUSINESS",
    title: "Create scalable systems",
    why: "Systemisation is what turns a job into a business.",
  },

  {
    key: "fin-1y-cashflow",
    parent: "finance-long",
    horizon: "ONE_YEAR",
    pillar: "FINANCE",
    title: "Control cash flow — every rand has a purpose",
    kpi: "Monthly surplus",
    unit: "ZAR",
    nextAction: NOT_RECORDED,
  },
  {
    key: "fin-1y-debt",
    parent: "finance-long",
    horizon: "ONE_YEAR",
    pillar: "FINANCE",
    title: "Reduce bad debt, highest interest rate first",
    kpi: "Total debt balance",
    unit: "ZAR",
    direction: "DOWN",
    nextAction: NOT_RECORDED,
  },
  {
    key: "fin-1y-buffer",
    parent: "finance-long",
    horizon: "ONE_YEAR",
    pillar: "FINANCE",
    title: "Build a cash reserve",
    kpi: "Cash buffer",
    unit: "ZAR",
    nextAction: NOT_RECORDED,
  },
  {
    key: "fin-1y-income",
    parent: "finance-long",
    horizon: "ONE_YEAR",
    pillar: "FINANCE",
    title: "Increase income",
    kpi: "Monthly income",
    unit: "ZAR",
    nextAction: NOT_RECORDED,
  },
  {
    key: "fin-1y-invest",
    parent: "finance-long",
    horizon: "ONE_YEAR",
    pillar: "FINANCE",
    title: "Begin or expand investing when financially appropriate",
    why: "Stability first. Investing on top of an unstable base is speculation.",
  },

  {
    key: "char-1y-habits",
    parent: "character-long",
    horizon: "ONE_YEAR",
    pillar: "CHARACTER",
    title: "85%+ habit adherence",
    kpi: "Habit completion",
    unit: "%",
    target: 85,
  },
  {
    key: "char-1y-promises",
    parent: "character-long",
    horizon: "ONE_YEAR",
    pillar: "CHARACTER",
    title: "90%+ promise completion",
    kpi: "Promises kept",
    unit: "%",
    target: 90,
  },
  {
    key: "char-1y-reviews",
    parent: "character-long",
    horizon: "ONE_YEAR",
    pillar: "CHARACTER",
    title: "Weekly review completed every week",
    kpi: "Weekly reviews completed",
    unit: "%",
    target: 100,
  },

  {
    key: "growth-1y",
    parent: "growth-long",
    horizon: "ONE_YEAR",
    pillar: "LEARNING",
    title: "Develop practical skills rather than passive learning",
    why: "The measure is what I can now do that I could not do before.",
    kpi: "Learning items applied",
    unit: "%",
    target: 60,
  },
];

/* ------------------------------------------------------------------ missions */

export const PRIMARY_MISSION = {
  title: "BUILD THE MACHINE",
  objective:
    "Build a functioning, validated, revenue-producing business with a clear target customer, a clear offer, a working product, a lead-generation system, a sales process, first paying customers and a repeatable acquisition process.",
  why: "One working business changes every other number in this system.",
  goalKey: "business-long",
  unit: "ZAR monthly revenue",
  targetValue: 30000,
};

export const MILESTONES = [
  { title: "Market", description: "One market chosen. Not three. Written down and committed to." },
  { title: "Problem", description: "A problem verified in the customer's own words, not assumed." },
  { title: "Offer", description: "A specific offer with a price, a promise and a reason to buy now." },
  { title: "Validation", description: "Real people confirm they want it — ideally with money." },
  { title: "Product", description: "The smallest thing that actually delivers the promise." },
  { title: "Sales", description: "A repeatable process that turns outreach into conversations." },
  { title: "First Customer", description: "One paying customer. The hardest one." },
  { title: "Delivery", description: "The promise kept, repeatably, without heroics." },
  { title: "Retention", description: "A customer who stays and pays again." },
  { title: "Systemisation", description: "Written down so it runs without being remembered." },
];

export const PRIMARY_MISSION_KPIS = [
  { name: "Paying customers", unit: "count", target: 5 },
  { name: "Monthly recurring revenue", unit: "ZAR", target: 30000 },
  { name: "Qualified leads generated", unit: "count", target: 300 },
  { name: "Sales conversations held", unit: "count", target: 65 },
  { name: "Proposals sent", unit: "count", target: 13 },
];

/** The five pillar missions that run alongside the primary. */
export const PILLAR_MISSIONS = [
  {
    title: "MISSION 1 — BODY",
    objective: "Become stronger, more muscular and better conditioned.",
    why: "Capability compounds into every other pillar.",
    goalKey: "body-long",
    kpis: [
      { name: "Training adherence", unit: "%", target: 85 },
      { name: "5K time", unit: "sec", target: 30 * 60, current: FIVE_K_SECONDS },
      { name: "Main lifts baselined", unit: "count", target: 6 },
      { name: "HYROX simulation time", unit: "sec", target: null },
    ],
    nextAction: "Run the strength baseline test.",
  },
  {
    title: "MISSION 2 — BUSINESS",
    objective: "Build a real revenue-producing business.",
    why: "Revenue is the only proof that the problem was worth solving.",
    goalKey: "business-long",
    kpis: [
      { name: "Monthly recurring revenue", unit: "ZAR", target: 30000 },
      { name: "Paying customers", unit: "count", target: 5 },
      { name: "Weekly qualified prospects", unit: "count", target: 100 },
    ],
    nextAction: "Choose the market and verify the problem.",
  },
  {
    title: "MISSION 3 — FINANCE",
    objective: "Create financial stability and build toward wealth.",
    why: "Stability buys the patience the business needs.",
    goalKey: "finance-long",
    kpis: [
      { name: "Monthly surplus", unit: "ZAR", target: null },
      { name: "Savings rate", unit: "%", target: 20 },
      { name: "Total debt", unit: "ZAR", target: null },
    ],
    nextAction: "Record the financial baseline — STATUS: NOT RECORDED.",
  },
  {
    title: "MISSION 4 — CHARACTER",
    objective: "Become highly consistent and disciplined.",
    why: "Consistency is the multiplier on every other effort.",
    goalKey: "character-long",
    kpis: [
      { name: "Promise completion", unit: "%", target: 90 },
      { name: "Habit completion", unit: "%", target: 85 },
      { name: "Must-win completion", unit: "%", target: 85 },
      { name: "Weekly reviews", unit: "%", target: 100 },
    ],
    nextAction: "Close today honestly in the daily reflection.",
  },
  {
    title: "MISSION 5 — GROWTH",
    objective: "Develop skills that increase capability and earning power.",
    why: "Skill raises the ceiling on income, health and decision quality alike.",
    goalKey: "growth-long",
    kpis: [
      { name: "Learning applied", unit: "%", target: 60 },
      { name: "Deliberate practice days per week", unit: "count", target: 5 },
    ],
    nextAction: "Log one learning item and how it will be applied.",
  },
];

/* ----------------------------------------------------------------- training */

interface ExerciseSeed {
  name: string;
  category: "STRENGTH" | "CONDITIONING" | "RUN" | "HYROX" | "MOBILITY";
  modality:
    | "WEIGHT_REPS"
    | "BODYWEIGHT_REPS"
    | "WEIGHTED_BODYWEIGHT"
    | "TIME"
    | "DISTANCE_TIME"
    | "WEIGHT_DISTANCE_TIME"
    | "REPS_TIME";
  muscle_group: string;
  is_compound?: boolean;
  rest?: number;
  increment?: number;
  progression?: "DOUBLE_PROGRESSION" | "LINEAR" | "NONE";
}

export const EXERCISES: ExerciseSeed[] = [
  /* Upper push */
  { name: "Bench Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "CHEST", is_compound: true, rest: 180, increment: 2.5 },
  { name: "Incline Bench Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "CHEST", is_compound: true, rest: 150, increment: 2.5 },
  { name: "Incline Dumbbell Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "CHEST", is_compound: true, rest: 120, increment: 2 },
  { name: "Machine Chest Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "CHEST", rest: 90, increment: 2.5 },
  { name: "Overhead Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "SHOULDERS", is_compound: true, rest: 150, increment: 2.5 },
  { name: "Dumbbell Shoulder Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "SHOULDERS", is_compound: true, rest: 120, increment: 2 },
  { name: "Lateral Raise", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "SHOULDERS", rest: 60, increment: 1 },
  { name: "Rear Delt Fly", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "SHOULDERS", rest: 60, increment: 1 },
  { name: "Triceps Pushdown", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "ARMS", rest: 60, increment: 2.5 },
  { name: "Triceps Extension", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "ARMS", rest: 60, increment: 2.5 },

  /* Upper pull */
  { name: "Weighted Pull-Up", category: "STRENGTH", modality: "WEIGHTED_BODYWEIGHT", muscle_group: "BACK", is_compound: true, rest: 180, increment: 2.5 },
  { name: "Pull-Up", category: "STRENGTH", modality: "BODYWEIGHT_REPS", muscle_group: "BACK", is_compound: true, rest: 150, increment: 2.5 },
  { name: "Barbell Row", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "BACK", is_compound: true, rest: 150, increment: 2.5 },
  { name: "Cable Row", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "BACK", is_compound: true, rest: 120, increment: 2.5 },
  { name: "Seated Cable Row", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "BACK", is_compound: true, rest: 120, increment: 2.5 },
  { name: "Lat Pulldown", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "BACK", is_compound: true, rest: 120, increment: 2.5 },
  { name: "EZ-Bar Curl", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "ARMS", rest: 60, increment: 1.25 },
  { name: "Biceps Curl", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "ARMS", rest: 60, increment: 1.25 },

  /* Lower */
  { name: "Back Squat", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 210, increment: 5 },
  { name: "Front Squat", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 180, increment: 2.5 },
  { name: "Romanian Deadlift", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 180, increment: 5 },
  { name: "Bulgarian Split Squat", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 120, increment: 2 },
  { name: "Leg Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 150, increment: 5 },
  { name: "Walking Lunges", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 120, increment: 2 },
  { name: "Leg Curl", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", rest: 90, increment: 2.5 },
  { name: "Hamstring Curl", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", rest: 90, increment: 2.5 },
  { name: "Standing Calf Raise", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", rest: 75, increment: 2.5 },
  { name: "Calf Raise", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", rest: 75, increment: 2.5 },
  { name: "Tibialis Raise", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", rest: 60, increment: 1.25 },

  /* Power */
  { name: "Box Jump", category: "CONDITIONING", modality: "BODYWEIGHT_REPS", muscle_group: "LEGS", rest: 120, progression: "NONE" },
  { name: "Med-Ball Slam", category: "CONDITIONING", modality: "BODYWEIGHT_REPS", muscle_group: "FULL", rest: 90, progression: "NONE" },

  /* Core */
  { name: "Hanging Leg Raise", category: "STRENGTH", modality: "BODYWEIGHT_REPS", muscle_group: "CORE", rest: 75, progression: "NONE" },
  { name: "Pallof Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "CORE", rest: 60, increment: 1.25 },

  /* HYROX stations */
  { name: "SkiErg", category: "HYROX", modality: "DISTANCE_TIME", muscle_group: "ENGINE", rest: 0, progression: "NONE" },
  { name: "Sled Push", category: "HYROX", modality: "WEIGHT_DISTANCE_TIME", muscle_group: "LEGS", rest: 120, progression: "NONE" },
  { name: "Sled Pull", category: "HYROX", modality: "WEIGHT_DISTANCE_TIME", muscle_group: "BACK", rest: 120, progression: "NONE" },
  { name: "Burpee Broad Jump", category: "HYROX", modality: "REPS_TIME", muscle_group: "FULL", rest: 90, progression: "NONE" },
  { name: "Row", category: "HYROX", modality: "DISTANCE_TIME", muscle_group: "ENGINE", rest: 0, progression: "NONE" },
  { name: "Farmer Carry", category: "HYROX", modality: "WEIGHT_DISTANCE_TIME", muscle_group: "FULL", rest: 90, progression: "NONE" },
  { name: "Sandbag Lunges", category: "HYROX", modality: "WEIGHT_DISTANCE_TIME", muscle_group: "LEGS", rest: 120, progression: "NONE" },
  { name: "Wall Balls", category: "HYROX", modality: "REPS_TIME", muscle_group: "FULL", rest: 90, progression: "NONE" },

  /* Running */
  { name: "Easy Zone 2 Run", category: "RUN", modality: "DISTANCE_TIME", muscle_group: "ENGINE", rest: 0, progression: "NONE" },
  { name: "Interval Run", category: "RUN", modality: "DISTANCE_TIME", muscle_group: "ENGINE", rest: 150, progression: "NONE" },
  { name: "Long Run", category: "RUN", modality: "DISTANCE_TIME", muscle_group: "ENGINE", rest: 0, progression: "NONE" },
];

interface WorkoutSeed {
  name: string;
  type: "STRENGTH" | "RUN" | "CONDITIONING" | "HYROX" | "RECOVERY" | "MOBILITY";
  focus: string;
  description: string;
  est_minutes: number;
  exercises: Array<{
    name: string;
    sets: number;
    repMin?: number;
    repMax?: number;
    seconds?: number;
    distanceM?: number;
    rest?: number;
    rirMin?: number;
    rirMax?: number;
    notes?: string;
  }>;
}

/**
 * The training week. Six sessions, Sunday complete rest.
 * Double progression governs every rep-range prescription.
 */
export const WORKOUTS: WorkoutSeed[] = [
  {
    name: "MONDAY — UPPER STRENGTH + EASY RUN",
    type: "STRENGTH",
    focus: "Upper strength · Zone 2",
    description:
      "Heavy horizontal press and weighted pull, then accessory volume. Finish with an easy Zone 2 run — conversational, not a session.",
    est_minutes: 95,
    exercises: [
      { name: "Bench Press", sets: 4, repMin: 5, repMax: 8, rirMin: 1, rirMax: 2, rest: 180 },
      { name: "Weighted Pull-Up", sets: 4, repMin: 5, repMax: 8, rirMin: 1, rirMax: 2, rest: 180 },
      { name: "Incline Dumbbell Press", sets: 3, repMin: 8, repMax: 10, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Barbell Row", sets: 3, repMin: 8, repMax: 10, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Overhead Press", sets: 3, repMin: 6, repMax: 10, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Lateral Raise", sets: 3, repMin: 12, repMax: 20, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "EZ-Bar Curl", sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "Triceps Pushdown", sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "Easy Zone 2 Run", sets: 1, seconds: 1500, notes: "20–30 min. Zone 2 — able to hold a conversation." },
    ],
  },
  {
    name: "TUESDAY — LOWER STRENGTH + HYROX STRENGTH",
    type: "STRENGTH",
    focus: "Lower strength · Sled and carry",
    description:
      "Squat and hinge first while fresh, then the HYROX strength block — sleds and loaded carries under fatigue.",
    est_minutes: 100,
    exercises: [
      { name: "Back Squat", sets: 4, repMin: 4, repMax: 6, rirMin: 1, rirMax: 2, rest: 210 },
      { name: "Romanian Deadlift", sets: 3, repMin: 6, repMax: 8, rirMin: 1, rirMax: 2, rest: 180 },
      { name: "Bulgarian Split Squat", sets: 3, repMin: 8, repMax: 10, rirMin: 1, rirMax: 2, rest: 120, notes: "Per leg." },
      { name: "Leg Curl", sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 90 },
      { name: "Standing Calf Raise", sets: 4, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 75 },
      { name: "Tibialis Raise", sets: 3, repMin: 15, repMax: 20, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "Sled Push", sets: 4, distanceM: 20, rest: 120, notes: "15–20 m per effort." },
      { name: "Sled Pull", sets: 4, distanceM: 20, rest: 120, notes: "15–20 m per effort." },
      { name: "Farmer Carry", sets: 3, distanceM: 40, rest: 120 },
      { name: "Sandbag Lunges", sets: 3, distanceM: 20, rest: 120 },
    ],
  },
  {
    name: "WEDNESDAY — RUNNING ENGINE",
    type: "RUN",
    focus: "Interval engine",
    description:
      "Weeks 1–4: 6 × 800 m, 2 min recovery. Weeks 5–8: 5 × 1 km, 2–3 min recovery. Weeks 9+: 6–8 × 1 km, controlled recovery. Ten minutes easy either side.",
    est_minutes: 60,
    exercises: [
      { name: "Easy Zone 2 Run", sets: 1, seconds: 600, notes: "Warm-up. 10 min easy." },
      { name: "Interval Run", sets: 6, distanceM: 800, rest: 120, notes: "Weeks 1–4: 6 × 800 m. Then 5 × 1 km, then 6–8 × 1 km." },
      { name: "Easy Zone 2 Run", sets: 1, seconds: 600, notes: "Cool-down. 10 min easy." },
    ],
  },
  {
    name: "THURSDAY — UPPER HYPERTROPHY",
    type: "STRENGTH",
    focus: "Upper volume",
    description: "Volume and control rather than load. Take sets close to failure — 0–2 in reserve.",
    est_minutes: 80,
    exercises: [
      { name: "Incline Bench Press", sets: 4, repMin: 6, repMax: 10, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Lat Pulldown", sets: 4, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Machine Chest Press", sets: 3, repMin: 8, repMax: 12, rirMin: 0, rirMax: 2, rest: 90 },
      { name: "Seated Cable Row", sets: 3, repMin: 8, repMax: 12, rirMin: 0, rirMax: 2, rest: 120 },
      { name: "Dumbbell Shoulder Press", sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Lateral Raise", sets: 4, repMin: 12, repMax: 20, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "Rear Delt Fly", sets: 3, repMin: 12, repMax: 20, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "Biceps Curl", sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "Triceps Extension", sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "Easy Zone 2 Run", sets: 1, seconds: 1050, notes: "Optional. 15–20 min Zone 2." },
    ],
  },
  {
    name: "FRIDAY — LOWER HYPERTROPHY + POWER",
    type: "STRENGTH",
    focus: "Power · Lower volume · Core",
    description: "Power first while the nervous system is fresh, then lower-body volume, then core.",
    est_minutes: 85,
    exercises: [
      { name: "Box Jump", sets: 3, repMin: 3, repMax: 3, rest: 120, notes: "Quality over height. Reset every rep." },
      { name: "Med-Ball Slam", sets: 3, repMin: 5, repMax: 5, rest: 90, notes: "Maximum intent." },
      { name: "Front Squat", sets: 3, repMin: 6, repMax: 10, rirMin: 1, rirMax: 2, rest: 180 },
      { name: "Leg Press", sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Romanian Deadlift", sets: 3, repMin: 8, repMax: 10, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Walking Lunges", sets: 3, repMin: 10, repMax: 10, rirMin: 1, rirMax: 2, rest: 120, notes: "Per leg." },
      { name: "Hamstring Curl", sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 90 },
      { name: "Calf Raise", sets: 4, repMin: 12, repMax: 20, rirMin: 0, rirMax: 1, rest: 75 },
      { name: "Hanging Leg Raise", sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 75 },
      { name: "Pallof Press", sets: 3, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 60 },
    ],
  },
  {
    name: "SATURDAY — HYROX SIMULATION",
    type: "HYROX",
    focus: "Race simulation",
    description:
      "Four rounds: 1 km run, 500 m SkiErg, 20 m sled push, 20 m sled pull, 10 burpee broad jumps, 500 m row. Two to three minutes between rounds. Increase race-specific density over time.",
    est_minutes: 90,
    exercises: [
      { name: "Interval Run", sets: 4, distanceM: 1000, rest: 0, notes: "One per round." },
      { name: "SkiErg", sets: 4, distanceM: 500, rest: 0 },
      { name: "Sled Push", sets: 4, distanceM: 20, rest: 0 },
      { name: "Sled Pull", sets: 4, distanceM: 20, rest: 0 },
      { name: "Burpee Broad Jump", sets: 4, repMin: 10, repMax: 10, rest: 0 },
      { name: "Row", sets: 4, distanceM: 500, rest: 150, notes: "2–3 min recovery after each round." },
    ],
  },
  {
    name: "SUNDAY — COMPLETE REST",
    type: "RECOVERY",
    focus: "Rest · Mobility · Review",
    description:
      "Complete rest. Walking, mobility, nutrition, family, and the weekly review. Rest is the session that makes the other six work.",
    est_minutes: 45,
    exercises: [],
  },
];

/** Baseline tests — the sessions that replace every NOT RECORDED with a real number. */
export const BASELINE_WORKOUTS: WorkoutSeed[] = [
  {
    name: "BASELINE — MAIN LIFTS",
    type: "STRENGTH",
    focus: "Strength baseline",
    description:
      "One working set per lift at a load you could repeat 1–2 more times. This is not a max-out. It exists to give progression something real to work from.",
    est_minutes: 75,
    exercises: [
      { name: "Bench Press", sets: 1, repMin: 5, repMax: 8, rirMin: 1, rirMax: 2, rest: 180 },
      { name: "Back Squat", sets: 1, repMin: 4, repMax: 6, rirMin: 1, rirMax: 2, rest: 210 },
      { name: "Romanian Deadlift", sets: 1, repMin: 6, repMax: 8, rirMin: 1, rirMax: 2, rest: 180 },
      { name: "Weighted Pull-Up", sets: 1, repMin: 5, repMax: 8, rirMin: 1, rirMax: 2, rest: 180 },
      { name: "Overhead Press", sets: 1, repMin: 6, repMax: 10, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Barbell Row", sets: 1, repMin: 8, repMax: 10, rirMin: 1, rirMax: 2, rest: 150 },
    ],
  },
  {
    name: "BASELINE — HYROX STATIONS",
    type: "HYROX",
    focus: "HYROX baseline",
    description:
      "Every station once, recorded honestly: load, distance, reps, time, breaks and RPE. A baseline built on guessed splits is worse than none.",
    est_minutes: 80,
    exercises: [
      { name: "SkiErg", sets: 1, distanceM: 1000, rest: 180 },
      { name: "Sled Push", sets: 1, distanceM: 50, rest: 180 },
      { name: "Sled Pull", sets: 1, distanceM: 50, rest: 180 },
      { name: "Burpee Broad Jump", sets: 1, distanceM: 80, rest: 180 },
      { name: "Row", sets: 1, distanceM: 1000, rest: 180 },
      { name: "Farmer Carry", sets: 1, distanceM: 200, rest: 180 },
      { name: "Sandbag Lunges", sets: 1, distanceM: 100, rest: 180 },
      { name: "Wall Balls", sets: 1, repMin: 100, repMax: 100, rest: 180 },
    ],
  },
];

/* ---------------------------------------------------------------- nutrition */

export const NUTRITION_TARGET = {
  goal: "HYBRID" as const,
  calories: 3000,
  protein_g: 160,
  carbs_g: 400,
  fat_g: 80,
  fiber_g: 35,
  water_ml: 3500,
  weight_trend_kg_per_week: 0.15,
};

/** Acceptable bands. Stored as a note so the rule travels with the target. */
export const NUTRITION_RULES = `TARGET  3,000 kcal · 160 g protein · 400 g carbohydrate · 80 g fat

ACCEPTABLE RANGE
  Calories       2,900–3,200
  Protein        150–165 g
  Carbohydrate   350–450 g
  Fat            70–90 g

ADJUSTMENT RULE — judged on the 7-day average, never a single day.
  Weight stagnant for ~2 weeks        recommend +150–200 kcal/day
  Weight rising fast with waist gain  recommend −150–200 kcal/day

COMMAND recommends. It does not change the target by itself.`;

export const MEAL_PRESETS = [
  { name: "Whey shake", slot: "SHAKE", calories: 160, protein_g: 30, carbs_g: 4, fat_g: 2, fiber_g: 0 },
  { name: "Chicken, rice & veg", slot: "MEAL", calories: 650, protein_g: 55, carbs_g: 70, fat_g: 12, fiber_g: 6 },
  { name: "Eggs on toast", slot: "BREAKFAST", calories: 480, protein_g: 28, carbs_g: 38, fat_g: 22, fiber_g: 4 },
  { name: "Beef mince & potato", slot: "DINNER", calories: 720, protein_g: 52, carbs_g: 62, fat_g: 26, fiber_g: 7 },
  { name: "Greek yoghurt & berries", slot: "SNACK", calories: 260, protein_g: 22, carbs_g: 28, fat_g: 6, fiber_g: 4 },
  { name: "Oats, banana & peanut butter", slot: "BREAKFAST", calories: 620, protein_g: 20, carbs_g: 88, fat_g: 20, fiber_g: 10 },
];

/* ------------------------------------------------------------------ habits */

export const HABITS = [
  { name: "Train", pillar: "BODY", target: 6, description: "The session on the plan for today, as written." },
  { name: "Hit nutrition target", pillar: "BODY", target: 7, description: "3,000 kcal and 160 g protein, inside the band." },
  { name: "Sleep and recovery", pillar: "BODY", target: 7, description: "7.5–9 hours. The cheapest performance input there is." },
  { name: "Deep work", pillar: "BUSINESS", target: 5, description: "90 uninterrupted minutes on the mission." },
  { name: "Business output", pillar: "BUSINESS", target: 5, description: "Something real left my hands today." },
  { name: "Learning", pillar: "LEARNING", target: 5, description: "Deliberate practice on a target skill — applied, not consumed." },
  { name: "Daily reflection", pillar: "CHARACTER", target: 7, description: "Close the day honestly and set tomorrow's must-win." },
];

/* ------------------------------------------------------------------ skills */

export const SKILLS = [
  { name: "Sales", why: "Nothing else in the business matters until someone pays.", current: 0, target: 8 },
  { name: "Negotiation", why: "Price and terms decide whether revenue becomes profit.", current: 0, target: 7 },
  { name: "Marketing", why: "Attention is the input to every funnel.", current: 0, target: 7 },
  { name: "Business strategy", why: "Choosing the right problem beats executing well on the wrong one.", current: 0, target: 8 },
  { name: "Finance", why: "Profit kept beats revenue earned.", current: 0, target: 7 },
  { name: "Leadership", why: "Scale requires other people to carry the work.", current: 0, target: 7 },
  { name: "Software development", why: "Building the product without waiting for someone else.", current: 0, target: 8 },
  { name: "AI and automation", why: "Leverage — the same output with less of my time in it.", current: 0, target: 8 },
  { name: "UI/UX", why: "A product people can use is worth more than one they cannot.", current: 0, target: 6 },
  { name: "Data", why: "Decisions get better when the numbers are real.", current: 0, target: 7 },
  { name: "Discipline", why: "The multiplier on every other skill.", current: 0, target: 9 },
  { name: "Communication", why: "Ideas that cannot be explained do not get bought.", current: 0, target: 8 },
  { name: "Decision-making", why: "Compounding is decided by the quality of repeated choices.", current: 0, target: 8 },
];

/* ------------------------------------------------------------------- ideas */

export const IDEAS = [
  {
    title: "AI Business Operating System",
    summary:
      "PROBLEM: Owner-run businesses operate from memory, spreadsheets and disconnected tools; nothing tells them what to do next. CUSTOMER: Small business owners running R200k–R2m/month. PAIN: No single source of truth, decisions made on feel. SOLUTION: An operating system that connects goals, execution, sales and finance and produces the next action. MODEL: Monthly SaaS. DIFFERENTIATION: Decision layer, not another dashboard.",
    stage: "CAPTURE",
    nextTest: "Interview 10 owners and ask what they check first each morning.",
  },
  {
    title: "VeriSure.AI",
    summary:
      "PROBLEM: Document verification and compliance checking is manual, slow and error-prone. CUSTOMER: Firms with regulatory document loads. PAIN: Cost and risk of missed checks. SOLUTION: Automated verification and compliance flagging. MODEL: Per-document or subscription. DIFFERENTIATION: Accuracy and audit trail.",
    stage: "CAPTURE",
    nextTest: "Identify which industry feels this pain hardest and what they pay today.",
  },
  {
    title: "Procurement Automation",
    summary:
      "PROBLEM: Procurement runs on email, spreadsheets and chasing. CUSTOMER: Mid-size firms with recurring purchasing. PAIN: Slow quoting, poor price visibility, no audit trail. SOLUTION: Automated RFQ, comparison and approval flow. MODEL: SaaS with per-seat or per-volume pricing. DIFFERENTIATION: Speed from request to approved order.",
    stage: "CAPTURE",
    nextTest: "Quantify the hours a procurement officer loses per week to quoting.",
  },
  {
    title: "Automated Lead Generation / CRM",
    summary:
      "PROBLEM: Small firms lose deals to slow follow-up and have no pipeline discipline. CUSTOMER: Service businesses that quote. PAIN: Leads go cold, no visibility of the funnel. SOLUTION: Lead capture, sequencing and follow-up automation with a simple pipeline. MODEL: Monthly retainer plus setup. DIFFERENTIATION: Done-for-you installation rather than software handed over.",
    stage: "CAPTURE",
    nextTest: "Measure average follow-up time in three target businesses.",
  },
  {
    title: "AI Document Verification / Compliance",
    summary:
      "PROBLEM: Compliance review is repetitive expert work. CUSTOMER: Regulated firms. PAIN: Expensive human review, inconsistent outcomes. SOLUTION: Model-assisted review with human sign-off. MODEL: Per-review pricing. DIFFERENTIATION: Defensible audit trail.",
    stage: "CAPTURE",
    nextTest: "Confirm whether regulation permits automated pre-review in the target sector.",
  },
  {
    title: "Fitness Scheduling SaaS",
    summary:
      "PROBLEM: Coaches and studios run scheduling, payments and programming across separate tools. CUSTOMER: Independent coaches and small studios. PAIN: Admin time and missed payments. SOLUTION: Combined scheduling, billing and programme delivery. MODEL: Per-coach subscription. DIFFERENTIATION: Built by someone who trains seriously.",
    stage: "CAPTURE",
    nextTest: "Ask five coaches what they currently pay across all their tools.",
  },
  {
    title: "Healthcare / Telemedicine Automation",
    summary:
      "PROBLEM: Administrative load in small practices crowds out patient time. CUSTOMER: Private practices. PAIN: Booking, records, billing and follow-up all manual. SOLUTION: Practice automation layer. MODEL: Per-practice subscription. DIFFERENTIATION: Compliance-aware from the start.",
    stage: "CAPTURE",
    nextTest: "Establish the regulatory constraints before any build.",
  },
  {
    title: "Construction / Engineering / Manufacturing Business",
    summary:
      "PROBLEM: Established demand, fragmented and often poorly run supply. CUSTOMER: Commercial and industrial clients. PAIN: Unreliable delivery and poor communication. SOLUTION: A well-run operation with better systems than incumbents. MODEL: Project margin. DIFFERENTIATION: Operational discipline and systems.",
    stage: "CAPTURE",
    nextTest: "Establish capital requirement and time-to-first-revenue honestly.",
  },
  {
    title: "Short-Form Content / Clipping System",
    summary:
      "PROBLEM: Long-form creators cannot keep up with short-form distribution. CUSTOMER: Creators, podcasters, agencies. PAIN: Editing time per clip. SOLUTION: Automated clipping, captioning and scheduling. MODEL: Volume subscription. DIFFERENTIATION: Throughput and consistency.",
    stage: "CAPTURE",
    nextTest: "Check what incumbents charge and where they fall down.",
  },
];

/* --------------------------------------------------------------- business */

export const BUSINESS = {
  name: "The Machine",
  model: "To be defined at the Market and Offer milestones. One problem, one solution, one market.",
  stage: "VALIDATE" as const,
  mrrTargetCents: 150_000_00,
};

export const BUSINESS_KPIS = [
  { name: "Monthly recurring revenue", unit: "ZAR", target: 150000 },
  { name: "Paying customers", unit: "count", target: null },
  { name: "Qualified prospects per week", unit: "count", target: 100 },
  { name: "Quality outreaches per week", unit: "count", target: 50 },
  { name: "Follow-ups per week", unit: "count", target: 25 },
  { name: "Sales conversations per week", unit: "count", target: 5 },
  { name: "Demos per week", unit: "count", target: 3 },
  { name: "Proposals per week", unit: "count", target: 1 },
];

export const REVENUE_MILESTONES = [10_000, 25_000, 50_000, 100_000, 150_000];

export const SALES_ACTIVITY = `INITIAL ACTIVITY TARGETS — these are inputs, not forecasts.

DAILY
  20–30  qualified prospects identified
  10–20  quality outreaches
  5      follow-ups
  1      meaningful sales conversation

WEEKLY
  100+   prospects
  50+    quality outreaches
  25+    follow-ups
  5+     conversations
  2–3    demos
  1+     proposal

These stand only until there is enough recorded stage history to compute real
conversion rates. From that point the required activity is derived from actual
rates, and COMMAND will refuse to back-solve the funnel off a guessed number.

FUNNEL
  PROSPECT → CONTACTED → RESPONDED → QUALIFIED → MEETING → DEMO →
  PROPOSAL → NEGOTIATION → WON → ONBOARDING → RETAINED`;

export const STRATEGY_NOTE = `STRATEGY FRAMEWORK
  MARKET → PROBLEM → OFFER → VALIDATION → PRODUCT → SALES → DELIVERY →
  RETENTION → SYSTEMISATION → SCALE

CURRENT STRATEGIC OBJECTIVE
  Find ONE valuable problem and build ONE scalable solution around it.

RULES
  Do not chase every idea.
  Do not build for months without validation.
  Do not add complexity before demand exists.
  Do not confuse product development with business progress.

PRIORITY
  CUSTOMER → REVENUE → RETENTION → SCALE`;

export const FINANCE_NOTE = `FINANCIAL PROGRESSION
  STABILITY → CONTROL → DEBT REDUCTION → CASH BUFFER → INCOME GROWTH →
  INVESTING → ASSET OWNERSHIP → FINANCIAL FREEDOM

CASH FLOW RULE
  Every rand has a purpose.

CATEGORIES
  NECESSITIES · DEBT · INVESTMENT · SAVINGS · LIFESTYLE · BUSINESS

DEBT STRATEGY
  Highest-cost debt first.
  Maintain every essential obligation.
  Do not add unnecessary consumer debt.
  Direct surplus to stability before investing aggressively.

INVESTING PRINCIPLE
  Income → Surplus → Investments → Compounding → Assets → Wealth

CURRENT BALANCES
  STATUS: NOT RECORDED. Cash, debt, investments and net worth all need a
  baseline before any of this can be tracked. Nothing has been assumed.`;

export const REVIEW_NOTE = `REVIEW CADENCE
  DAILY     5 minutes   What did I accomplish? What did I avoid? What went well?
                        What went badly? Why? What did I learn? Tomorrow's must-win?
  WEEKLY    30 minutes  Biggest win, biggest failure, biggest lesson. What improved,
                        what declined, what needs changing, next week's priority.
  MONTHLY   60 minutes  Trend over four weeks across all five pillars.
  90-DAY    Full reset  Season closed, mission judged, next season set.

Every weekly review covers BODY · BUSINESS · FINANCE · CHARACTER · GROWTH
and produces: KEEP · STOP · START · CHANGE.`;

export const DISCIPLINE_NOTE = `DISCIPLINE SCORE WEIGHTING
  Promises      30%   target 90%
  Habits        25%   target 85%
  Must-wins     25%   target 85%
  Training      10%   target 85%
  Reviews       10%   target 100%

OBJECTIVE
  Become someone who does what he says he will do.`;

/* ------------------------------------------------------------------ tasks */

/**
 * The opening tasks. One must-win, then the baselines that turn every
 * NOT RECORDED in this system into a real number.
 */
export const OPENING_TASKS = [
  {
    title: "Choose the ONE market and write down the problem in the customer's words",
    pillar: "BUSINESS" as const,
    priority: "MUST_WIN" as const,
    expected_outcome:
      "One market named and one problem stated in language a customer would recognise as their own.",
    estimated_minutes: 90,
    milestone: "Market",
  },
  {
    title: "Run the strength baseline — six main lifts",
    pillar: "BODY" as const,
    priority: "SUPPORT" as const,
    expected_outcome: "A recorded working set for bench, squat, RDL, pull-up, press and row.",
    estimated_minutes: 75,
  },
  {
    title: "Run the HYROX baseline simulation",
    pillar: "BODY" as const,
    priority: "SUPPORT" as const,
    expected_outcome: "Every station recorded: load, distance, reps, time, breaks, RPE.",
    estimated_minutes: 80,
  },
  {
    title: "Record baseline body measurements",
    pillar: "BODY" as const,
    priority: "SUPPORT" as const,
    expected_outcome: "Waist, chest, arms, thighs and a progress photo recorded.",
    estimated_minutes: 15,
  },
  {
    title: "Record the financial baseline",
    pillar: "FINANCE" as const,
    priority: "SUPPORT" as const,
    expected_outcome:
      "Accounts, debts, income and fixed expenses entered so cash flow and net worth become real.",
    estimated_minutes: 60,
  },
];
