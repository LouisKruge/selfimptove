import "server-only";

import { all, get, scalar } from "@/lib/db";
import { byId } from "@/lib/db/repo";
import { today, type DayString } from "@/lib/core/date";
import { missionProgress, type MissionProgress } from "@/lib/domain/mission";
import { progressPct } from "@/lib/domain/stats";
import type {
  Goal,
  Milestone,
  Mission,
  MissionKpi,
  Project,
  Risk,
  Season,
  Task,
  User,
} from "@/lib/types";

/* ------------------------------------------------------------ user + season */

export async function getUser(): Promise<User | undefined> {
  return await get<User>("SELECT * FROM users LIMIT 1");
}

export async function getSetting(key: string): Promise<string | null> {
  return (await get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]))?.value ?? null;
}

export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const v = await getSetting(key);
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function activeSeason(day: DayString = today()): Promise<Season | undefined> {
  return (
    await get<Season>(
            `SELECT * FROM seasons
        WHERE status = 'ACTIVE' AND start_date <= ?
          AND (end_date IS NULL OR end_date >= ?)
        ORDER BY start_date DESC LIMIT 1`,
            [day, day],
          ) ?? await get<Season>("SELECT * FROM seasons WHERE status = 'ACTIVE' ORDER BY start_date DESC LIMIT 1")
  );
}

export async function listSeasons(): Promise<Season[]> {
  return await all<Season>("SELECT * FROM seasons ORDER BY start_date DESC");
}

/* ------------------------------------------------------------------- goals */

export async function listGoals(filter: { status?: string; pillar?: string; horizon?: string } = {}): Promise<Goal[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter.pillar) {
    clauses.push("pillar = ?");
    params.push(filter.pillar);
  }
  if (filter.horizon) {
    clauses.push("horizon = ?");
    params.push(filter.horizon);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return await all<Goal>(
      `SELECT * FROM goals ${where}
      ORDER BY CASE horizon
        WHEN 'VISION' THEN 0 WHEN 'THREE_YEAR' THEN 1 WHEN 'ONE_YEAR' THEN 2
        WHEN 'QUARTER' THEN 3 WHEN 'MONTH' THEN 4 ELSE 5 END,
        sort_order, created_at`,
      params,
    );
}

export async function getGoal(id: string): Promise<Goal | undefined> {
  return await byId<Goal>("goals", id);
}

export interface GoalView extends Goal {
  progress: number | null;
  gap: number | null;
  children: Goal[];
  linkedProjects: Project[];
  linkedTasks: Task[];
}

export async function goalView(id: string): Promise<GoalView | undefined> {
  const goal = await getGoal(id);
  if (!goal) return undefined;
  return {
    ...goal,
    progress: progressPct({
      start: goal.start_value,
      current: goal.current_value,
      target: goal.target_value,
      direction: goal.direction,
    }),
    gap: goalGap(goal),
    children: await all<Goal>("SELECT * FROM goals WHERE parent_id = ? ORDER BY sort_order", [id]),
    linkedProjects: await all<Project>("SELECT * FROM projects WHERE goal_id = ? ORDER BY created_at DESC", [id]),
    linkedTasks: await all<Task>(
          "SELECT * FROM tasks WHERE goal_id = ? AND status NOT IN ('COMPLETE','CANCELLED') ORDER BY scheduled_date",
          [id],
        ),
  };
}

export function goalGap(goal: Goal): number | null {
  if (goal.target_value === null || goal.current_value === null) return null;
  return goal.direction === "UP"
    ? Math.max(0, goal.target_value - goal.current_value)
    : Math.max(0, goal.current_value - goal.target_value);
}

export function goalProgress(goal: Goal): number | null {
  return progressPct({
    start: goal.start_value,
    current: goal.current_value,
    target: goal.target_value,
    direction: goal.direction,
  });
}

/** Goals arranged as the LIFE VISION → WEEK hierarchy. */
export interface GoalNode {
  goal: Goal;
  progress: number | null;
  children: GoalNode[];
}

export async function goalTree(status = "ACTIVE"): Promise<GoalNode[]> {
  const goals = await listGoals({ status });
  const byParent = new Map<string | null, Goal[]>();
  for (const g of goals) {
    const key = g.parent_id;
    const list = byParent.get(key);
    if (list) list.push(g);
    else byParent.set(key, [g]);
  }
  const ids = new Set(goals.map((g) => g.id));
  const build = (parent: string | null): GoalNode[] =>
    (byParent.get(parent) ?? []).map((goal) => ({
      goal,
      progress: goalProgress(goal),
      children: build(goal.id),
    }));

  // Orphans (parent archived or missing) are surfaced at the root, never hidden.
  const roots = build(null);
  const orphans = goals
    .filter((g) => g.parent_id !== null && !ids.has(g.parent_id))
    .map((goal) => ({ goal, progress: goalProgress(goal), children: build(goal.id) }));
  return [...roots, ...orphans];
}

