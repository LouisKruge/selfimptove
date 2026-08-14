"use server";

import { refreshPaths } from "./revalidate";
import { get, run, scalar } from "@/lib/db";
import { insert, remove, update } from "@/lib/db/repo";
import { nowIso, today } from "@/lib/core/date";
import { PILLARS } from "@/lib/types";
import {
  checkbox,
  dayString,
  dayWithDefault,
  fail,
  formObject,
  id,
  ok,
  optionalDay,
  optionalInt,
  optionalNumber,
  optionalText,
  parseWith,
  randToCents,
  requiredText,
  z,
  type ActionResult,
} from "./shared";
import { recomputeDayScore } from "@/lib/services/scores";

const pillar = z.enum(PILLARS);

function refresh(...paths: string[]) {
  refreshPaths(["/", "/today", "/missions", "/goals", ...paths]);
}

/* ------------------------------------------------------------------ TASKS */

const taskSchema = z.object({
  title: requiredText,
  description: optionalText,
  expected_outcome: optionalText,
  pillar: pillar.default("BUSINESS"),
  priority: z.enum(["MUST_WIN", "SUPPORT", "BACKLOG"]).default("SUPPORT"),
  scheduled_date: optionalDay,
  deadline: optionalDay,
  estimated_minutes: optionalInt,
  project_id: optionalText,
  mission_id: optionalText,
  goal_id: optionalText,
});

export async function createTask(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(taskSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  // Only one must-win per day: an existing one is demoted to support.
  if (v.priority === "MUST_WIN" && v.scheduled_date) {
    await run(
      `UPDATE tasks SET priority = 'SUPPORT', updated_at = ?
          WHERE scheduled_date = ? AND priority = 'MUST_WIN' AND status <> 'CANCELLED'`,
      [nowIso(), v.scheduled_date],
    );
  }

  const newId = await insert("tasks", {
      title: v.title,
      description: v.description ?? null,
      expected_outcome: v.expected_outcome ?? null,
      pillar: v.pillar,
      priority: v.priority,
      scheduled_date: v.scheduled_date ?? null,
      deadline: v.deadline ?? null,
      estimated_minutes: v.estimated_minutes ?? null,
      project_id: v.project_id ?? null,
      mission_id: v.mission_id ?? null,
      goal_id: v.goal_id ?? null,
      status: "TODO",
      sort_order: await scalar("SELECT COALESCE(MAX(sort_order), 0) + 1 AS v FROM tasks"),
    });

  if (v.scheduled_date) await recomputeDayScore(v.scheduled_date);
  refresh();
  return ok({ id: newId });
}

const taskUpdateSchema = taskSchema.partial().extend({
  id,
  actual_minutes: optionalInt,
  blocked_reason: optionalText,
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETE", "CANCELLED"]).optional(),
});

export async function updateTask(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(taskUpdateSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const { id: taskId, ...rest } = parsed.value;

  const existing = await get<{ scheduled_date: string | null }>(
      "SELECT scheduled_date FROM tasks WHERE id = ?",
      [taskId],
    );
  if (!existing) return fail("Task not found.");

  const patch: Record<string, unknown> = { ...rest };
  if (rest.status === "COMPLETE") patch.completed_at = nowIso();
  if (rest.status && rest.status !== "COMPLETE") patch.completed_at = null;
  if (rest.status && rest.status !== "BLOCKED") patch.blocked_reason = null;

  await update("tasks", taskId, patch);

  const days = [existing.scheduled_date, rest.scheduled_date].filter(
    (d): d is string => typeof d === "string",
  );
  for (const d of days) await recomputeDayScore(d);
  refresh();
  return ok();
}

export async function setTaskStatus(taskId: string, status: string): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "COMPLETE", "CANCELLED"]),
    }),
    { id: taskId, status },
  );
  if (!parsed.ok) return parsed.result;

  const existing = await get<{ scheduled_date: string | null }>(
      "SELECT scheduled_date FROM tasks WHERE id = ?",
      [taskId],
    );
  if (!existing) return fail("Task not found.");

  await update("tasks", taskId, {
        status: parsed.value.status,
        completed_at: parsed.value.status === "COMPLETE" ? nowIso() : null,
      });
  await recomputeDayScore(existing.scheduled_date ?? today());
  refresh();
  return ok();
}

