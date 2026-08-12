/**
 * The starting state of COMMAND: the user's stated objectives, the FOUNDATION
 * season, the BUILD THE MACHINE mission, and the training library.
 *
 * This is structure only. No performance history is invented — every score,
 * trend and record in COMMAND must come from something the user actually did.
 */

export interface ExerciseSeed {
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
  // Push
  { name: "Barbell Bench Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "CHEST", is_compound: true, rest: 150, increment: 2.5 },
  { name: "Incline Dumbbell Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "CHEST", is_compound: true, rest: 120, increment: 2 },
  { name: "Overhead Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "SHOULDERS", is_compound: true, rest: 150, increment: 2.5 },
  { name: "Dumbbell Shoulder Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "SHOULDERS", is_compound: true, rest: 120, increment: 2 },
  { name: "Cable Fly", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "CHEST", rest: 75, increment: 2.5 },
  { name: "Lateral Raise", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "SHOULDERS", rest: 60, increment: 1 },
  { name: "Triceps Rope Pushdown", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "ARMS", rest: 60, increment: 2.5 },
  { name: "Overhead Triceps Extension", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "ARMS", rest: 60, increment: 2.5 },
  { name: "Dips", category: "STRENGTH", modality: "WEIGHTED_BODYWEIGHT", muscle_group: "CHEST", is_compound: true, rest: 120, increment: 2.5 },

  // Pull
  { name: "Deadlift", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "BACK", is_compound: true, rest: 180, increment: 5 },
  { name: "Barbell Row", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "BACK", is_compound: true, rest: 150, increment: 2.5 },
  { name: "Pull-Up", category: "STRENGTH", modality: "WEIGHTED_BODYWEIGHT", muscle_group: "BACK", is_compound: true, rest: 150, increment: 2.5 },
  { name: "Lat Pulldown", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "BACK", is_compound: true, rest: 120, increment: 2.5 },
  { name: "Seated Cable Row", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "BACK", is_compound: true, rest: 120, increment: 2.5 },
  { name: "Face Pull", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "SHOULDERS", rest: 60, increment: 2.5 },
  { name: "Barbell Curl", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "ARMS", rest: 75, increment: 2.5 },
  { name: "Hammer Curl", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "ARMS", rest: 60, increment: 2 },

  // Legs
  { name: "Back Squat", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 180, increment: 2.5 },
  { name: "Front Squat", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 180, increment: 2.5 },
  { name: "Romanian Deadlift", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 150, increment: 2.5 },
  { name: "Bulgarian Split Squat", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 120, increment: 2 },
  { name: "Leg Press", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", is_compound: true, rest: 150, increment: 5 },
  { name: "Walking Lunge", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", rest: 120, increment: 2 },
  { name: "Leg Curl", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", rest: 75, increment: 2.5 },
  { name: "Standing Calf Raise", category: "STRENGTH", modality: "WEIGHT_REPS", muscle_group: "LEGS", rest: 60, increment: 5 },

  // Core
  { name: "Hanging Leg Raise", category: "STRENGTH", modality: "BODYWEIGHT_REPS", muscle_group: "CORE", rest: 60 },
  { name: "Weighted Plank", category: "STRENGTH", modality: "TIME", muscle_group: "CORE", rest: 60, progression: "NONE" },
  { name: "Ab Wheel Rollout", category: "STRENGTH", modality: "BODYWEIGHT_REPS", muscle_group: "CORE", rest: 60 },

  // Engine / HYROX
  { name: "SkiErg", category: "HYROX", modality: "DISTANCE_TIME", muscle_group: "ENGINE", rest: 90, progression: "NONE" },
  { name: "Rowing Machine", category: "HYROX", modality: "DISTANCE_TIME", muscle_group: "ENGINE", rest: 90, progression: "NONE" },
  { name: "Sled Push", category: "HYROX", modality: "WEIGHT_DISTANCE_TIME", muscle_group: "FULL", rest: 120, progression: "NONE" },
  { name: "Sled Pull", category: "HYROX", modality: "WEIGHT_DISTANCE_TIME", muscle_group: "FULL", rest: 120, progression: "NONE" },
  { name: "Burpee Broad Jump", category: "HYROX", modality: "REPS_TIME", muscle_group: "FULL", rest: 90, progression: "NONE" },
  { name: "Farmers Carry", category: "HYROX", modality: "WEIGHT_DISTANCE_TIME", muscle_group: "FULL", rest: 90, progression: "NONE" },
  { name: "Sandbag Lunges", category: "HYROX", modality: "WEIGHT_DISTANCE_TIME", muscle_group: "LEGS", rest: 120, progression: "NONE" },
  { name: "Wall Balls", category: "HYROX", modality: "REPS_TIME", muscle_group: "FULL", rest: 90, progression: "NONE" },
  { name: "Assault Bike", category: "CONDITIONING", modality: "DISTANCE_TIME", muscle_group: "ENGINE", rest: 90, progression: "NONE" },
  { name: "Kettlebell Swing", category: "CONDITIONING", modality: "WEIGHT_REPS", muscle_group: "FULL", rest: 75, increment: 4 },

  // Mobility
  { name: "Couch Stretch", category: "MOBILITY", modality: "TIME", muscle_group: "LEGS", rest: 30, progression: "NONE" },
  { name: "Thoracic Extension", category: "MOBILITY", modality: "TIME", muscle_group: "BACK", rest: 30, progression: "NONE" },
  { name: "90/90 Hip Switch", category: "MOBILITY", modality: "TIME", muscle_group: "LEGS", rest: 30, progression: "NONE" },
];

export interface WorkoutSeed {
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
    paceSec?: number;
    rirMin?: number;
    rirMax?: number;
    rest?: number;
    notes?: string;
  }>;
}

export const WORKOUTS: WorkoutSeed[] = [
  {
    name: "PUSH A",
    type: "STRENGTH",
    focus: "Chest · Shoulders · Triceps",
    description: "Heavy horizontal press, vertical press, then accessory volume.",
    est_minutes: 65,
    exercises: [
      { name: "Barbell Bench Press", sets: 3, repMin: 5, repMax: 8, rirMin: 1, rirMax: 2, rest: 180 },
      { name: "Overhead Press", sets: 3, repMin: 6, repMax: 9, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Incline Dumbbell Press", sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Lateral Raise", sets: 3, repMin: 12, repMax: 15, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "Triceps Rope Pushdown", sets: 3, repMin: 10, repMax: 14, rirMin: 0, rirMax: 1, rest: 60 },
    ],
  },
  {
    name: "PULL A",
    type: "STRENGTH",
    focus: "Back · Rear delts · Biceps",
    description: "Vertical pull, horizontal pull, then arms and rear delts.",
    est_minutes: 65,
    exercises: [
      { name: "Pull-Up", sets: 4, repMin: 5, repMax: 9, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Barbell Row", sets: 3, repMin: 6, repMax: 10, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Seated Cable Row", sets: 3, repMin: 10, repMax: 13, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Face Pull", sets: 3, repMin: 14, repMax: 18, rirMin: 0, rirMax: 1, rest: 60 },
      { name: "Barbell Curl", sets: 3, repMin: 8, repMax: 12, rirMin: 0, rirMax: 1, rest: 75 },
    ],
  },
  {
    name: "LEGS A",
    type: "STRENGTH",
    focus: "Quads · Hamstrings · Calves",
    description: "Squat pattern, hinge pattern, unilateral work, calves.",
    est_minutes: 70,
    exercises: [
      { name: "Back Squat", sets: 4, repMin: 5, repMax: 8, rirMin: 1, rirMax: 2, rest: 210 },
      { name: "Romanian Deadlift", sets: 3, repMin: 8, repMax: 10, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Bulgarian Split Squat", sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Leg Curl", sets: 3, repMin: 10, repMax: 14, rirMin: 0, rirMax: 1, rest: 75 },
      { name: "Standing Calf Raise", sets: 4, repMin: 10, repMax: 15, rirMin: 0, rirMax: 1, rest: 60 },
    ],
  },
  {
    name: "UPPER",
    type: "STRENGTH",
    focus: "Full upper body",
    description: "Balanced push and pull when training frequency is compressed.",
    est_minutes: 60,
    exercises: [
      { name: "Barbell Bench Press", sets: 3, repMin: 6, repMax: 9, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Barbell Row", sets: 3, repMin: 6, repMax: 9, rirMin: 1, rirMax: 2, rest: 150 },
      { name: "Dumbbell Shoulder Press", sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Lat Pulldown", sets: 3, repMin: 10, repMax: 13, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Hammer Curl", sets: 2, repMin: 10, repMax: 14, rirMin: 0, rirMax: 1, rest: 60 },
    ],
  },
  {
    name: "LOWER",
    type: "STRENGTH",
    focus: "Full lower body",
    description: "Squat, hinge and posterior chain in one session.",
    est_minutes: 60,
    exercises: [
      { name: "Deadlift", sets: 3, repMin: 3, repMax: 5, rirMin: 2, rirMax: 3, rest: 240 },
      { name: "Front Squat", sets: 3, repMin: 6, repMax: 9, rirMin: 1, rirMax: 2, rest: 180 },
      { name: "Walking Lunge", sets: 3, repMin: 10, repMax: 14, rirMin: 1, rirMax: 2, rest: 120 },
      { name: "Hanging Leg Raise", sets: 3, repMin: 10, repMax: 15, rest: 60 },
    ],
  },
  {
    name: "ZONE 2",
    type: "RUN",
    focus: "Aerobic base",
    description: "Conversational pace. The engine is built here, not in intervals.",
    est_minutes: 55,
    exercises: [],
  },
  {
    name: "INTERVALS",
    type: "RUN",
    focus: "VO2 / speed",
    description: "6 × 800m at target pace with 90 seconds recovery.",
    est_minutes: 50,
    exercises: [],
  },
  {
    name: "TEMPO",
    type: "RUN",
    focus: "Threshold",
    description: "Sustained effort at comfortably hard pace.",
    est_minutes: 45,
    exercises: [],
  },
  {
    name: "LONG RUN",
    type: "RUN",
    focus: "Endurance",
    description: "The weekly distance anchor.",
    est_minutes: 90,
    exercises: [],
  },
  {
    name: "HYROX CONDITIONING",
    type: "HYROX",
    focus: "Station capacity",
    description: "Compromised-running station work in race-relevant doses.",
    est_minutes: 60,
    exercises: [
      { name: "SkiErg", sets: 3, distanceM: 500, rest: 90 },
      { name: "Sled Push", sets: 4, distanceM: 25, rest: 120 },
      { name: "Burpee Broad Jump", sets: 3, repMin: 20, repMax: 20, rest: 90 },
      { name: "Farmers Carry", sets: 3, distanceM: 100, rest: 90 },
      { name: "Wall Balls", sets: 3, repMin: 30, repMax: 30, rest: 90 },
    ],
  },
  {
    name: "HYROX SIMULATION",
    type: "HYROX",
    focus: "Full race",
    description: "8 × 1km alternating with all eight stations. Log it as a simulation.",
    est_minutes: 100,
    exercises: [],
  },
  {
    name: "MOBILITY RESET",
    type: "MOBILITY",
    focus: "Hips · T-spine · Ankles",
    description: "Fifteen minutes that keeps the rest of the plan possible.",
    est_minutes: 15,
    exercises: [
      { name: "Couch Stretch", sets: 2, seconds: 60, rest: 30 },
      { name: "90/90 Hip Switch", sets: 2, seconds: 60, rest: 30 },
      { name: "Thoracic Extension", sets: 2, seconds: 60, rest: 30 },
    ],
  },
];

export const MILESTONES = [
  { title: "Research", description: "Target customer identified, problem verified in their words." },
  { title: "Offer", description: "A specific offer with a price, a promise and a reason to buy now." },
  { title: "Validation", description: "Real people confirm they want it — ideally with money." },
  { title: "MVP", description: "The smallest thing that delivers the promise." },
  { title: "Launch", description: "Live, reachable and buyable." },
  { title: "First Customer", description: "One paying customer. The hardest one." },
  { title: "Repeatable Sales", description: "A second and third customer from the same process." },
  { title: "Revenue Target", description: "Monthly revenue at the level the mission set." },
];

export const HABITS = [
  { name: "Train", pillar: "BODY", target: 5, description: "Strength or engine work, as planned." },
  { name: "Hit protein", pillar: "BODY", target: 7, description: "Protein target met for the day." },
  { name: "Sleep 7+ hours", pillar: "BODY", target: 7, description: "The cheapest performance input there is." },
  { name: "Deep work block", pillar: "BUSINESS", target: 5, description: "90 uninterrupted minutes on the mission." },
  { name: "Business output shipped", pillar: "BUSINESS", target: 5, description: "Something real left your hands." },
  { name: "Learning", pillar: "LEARNING", target: 5, description: "Study or deliberate practice on a target skill." },
  { name: "Daily reflection", pillar: "CHARACTER", target: 7, description: "Close the day honestly." },
];

export const SKILLS = [
  { name: "Sales", why: "Nothing else in the business matters until someone pays.", current: 3, target: 8 },
  { name: "Offer & positioning", why: "The offer decides how hard the selling has to be.", current: 3, target: 8 },
  { name: "Copywriting", why: "Words are the delivery mechanism for every other skill.", current: 3, target: 7 },
  { name: "Product delivery", why: "Retention comes from what happens after the sale.", current: 4, target: 8 },
  { name: "Financial control", why: "Profit kept beats revenue earned.", current: 3, target: 7 },
];

export const GOALS = [
  {
    key: "vision",
    horizon: "VISION",
    pillar: "LIFE",
    title: "A life with financial freedom, physical capability, strong relationships and control over time",
    why: "Every other goal in this system exists to serve this one.",
  },
  {
    key: "income-3y",
    parent: "vision",
    horizon: "THREE_YEAR",
    pillar: "BUSINESS",
    title: "R150,000+ per month from business and ownership",
    why: "Income at this level converts effort into optionality and time.",
    kpi: "Monthly business income",
    unit: "ZAR",
    target: 150000,
    current: 0,
  },
  {
    key: "hybrid-3y",
    parent: "vision",
    horizon: "THREE_YEAR",
    pillar: "BODY",
    title: "Hybrid athlete: muscular, lean, strong, HYROX capable",
    why: "Capability is the foundation everything else is executed from.",
  },
  {
    key: "networth-3y",
    parent: "vision",
    horizon: "THREE_YEAR",
    pillar: "FINANCE",
    title: "Build substantial net worth through owned assets",
    why: "Assets outlast effort.",
    kpi: "Net worth",
    unit: "ZAR",
  },
  {
    key: "character-3y",
    parent: "vision",
    horizon: "THREE_YEAR",
    pillar: "CHARACTER",
    title: "Disciplined, patient, emotionally controlled, reliable",
    why: "Character is the constraint on how far the rest can go.",
    kpi: "Promise rate",
    unit: "%",
    target: 90,
  },
  {
    key: "revenue-1y",
    parent: "income-3y",
    horizon: "ONE_YEAR",
    pillar: "BUSINESS",
    title: "One business producing consistent monthly revenue",
    why: "One working business beats five ideas.",
    kpi: "Monthly recurring revenue",
    unit: "ZAR",
    target: 30000,
    current: 0,
  },
  {
    key: "strength-1y",
    parent: "hybrid-3y",
    horizon: "ONE_YEAR",
    pillar: "BODY",
    title: "Bench 100kg · Squat 140kg · Deadlift 180kg · 10 strict pull-ups",
    why: "Strength standards that support the hybrid engine.",
    kpi: "Big-three total",
    unit: "kg",
    target: 420,
  },
  {
    key: "hyrox-1y",
    parent: "hybrid-3y",
    horizon: "ONE_YEAR",
    pillar: "BODY",
    title: "Complete a HYROX race",
    why: "A race date makes the training honest.",
    kpi: "Race time",
    unit: "min",
  },
  {
    key: "debt-1y",
    parent: "networth-3y",
    horizon: "ONE_YEAR",
    pillar: "FINANCE",
    title: "Clear all high-interest debt and hold a one-month buffer",
    why: "Financial pressure makes patient decisions impossible.",
    kpi: "Debt balance",
    unit: "ZAR",
    target: 0,
    direction: "DOWN" as const,
  },
  {
    key: "sales-1y",
    parent: "income-3y",
    horizon: "ONE_YEAR",
    pillar: "LEARNING",
    title: "Sales capability at 8/10, evidenced by closed deals",
    why: "The highest-leverage skill for the current mission.",
    kpi: "Skill level",
    unit: "/10",
    target: 8,
    current: 3,
  },
];

export const MISSION_KPIS = [
  { name: "Paying customers", unit: "count", target: 5, current: 0 },
  { name: "Monthly revenue", unit: "ZAR", target: 30000, current: 0 },
  { name: "Qualified leads generated", unit: "count", target: 60, current: 0 },
  { name: "Sales conversations held", unit: "count", target: 30, current: 0 },
];

export const SETTINGS: Array<[string, string]> = [
  ["sleep_target_hours", "8"],
  ["savings_rate_target", "0.2"],
  ["learning_days_target", "5"],
  ["learning_minutes_target", "300"],
  ["major_spend_cents", "500000"],
  ["streak_threshold", "60"],
];

export const NUTRITION_TARGET = {
  goal: "HYBRID" as const,
  calories: 3000,
  protein_g: 180,
  carbs_g: 330,
  fat_g: 85,
  fiber_g: 35,
  water_ml: 3500,
  weight_trend_kg_per_week: 0.2,
};

export const MEAL_PRESETS = [
  { name: "Whey shake", slot: "SHAKE", calories: 160, protein_g: 30, carbs_g: 4, fat_g: 2, fiber_g: 0 },
  { name: "Chicken, rice & veg", slot: "MEAL", calories: 650, protein_g: 55, carbs_g: 70, fat_g: 12, fiber_g: 6 },
  { name: "Eggs on toast", slot: "BREAKFAST", calories: 480, protein_g: 28, carbs_g: 38, fat_g: 22, fiber_g: 4 },
  { name: "Beef mince & potato", slot: "DINNER", calories: 720, protein_g: 52, carbs_g: 62, fat_g: 26, fiber_g: 7 },
  { name: "Greek yoghurt & berries", slot: "SNACK", calories: 260, protein_g: 22, carbs_g: 28, fat_g: 6, fiber_g: 4 },
  { name: "Oats & whey", slot: "BREAKFAST", calories: 520, protein_g: 38, carbs_g: 65, fat_g: 10, fiber_g: 8 },
];
