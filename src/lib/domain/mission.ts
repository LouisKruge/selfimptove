import { clamp, round } from "./stats";

/**
 * MISSION ENGINE
 *
 * Mission progress is derived from the work linked to it — milestones, tasks
 * and KPIs — so no percentage is ever typed in by hand. Progress is then
 * compared to elapsed time to answer the only question that matters: is this
 * ahead of, on, or behind schedule?
 */

export interface MissionProgressInput {
  milestones: Array<{ weight: number; status: string }>;
  tasksTotal: number;
  tasksComplete: number;
  kpis: Array<{ current_value: number | null; target_value: number | null }>;
  startDate: string;
  endDate: string;
  today: string;
}

export type ScheduleVerdict = "AHEAD" | "ON_TRACK" | "BEHIND" | "AT_RISK" | "UNKNOWN";

export interface MissionProgress {
  progressPct: number | null;
  milestonePct: number | null;
  taskPct: number | null;
  kpiPct: number | null;
  elapsedPct: number;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  schedule: ScheduleVerdict;
  scheduleDelta: number | null;
  message: string;
  components: Array<{ label: string; value: number | null; weight: number; detail: string }>;
}

const MILESTONE_WEIGHT = 55;
const TASK_WEIGHT = 25;
const KPI_WEIGHT = 20;

export function missionProgress(input: MissionProgressInput): MissionProgress {
  const totalWeight = input.milestones.reduce((t, m) => t + Math.max(1, m.weight), 0);
  const doneWeight = input.milestones.reduce(
    (t, m) => t + (m.status === "COMPLETE" ? Math.max(1, m.weight) : 0),
    0,
  );
  const partialWeight = input.milestones.reduce(
    (t, m) => t + (m.status === "IN_PROGRESS" ? Math.max(1, m.weight) * 0.5 : 0),
    0,
  );

  const milestonePct =
    totalWeight > 0 ? round(clamp(((doneWeight + partialWeight) / totalWeight) * 100, 0, 100), 1) : null;

  const taskPct =
    input.tasksTotal > 0
      ? round(clamp((input.tasksComplete / input.tasksTotal) * 100, 0, 100), 1)
      : null;

  const usableKpis = input.kpis.filter(
    (k) => k.current_value !== null && k.target_value !== null && k.target_value !== 0,
  );
  const kpiPct = usableKpis.length
    ? round(
        clamp(
          (usableKpis.reduce(
            (t, k) => t + clamp(((k.current_value as number) / (k.target_value as number)) * 100, 0, 100),
            0,
          ) /
            usableKpis.length),
          0,
          100,
        ),
        1,
      )
    : null;

  const components = [
    {
      label: "Milestones",
      value: milestonePct,
      weight: MILESTONE_WEIGHT,
      detail:
        milestonePct === null
          ? "No milestones defined."
          : `${input.milestones.filter((m) => m.status === "COMPLETE").length}/${input.milestones.length} complete.`,
    },
    {
      label: "Linked tasks",
      value: taskPct,
      weight: TASK_WEIGHT,
      detail:
        taskPct === null
          ? "No tasks linked to this mission."
          : `${input.tasksComplete}/${input.tasksTotal} complete.`,
    },
    {
      label: "KPIs",
      value: kpiPct,
      weight: KPI_WEIGHT,
      detail:
        kpiPct === null ? "No KPI has both a current and target value." : `${usableKpis.length} KPIs measured.`,
    },
  ];

  let weighted = 0;
  let weightUsed = 0;
  for (const c of components) {
    if (c.value === null) continue;
    weighted += c.value * c.weight;
    weightUsed += c.weight;
  }
  const progressPct = weightUsed > 0 ? round(weighted / weightUsed, 1) : null;

  const daysTotal = Math.max(1, dayDiff(input.endDate, input.startDate) + 1);
  const daysElapsed = clamp(dayDiff(input.today, input.startDate) + 1, 0, daysTotal);
  const daysRemaining = Math.max(0, dayDiff(input.endDate, input.today));
  const elapsedPct = round((daysElapsed / daysTotal) * 100, 1);

  let schedule: ScheduleVerdict = "UNKNOWN";
  let scheduleDelta: number | null = null;
  let message = "Link milestones, tasks or KPIs so progress can be calculated.";

  if (progressPct !== null) {
    scheduleDelta = round(progressPct - elapsedPct, 1);
    if (scheduleDelta >= 8) schedule = "AHEAD";
    else if (scheduleDelta >= -8) schedule = "ON_TRACK";
    else if (scheduleDelta >= -20) schedule = "BEHIND";
    else schedule = "AT_RISK";

    const word =
      schedule === "AHEAD"
        ? "ahead of"
        : schedule === "ON_TRACK"
          ? "on"
          : schedule === "BEHIND"
            ? "behind"
            : "significantly behind";
    message = `${progressPct}% complete with ${elapsedPct}% of the window elapsed — ${word} schedule. ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} remaining.`;
  }

  return {
    progressPct,
    milestonePct,
    taskPct,
    kpiPct,
    elapsedPct,
    daysTotal,
    daysElapsed,
    daysRemaining,
    schedule,
    scheduleDelta,
    message,
    components,
  };
}

function dayDiff(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000,
  );
}

/** Fixed-width bar: ████████████░░░░ */
export function progressBar(pct: number | null, width = 16): string {
  if (pct === null) return "·".repeat(width);
  const filled = Math.round((clamp(pct, 0, 100) / 100) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}