export async function toggleTask(taskId: string): Promise<ActionResult> {
  const row = await get<{ status: string; scheduled_date: string | null }>(
      "SELECT status, scheduled_date FROM tasks WHERE id = ?",
      [taskId],
    );
  if (!row) return fail("Task not found.");
  const next = row.status === "COMPLETE" ? "TODO" : "COMPLETE";
  await update("tasks", taskId, {
        status: next,
        completed_at: next === "COMPLETE" ? nowIso() : null,
      });
  await recomputeDayScore(row.scheduled_date ?? today());
  refresh();
  return ok();
}

export async function rescheduleTask(taskId: string, date: string): Promise<ActionResult> {
  const parsed = parseWith(z.object({ id, date: dayString }), { id: taskId, date });
  if (!parsed.ok) return parsed.result;
  const row = await get<{ scheduled_date: string | null }>(
      "SELECT scheduled_date FROM tasks WHERE id = ?",
      [taskId],
    );
  await update("tasks", taskId, { scheduled_date: parsed.value.date });
  if (row?.scheduled_date) await recomputeDayScore(row.scheduled_date);
  await recomputeDayScore(parsed.value.date);
  refresh();
  return ok();
}

/**
 * Delegation keeps the outcome visible without keeping the work. The task stays
 * linked to its goal and mission, but it stops competing for your own hours.
 */
export async function delegateTask(taskId: string, to: string): Promise<ActionResult> {
  const parsed = parseWith(z.object({ id, to: requiredText }), { id: taskId, to });
  if (!parsed.ok) return parsed.result;

  const row = await get<{ scheduled_date: string | null }>(
      "SELECT scheduled_date FROM tasks WHERE id = ?",
      [taskId],
    );
  if (!row) return fail("Task not found.");

  await update("tasks", taskId, { delegated_to: parsed.value.to, priority: "SUPPORT" });
  if (row.scheduled_date) await recomputeDayScore(row.scheduled_date);
  refresh();
  return ok();
}

export async function undelegateTask(taskId: string): Promise<ActionResult> {
  const row = await get<{ scheduled_date: string | null }>(
      "SELECT scheduled_date FROM tasks WHERE id = ?",
      [taskId],
    );
  if (!row) return fail("Task not found.");
  await update("tasks", taskId, { delegated_to: null });
  if (row.scheduled_date) await recomputeDayScore(row.scheduled_date);
  refresh();
  return ok();
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const row = await get<{ scheduled_date: string | null }>(
      "SELECT scheduled_date FROM tasks WHERE id = ?",
      [taskId],
    );
  await remove("tasks", taskId);
  if (row?.scheduled_date) await recomputeDayScore(row.scheduled_date);
  refresh();
  return ok();
}

/** Turns a task that has outgrown itself into a project, carrying the link. */
export async function convertTaskToProject(taskId: string): Promise<ActionResult<{ id: string }>> {
  const task = await get<{
      title: string;
      description: string | null;
      expected_outcome: string | null;
      pillar: string;
      mission_id: string | null;
      goal_id: string | null;
      deadline: string | null;
    }>("SELECT * FROM tasks WHERE id = ?", [taskId]);
  if (!task) return fail("Task not found.");

  const projectId = await insert("projects", {
      title: task.title,
      objective: task.description,
      expected_outcome: task.expected_outcome,
      pillar: task.pillar,
      mission_id: task.mission_id,
      goal_id: task.goal_id,
      deadline: task.deadline,
      status: "ACTIVE",
    });
  await update("tasks", taskId, { status: "CANCELLED", project_id: projectId });
  refresh("/business/projects");
  return ok({ id: projectId });
}

/* ------------------------------------------------------------------ GOALS */

const goalSchema = z.object({
  title: requiredText,
  why: optionalText,
  horizon: z.enum(["VISION", "THREE_YEAR", "ONE_YEAR", "QUARTER", "MONTH", "WEEK"]),
  pillar,
  kpi: optionalText,
  unit: optionalText,
  start_value: optionalNumber,
  current_value: optionalNumber,
  target_value: optionalNumber,
  direction: z.enum(["UP", "DOWN"]).default("UP"),
  deadline: optionalDay,
  parent_id: optionalText,
  next_action: optionalText,
});