/* ---------------------------------------------------------------- missions */

export async function primaryMission(): Promise<Mission | undefined> {
  return await get<Mission>(
      "SELECT * FROM missions WHERE kind = 'PRIMARY' AND status = 'ACTIVE' ORDER BY start_date DESC LIMIT 1",
    );
}

export async function listMissions(): Promise<Mission[]> {
  return await all<Mission>(
      `SELECT * FROM missions
      ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PLANNED' THEN 1 ELSE 2 END,
               kind, start_date DESC`,
    );
}

export async function getMission(id: string): Promise<Mission | undefined> {
  return await byId<Mission>("missions", id);
}

export async function missionMilestones(missionId: string): Promise<Milestone[]> {
  return await all<Milestone>("SELECT * FROM milestones WHERE mission_id = ? ORDER BY sort_order", [
      missionId,
    ]);
}

export async function missionKpis(missionId: string): Promise<MissionKpi[]> {
  return await all<MissionKpi>("SELECT * FROM mission_kpis WHERE mission_id = ? ORDER BY created_at", [
      missionId,
    ]);
}

export async function missionRisks(missionId: string): Promise<Risk[]> {
  return await all<Risk>(
      `SELECT * FROM risks WHERE mission_id = ?
      ORDER BY CASE status WHEN 'OPEN' THEN 0 ELSE 1 END,
        CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END`,
      [missionId],
    );
}

export async function missionProjects(missionId: string): Promise<Project[]> {
  return await all<Project>(
      `SELECT * FROM projects WHERE mission_id = ?
      ORDER BY CASE status WHEN 'BLOCKED' THEN 0 WHEN 'ACTIVE' THEN 1 WHEN 'PLANNED' THEN 2 ELSE 3 END,
               deadline`,
      [missionId],
    );
}

export async function missionTasks(missionId: string): Promise<Task[]> {
  return await all<Task>(
      "SELECT * FROM tasks WHERE mission_id = ? ORDER BY scheduled_date, sort_order",
      [missionId],
    );
}

export async function computeMissionProgress(mission: Mission, day: DayString = today()): Promise<MissionProgress> {
  const milestones = await missionMilestones(mission.id);
  const tasksTotal = await scalar(
      "SELECT COUNT(*) AS v FROM tasks WHERE mission_id = ? AND status <> 'CANCELLED'",
      [mission.id],
    );
  const tasksComplete = await scalar(
      "SELECT COUNT(*) AS v FROM tasks WHERE mission_id = ? AND status = 'COMPLETE'",
      [mission.id],
    );
  return missionProgress({
    milestones: milestones.map((m) => ({ weight: m.weight, status: m.status })),
    tasksTotal,
    tasksComplete,
    kpis: (await missionKpis(mission.id)).map((k) => ({
      current_value: k.current_value,
      target_value: k.target_value,
    })),
    startDate: mission.start_date,
    endDate: mission.end_date,
    today: day,
  });
}

/** Active projects that are not linked to the primary mission. */
export async function unalignedProjects(missionId: string | null): Promise<Project[]> {
  if (!missionId) {
    return await all<Project>("SELECT * FROM projects WHERE status IN ('ACTIVE','BLOCKED')");
  }
  return await all<Project>(
      "SELECT * FROM projects WHERE status IN ('ACTIVE','BLOCKED') AND (mission_id IS NULL OR mission_id <> ?)",
      [missionId],
    );
}

/* ---------------------------------------------------------------- projects */

export async function listProjects(filter: { status?: string; pillar?: string } = {}): Promise<Project[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.status) {
    clauses.push("status = ?");
    params.push(filter.status);
  }
  if (filter.pillar) {
    clauses.push("pillar = ?");
    params.push(filter.pillar);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return await all<Project>(
      `SELECT * FROM projects ${where}
      ORDER BY CASE status WHEN 'BLOCKED' THEN 0 WHEN 'ACTIVE' THEN 1 WHEN 'PLANNED' THEN 2
               WHEN 'COMPLETE' THEN 3 ELSE 4 END, deadline IS NULL, deadline`,
      params,
    );
}

export async function getProject(id: string): Promise<Project | undefined> {
  return await byId<Project>("projects", id);
}

export interface ProjectView extends Project {
  tasks: Task[];
  tasksComplete: number;
  tasksTotal: number;
  progress: number | null;
  risks: Risk[];
  blockers: Task[];
}