export async function createGoal(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(goalSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const newId = await insert("goals", {
      title: v.title,
      why: v.why ?? null,
      horizon: v.horizon,
      pillar: v.pillar,
      kpi: v.kpi ?? null,
      unit: v.unit ?? null,
      start_value: v.start_value ?? v.current_value ?? null,
      current_value: v.current_value ?? null,
      target_value: v.target_value ?? null,
      direction: v.direction,
      deadline: v.deadline ?? null,
      parent_id: v.parent_id ?? null,
      next_action: v.next_action ?? null,
      status: "ACTIVE",
      sort_order: await scalar("SELECT COALESCE(MAX(sort_order), 0) + 1 AS v FROM goals"),
    });
  refresh();
  return ok({ id: newId });
}

export async function updateGoal(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    goalSchema.partial().extend({
      id,
      status: z.enum(["ACTIVE", "ACHIEVED", "MISSED", "PAUSED", "ARCHIVED"]).optional(),
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { id: goalId, ...rest } = parsed.value;

  if (rest.parent_id === goalId) return fail("A goal cannot be its own parent.");

  const patch: Record<string, unknown> = { ...rest };
  if (rest.status === "ACHIEVED") patch.completed_at = nowIso();
  await update("goals", goalId, patch);
  refresh(`/goals/${goalId}`);
  return ok();
}

export async function setGoalValue(goalId: string, value: number): Promise<ActionResult> {
  const parsed = parseWith(z.object({ id, value: z.number().finite() }), { id: goalId, value });
  if (!parsed.ok) return parsed.result;
  await update("goals", goalId, { current_value: parsed.value.value });
  refresh(`/goals/${goalId}`);
  return ok();
}

export async function deleteGoal(goalId: string): Promise<ActionResult> {
  await remove("goals", goalId);
  refresh();
  return ok();
}

/* --------------------------------------------------------------- MISSIONS */

const missionSchema = z.object({
  title: requiredText,
  objective: optionalText,
  why: optionalText,
  kind: z.enum(["PRIMARY", "SECONDARY"]).default("PRIMARY"),
  start_date: dayWithDefault,
  end_date: dayString,
  target_value: optionalNumber,
  current_value: optionalNumber,
  unit: optionalText,
  goal_id: optionalText,
  season_id: optionalText,
});

export async function createMission(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(missionSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if (v.end_date < v.start_date) return fail("The end date cannot be before the start date.");

  // Only ONE primary mission may be active. Any existing one is stood down.
  if (v.kind === "PRIMARY") {
    const existing = await get<{ id: string }>(
          "SELECT id FROM missions WHERE kind = 'PRIMARY' AND status = 'ACTIVE'",
        );
    if (existing) await update("missions", existing.id, { kind: "SECONDARY" });
  }

  const newId = await insert("missions", {
      title: v.title,
      objective: v.objective ?? null,
      why: v.why ?? null,
      kind: v.kind,
      start_date: v.start_date,
      end_date: v.end_date,
      target_value: v.target_value ?? null,
      current_value: v.current_value ?? null,
      unit: v.unit ?? null,
      goal_id: v.goal_id ?? null,
      season_id: v.season_id ?? null,
      status: "ACTIVE",
    });
  refresh(`/missions/${newId}`);
  return ok({ id: newId });
}

export async function updateMission(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    missionSchema.partial().extend({
      id,
      status: z.enum(["PLANNED", "ACTIVE", "COMPLETE", "FAILED", "ABANDONED"]).optional(),
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { id: missionId, ...rest } = parsed.value;

  if (rest.kind === "PRIMARY" && (rest.status ?? "ACTIVE") === "ACTIVE") {
    const existing = await get<{ id: string }>(
          "SELECT id FROM missions WHERE kind = 'PRIMARY' AND status = 'ACTIVE' AND id <> ?",
          [missionId],
        );
    if (existing) await update("missions", existing.id, { kind: "SECONDARY" });
  }

  const patch: Record<string, unknown> = { ...rest };
  if (rest.status === "COMPLETE") patch.completed_at = nowIso();
  await update("missions", missionId, patch);
  refresh(`/missions/${missionId}`);
  return ok();
}

export async function promoteMission(missionId: string): Promise<ActionResult> {
  const mission = await get<{ id: string }>("SELECT id FROM missions WHERE id = ?", [missionId]);
  if (!mission) return fail("Mission not found.");
  const existing = await get<{ id: string }>(
      "SELECT id FROM missions WHERE kind = 'PRIMARY' AND status = 'ACTIVE' AND id <> ?",
      [missionId],
    );
  if (existing) await update("missions", existing.id, { kind: "SECONDARY" });
  await update("missions", missionId, { kind: "PRIMARY", status: "ACTIVE" });
  refresh(`/missions/${missionId}`);
  return ok();
}

export async function deleteMission(missionId: string): Promise<ActionResult> {
  await remove("missions", missionId);
  refresh();
  return ok();
}

/* ------------------------------------------------------------- MILESTONES */

export async function createMilestone(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      mission_id: id,
      title: requiredText,
      description: optionalText,
      target_date: optionalDay,
      weight: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  await insert("milestones", {
        mission_id: v.mission_id,
        title: v.title,
        description: v.description ?? null,
        target_date: v.target_date ?? null,
        weight: v.weight ?? 1,
        status: "PENDING",
        sort_order: await scalar(
                  "SELECT COALESCE(MAX(sort_order), 0) + 1 AS v FROM milestones WHERE mission_id = ?",
                  [v.mission_id],
                ),
      });
  refresh(`/missions/${v.mission_id}`);
  return ok();
}

export async function setMilestoneStatus(
  milestoneId: string,
  status: string,
): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ id, status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETE", "SKIPPED"]) }),
    { id: milestoneId, status },
  );
  if (!parsed.ok) return parsed.result;
  const row = await get<{ mission_id: string }>("SELECT mission_id FROM milestones WHERE id = ?", [
      milestoneId,
    ]);
  if (!row) return fail("Milestone not found.");
  await update("milestones", milestoneId, {
        status: parsed.value.status,
        completed_at: parsed.value.status === "COMPLETE" ? nowIso() : null,
      });
  refresh(`/missions/${row.mission_id}`);
  return ok();
}

export async function deleteMilestone(milestoneId: string): Promise<ActionResult> {
  const row = await get<{ mission_id: string }>("SELECT mission_id FROM milestones WHERE id = ?", [
      milestoneId,
    ]);
  await remove("milestones", milestoneId);
  if (row) refresh(`/missions/${row.mission_id}`);
  return ok();
}

/* ----------------------------------------------------------- MISSION KPIs */

export async function createMissionKpi(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      mission_id: id,
      name: requiredText,
      unit: optionalText,
      current_value: optionalNumber,
      target_value: optionalNumber,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  await insert("mission_kpis", {
        mission_id: v.mission_id,
        name: v.name,
        unit: v.unit ?? null,
        current_value: v.current_value ?? null,
        target_value: v.target_value ?? null,
      });
  refresh(`/missions/${v.mission_id}`);
  return ok();
}

export async function updateMissionKpi(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ id, current_value: optionalNumber, target_value: optionalNumber }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const row = await get<{ mission_id: string }>("SELECT mission_id FROM mission_kpis WHERE id = ?", [
      parsed.value.id,
    ]);
  await update("mission_kpis", parsed.value.id, {
        current_value: parsed.value.current_value,
        target_value: parsed.value.target_value,
      });
  if (row) refresh(`/missions/${row.mission_id}`);
  return ok();
}

export async function deleteMissionKpi(kpiId: string): Promise<ActionResult> {
  const row = await get<{ mission_id: string }>("SELECT mission_id FROM mission_kpis WHERE id = ?", [
      kpiId,
    ]);
  await remove("mission_kpis", kpiId);
  if (row) refresh(`/missions/${row.mission_id}`);
  return ok();
}

/* ------------------------------------------------------------------ RISKS */

export async function createRisk(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      mission_id: optionalText,
      project_id: optionalText,
      title: requiredText,
      detail: optionalText,
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
      likelihood: z.enum(["UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"]).default("POSSIBLE"),
      mitigation: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  await insert("risks", {
        mission_id: v.mission_id ?? null,
        project_id: v.project_id ?? null,
        title: v.title,
        detail: v.detail ?? null,
        severity: v.severity,
        likelihood: v.likelihood,
        mitigation: v.mitigation ?? null,
        status: "OPEN",
      });
  refresh(v.mission_id ? `/missions/${v.mission_id}` : "/business/projects");
  return ok();
}

export async function setRiskStatus(riskId: string, status: string): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ id, status: z.enum(["OPEN", "MITIGATED", "ACCEPTED", "CLOSED"]) }),
    { id: riskId, status },
  );
  if (!parsed.ok) return parsed.result;
  await update("risks", riskId, { status: parsed.value.status });
  refresh("/business/projects");
  return ok();
}

export async function deleteRisk(riskId: string): Promise<ActionResult> {
  await remove("risks", riskId);
  refresh("/business/projects");
  return ok();
}

/* --------------------------------------------------------------- PROJECTS */

const projectSchema = z.object({
  title: requiredText,
  objective: optionalText,
  expected_outcome: optionalText,
  pillar: pillar.default("BUSINESS"),
  revenue_impact: randToCents,
  cost: randToCents,
  deadline: optionalDay,
  mission_id: optionalText,
  goal_id: optionalText,
  business_id: optionalText,
  next_action: optionalText,
});

export async function createProject(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(projectSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  const newId = await insert("projects", {
      title: v.title,
      objective: v.objective ?? null,
      expected_outcome: v.expected_outcome ?? null,
      pillar: v.pillar,
      revenue_impact: v.revenue_impact ?? null,
      cost: v.cost ?? null,
      deadline: v.deadline ?? null,
      mission_id: v.mission_id ?? null,
      goal_id: v.goal_id ?? null,
      business_id: v.business_id ?? null,
      next_action: v.next_action ?? null,
      status: "ACTIVE",
    });
  refresh("/business/projects", `/business/projects/${newId}`);
  return ok({ id: newId });
}

export async function updateProject(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    projectSchema.partial().extend({
      id,
      status: z.enum(["PLANNED", "ACTIVE", "BLOCKED", "COMPLETE", "CANCELLED"]).optional(),
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { id: projectId, ...rest } = parsed.value;
  const patch: Record<string, unknown> = { ...rest };
  if (rest.status === "COMPLETE") patch.completed_at = nowIso();
  await update("projects", projectId, patch);
  refresh("/business/projects", `/business/projects/${projectId}`);
  return ok();
}

export async function setProjectStatus(projectId: string, status: string): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ id, status: z.enum(["PLANNED", "ACTIVE", "BLOCKED", "COMPLETE", "CANCELLED"]) }),
    { id: projectId, status },
  );
  if (!parsed.ok) return parsed.result;
  await update("projects", projectId, {
        status: parsed.value.status,
        completed_at: parsed.value.status === "COMPLETE" ? nowIso() : null,
      });
  refresh("/business/projects", `/business/projects/${projectId}`);
  return ok();
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  await remove("projects", projectId);
  refresh("/business/projects");
  return ok();
}