export async function projectView(id: string): Promise<ProjectView | undefined> {
  const project = await getProject(id);
  if (!project) return undefined;
  const tasks = await all<Task>(
      "SELECT * FROM tasks WHERE project_id = ? ORDER BY sort_order, created_at",
      [id],
    );
  const counted = tasks.filter((t) => t.status !== "CANCELLED");
  const complete = counted.filter((t) => t.status === "COMPLETE").length;
  return {
    ...project,
    tasks,
    tasksComplete: complete,
    tasksTotal: counted.length,
    progress: counted.length ? Math.round((complete / counted.length) * 1000) / 10 : null,
    risks: await all<Risk>("SELECT * FROM risks WHERE project_id = ? AND status = 'OPEN'", [id]),
    blockers: tasks.filter((t) => t.status === "BLOCKED"),
  };
}

export async function projectProgress(projectId: string): Promise<number | null> {
  const total = await scalar(
      "SELECT COUNT(*) AS v FROM tasks WHERE project_id = ? AND status <> 'CANCELLED'",
      [projectId],
    );
  if (total === 0) return null;
  const done = await scalar("SELECT COUNT(*) AS v FROM tasks WHERE project_id = ? AND status = 'COMPLETE'", [
      projectId,
    ]);
  return Math.round((done / total) * 1000) / 10;
}

/* ------------------------------------------------------------------- tasks */

export async function tasksForDay(day: DayString): Promise<Task[]> {
  return await all<Task>(
      `SELECT * FROM tasks
      WHERE scheduled_date = ?
      ORDER BY CASE priority WHEN 'MUST_WIN' THEN 0 WHEN 'SUPPORT' THEN 1 ELSE 2 END,
               sort_order, created_at`,
      [day],
    );
}

export async function openTasks(): Promise<Task[]> {
  return await all<Task>(
      `SELECT * FROM tasks WHERE status IN ('TODO','IN_PROGRESS','BLOCKED')
      ORDER BY CASE priority WHEN 'MUST_WIN' THEN 0 WHEN 'SUPPORT' THEN 1 ELSE 2 END,
               deadline IS NULL, deadline, sort_order`,
    );
}

export type TaskFlag = "OVERDUE" | "AT_RISK" | "BLOCKED" | "LOW_VALUE" | "UNLINKED";

export interface FlaggedTask {
  task: Task;
  flags: TaskFlag[];
}

/**
 * Identifies tasks that need intervention. "Low value" means the task is not
 * connected to any goal, mission or project — work that cannot pay off.
 */
export function flagTasks(tasks: readonly Task[], day: DayString = today()): FlaggedTask[] {
  const out: FlaggedTask[] = [];
  for (const task of tasks) {
    if (task.status === "COMPLETE" || task.status === "CANCELLED") continue;
    const flags: TaskFlag[] = [];
    if (task.deadline && task.deadline < day) flags.push("OVERDUE");
    else if (task.deadline && task.deadline === day && task.status === "TODO") flags.push("AT_RISK");
    if (task.status === "BLOCKED") flags.push("BLOCKED");
    if (!task.goal_id && !task.mission_id && !task.project_id) flags.push("UNLINKED");
    if (task.priority === "BACKLOG" && task.scheduled_date === day) flags.push("LOW_VALUE");
    if (flags.length) out.push({ task, flags });
  }
  return out;
}

export interface DayTasks {
  mustWin: Task | null;
  support: Task[];
  other: Task[];
  all: Task[];
  complete: number;
  total: number;
}

/** THE BIG 3 — one must-win, two support. Anything beyond is "other". */
export async function bigThree(day: DayString): Promise<DayTasks> {
  const tasks = await tasksForDay(day);
  const active = tasks.filter((t) => t.status !== "CANCELLED");
  const mustWin = active.find((t) => t.priority === "MUST_WIN") ?? null;
  const support = active.filter((t) => t.priority === "SUPPORT").slice(0, 2);
  const supportIds = new Set(support.map((t) => t.id));
  const other = active.filter(
    (t) => t.id !== mustWin?.id && !supportIds.has(t.id),
  );
  return {
    mustWin,
    support,
    other,
    all: active,
    complete: active.filter((t) => t.status === "COMPLETE").length,
    total: active.length,
  };
}

/** Guard against task accumulation: how loaded is this day already? */
export async function dayLoad(day: DayString): Promise<{ count: number; minutes: number; overloaded: boolean }> {
  const rows = (await tasksForDay(day)).filter(
    (t) => t.status !== "COMPLETE" && t.status !== "CANCELLED",
  );
  const minutes = rows.reduce((t, r) => t + (r.estimated_minutes ?? 45), 0);
  return { count: rows.length, minutes, overloaded: rows.length > 6 || minutes > 480 };
}