/* ---------------------------------------------------------------- SEASONS */

export async function createSeason(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      name: requiredText,
      objective: optionalText,
      why: optionalText,
      start_date: dayWithDefault,
      end_date: optionalDay,
      weight_body: optionalInt,
      weight_business: optionalInt,
      weight_character: optionalInt,
      weight_finance: optionalInt,
      weight_learning: optionalInt,
      activate: checkbox,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const weights = {
    weight_body: v.weight_body ?? 25,
    weight_business: v.weight_business ?? 30,
    weight_character: v.weight_character ?? 25,
    weight_finance: v.weight_finance ?? 10,
    weight_learning: v.weight_learning ?? 10,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total !== 100) return fail(`Pillar weights must total 100. They currently total ${total}.`);

  if (v.activate) {
    await run("UPDATE seasons SET status = 'CLOSED', updated_at = ? WHERE status = 'ACTIVE'", [
      nowIso(),
    ]);
  }

  await insert("seasons", {
        name: v.name,
        objective: v.objective ?? null,
        why: v.why ?? null,
        start_date: v.start_date,
        end_date: v.end_date ?? null,
        status: v.activate ? "ACTIVE" : "PLANNED",
        ...weights,
      });
  refresh("/settings");
  return ok();
}

export async function updateSeason(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      name: optionalText,
      objective: optionalText,
      end_date: optionalDay,
      weight_body: optionalInt,
      weight_business: optionalInt,
      weight_character: optionalInt,
      weight_finance: optionalInt,
      weight_learning: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { id: seasonId, ...rest } = parsed.value;

  const current = await get<Record<string, number>>("SELECT * FROM seasons WHERE id = ?", [seasonId]);
  if (!current) return fail("Season not found.");

  const weights = {
    weight_body: rest.weight_body ?? current.weight_body,
    weight_business: rest.weight_business ?? current.weight_business,
    weight_character: rest.weight_character ?? current.weight_character,
    weight_finance: rest.weight_finance ?? current.weight_finance,
    weight_learning: rest.weight_learning ?? current.weight_learning,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total !== 100) return fail(`Pillar weights must total 100. They currently total ${total}.`);

  await update("seasons", seasonId, { ...rest, ...weights });
  await recomputeDayScore(today());
  refresh("/settings");
  return ok();
}

export async function activateSeason(seasonId: string): Promise<ActionResult> {
  const season = await get<{ id: string }>("SELECT id FROM seasons WHERE id = ?", [seasonId]);
  if (!season) return fail("Season not found.");
  await run("UPDATE seasons SET status = 'CLOSED', updated_at = ? WHERE status = 'ACTIVE'", [
    nowIso(),
  ]);
  await update("seasons", seasonId, { status: "ACTIVE" });
  await recomputeDayScore(today());
  refresh("/settings");
  return ok();
}
