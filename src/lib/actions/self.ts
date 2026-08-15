"use server";

import { refreshPaths } from "./revalidate";
import { get, scalar } from "@/lib/db";
import { insert, remove, update } from "@/lib/db/repo";
import { nowIso, today } from "@/lib/core/date";
import { PILLARS } from "@/lib/types";
import { classifyDecision, coolingUntil, coolingState } from "@/lib/domain/firewall";
import { canActivate } from "@/lib/domain/ideas";
import {
  checkbox,
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
  requiredLongText,
  requiredText,
  z,
  type ActionResult,
} from "./shared";
import { recomputeDayScore } from "@/lib/services/scores";
import { getIdea } from "@/lib/services/growth";
import { getSettingNumber } from "@/lib/services/core";

const pillar = z.enum(PILLARS);

function refresh(...paths: string[]) {
  refreshPaths(["/", "/today", "/character", ...paths]);
}

/* ----------------------------------------------------------------- HABITS */

export async function createHabit(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      name: requiredText,
      pillar: pillar.default("CHARACTER"),
      description: optionalText,
      target_per_week: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const target = v.target_per_week ?? 7;
  if (target < 1 || target > 7) return fail("Target frequency must be between 1 and 7 per week.");

  // Core habits are deliberately few — more than eight is not a system.
  const active = await scalar("SELECT COUNT(*) AS v FROM habits WHERE active = 1");
  if (active >= 8) {
    return fail(
      "Eight active habits is the ceiling. Retire one before adding another — a longer list is not a stronger system.",
    );
  }

  await insert("habits", {
        name: v.name,
        pillar: v.pillar,
        description: v.description ?? null,
        target_per_week: target,
        active: 1,
        sort_order: active + 1,
      });
  refresh("/character/habits");
  return ok();
}

export async function updateHabit(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      name: optionalText,
      pillar: pillar.optional(),
      description: optionalText,
      target_per_week: optionalInt,
      active: checkbox,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { id: habitId, active, ...rest } = parsed.value;
  if (rest.target_per_week !== undefined && (rest.target_per_week < 1 || rest.target_per_week > 7)) {
    return fail("Target frequency must be between 1 and 7 per week.");
  }
  await update("habits", habitId, {
        ...rest,
        active: form.has("active") ? (active ? 1 : 0) : undefined,
      });
  refresh("/character/habits");
  return ok();
}

export async function toggleHabit(habitId: string, date: string): Promise<ActionResult> {
  const parsed = parseWith(z.object({ id, date: dayWithDefault }), { id: habitId, date });
  if (!parsed.ok) return parsed.result;
  const day = parsed.value.date;

  const existing = await get<{ id: string; done: number }>(
      "SELECT id, done FROM habit_logs WHERE habit_id = ? AND date = ?",
      [habitId, day],
    );
  if (existing) {
    if (existing.done === 1) await remove("habit_logs", existing.id);
    else await update("habit_logs", existing.id, { done: 1 });
  } else {
    await insert("habit_logs", { habit_id: habitId, date: day, done: 1 });
  }

  await recomputeDayScore(day);
  refresh("/character/habits");
  return ok();
}

export async function deleteHabit(habitId: string): Promise<ActionResult> {
  await remove("habits", habitId);
  await recomputeDayScore(today());
  refresh("/character/habits");
  return ok();
}

/* --------------------------------------------------------------- PROMISES */

export async function createPromise(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      text: requiredText,
      pillar: pillar.default("CHARACTER"),
      date: dayWithDefault,
      due_time: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if (v.due_time && !/^\d{1,2}:\d{2}$/.test(v.due_time)) {
    return fail("Use a 24-hour time such as 18:00.");
  }

  await insert("promises", {
        text: v.text,
        pillar: v.pillar,
        date: v.date,
        due_time: v.due_time ?? null,
        status: "OPEN",
      });
  await recomputeDayScore(v.date);
  refresh();
  return ok();
}

export async function resolvePromise(promiseId: string, status: string): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ id, status: z.enum(["OPEN", "KEPT", "BROKEN", "MODIFIED"]) }),
    { id: promiseId, status },
  );
  if (!parsed.ok) return parsed.result;

  const row = await get<{ date: string }>("SELECT date FROM promises WHERE id = ?", [promiseId]);
  if (!row) return fail("Promise not found.");

  await update("promises", promiseId, {
        status: parsed.value.status,
        resolved_at: parsed.value.status === "OPEN" ? null : nowIso(),
      });
  await recomputeDayScore(row.date);
  refresh();
  return ok();
}

export async function deletePromise(promiseId: string): Promise<ActionResult> {
  const row = await get<{ date: string }>("SELECT date FROM promises WHERE id = ?", [promiseId]);
  await remove("promises", promiseId);
  if (row) await recomputeDayScore(row.date);
  refresh();
  return ok();
}

/* -------------------------------------------------------------- DECISIONS */

/**
 * Creating a decision runs it through the impulse firewall. The classification
 * sets a cooling period the user cannot shorten from this screen.
 */
export async function createDecision(form: FormData): Promise<ActionResult<{ id: string; level: string }>> {
  const parsed = parseWith(
    z.object({
      title: requiredText,
      problem: optionalText,
      objective: optionalText,
      pillar: pillar.default("LIFE"),
      reversibility: z.enum(["REVERSIBLE", "COSTLY", "IRREVERSIBLE"]).default("REVERSIBLE"),
      emotional_state: optionalText,
      emotional_intensity: optionalInt,
      amount: randToCents,
      involves_borrowing: checkbox,
      is_business_pivot: checkbox,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if (
    v.emotional_intensity !== undefined &&
    (v.emotional_intensity < 1 || v.emotional_intensity > 5)
  ) {
    return fail("Emotional intensity must be between 1 and 5.");
  }

  const verdict = classifyDecision({
    amountCents: v.amount ?? null,
    reversibility: v.reversibility,
    emotionalIntensity: v.emotional_intensity ?? null,
    involvesBorrowing: v.involves_borrowing,
    isBusinessPivot: v.is_business_pivot,
    majorSpendCents: await getSettingNumber("major_spend_cents", 500_000),
  });

  const until = coolingUntil(verdict.level);
  const decisionId = await insert("decisions", {
      title: v.title,
      problem: v.problem ?? null,
      objective: v.objective ?? null,
      pillar: v.pillar,
      level: verdict.level,
      reversibility: v.reversibility,
      emotional_state: v.emotional_state ?? null,
      emotional_intensity: v.emotional_intensity ?? null,
      amount_cents: v.amount ?? null,
      cooling_until: until,
      status: until === null ? "READY" : "COOLING",
    });

  await insert("notes", {
        title: "Firewall classification",
        body: verdict.reasons.join("\n"),
        pillar: v.pillar,
        entity_type: "decision",
        entity_id: decisionId,
      });

  refresh("/character/decisions", `/character/decisions/${decisionId}`);
  return ok({ id: decisionId, level: verdict.level });
}

export async function addDecisionOption(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      decision_id: id,
      label: requiredText,
      upside: optionalText,
      downside: optionalText,
      probability: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if (v.probability !== undefined && (v.probability < 0 || v.probability > 100)) {
    return fail("Probability must be between 0 and 100.");
  }
  await insert("decision_options", {
        decision_id: v.decision_id,
        label: v.label,
        upside: v.upside ?? null,
        downside: v.downside ?? null,
        probability: v.probability ?? null,
        chosen: 0,
        sort_order: await scalar(
                  "SELECT COALESCE(MAX(sort_order), 0) + 1 AS v FROM decision_options WHERE decision_id = ?",
                  [v.decision_id],
                ),
      });
  refresh(`/character/decisions/${v.decision_id}`);
  return ok();
}

export async function deleteDecisionOption(optionId: string): Promise<ActionResult> {
  const row = await get<{ decision_id: string }>(
      "SELECT decision_id FROM decision_options WHERE id = ?",
      [optionId],
    );
  await remove("decision_options", optionId);
  if (row) refresh(`/character/decisions/${row.decision_id}`);
  return ok();
}

export async function decide(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ id, decision: requiredLongText, option_id: optionalText }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const row = await get<{ cooling_until: string | null; status: string }>(
      "SELECT cooling_until, status FROM decisions WHERE id = ?",
      [v.id],
    );
  if (!row) return fail("Decision not found.");

  // The firewall is the point — a cooling period cannot be skipped.
  const cooling = coolingState(row.cooling_until);
  if (!cooling.released) {
    return fail(`Cooling period is still running — ${cooling.label}. This is deliberate.`);
  }

  await update("decisions", v.id, {
        decision: v.decision,
        status: "DECIDED",
        decided_at: nowIso(),
      });
  if (v.option_id) {
    await update("decision_options", v.option_id, { chosen: 1 });
  }
  refresh(`/character/decisions/${v.id}`);
  return ok();
}

export async function recordDecisionOutcome(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ id, outcome: requiredLongText, outcome_rating: optionalInt, lesson: optionalText }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if (v.outcome_rating !== undefined && (v.outcome_rating < 1 || v.outcome_rating > 5)) {
    return fail("Rate the outcome from 1 to 5.");
  }
  await update("decisions", v.id, {
        outcome: v.outcome,
        outcome_rating: v.outcome_rating ?? null,
        outcome_recorded_at: nowIso(),
        lesson: v.lesson ?? null,
      });
  refresh(`/character/decisions/${v.id}`);
  return ok();
}

export async function abandonDecision(decisionId: string): Promise<ActionResult> {
  await update("decisions", decisionId, { status: "ABANDONED" });
  refresh("/character/decisions", `/character/decisions/${decisionId}`);
  return ok();
}

export async function deleteDecision(decisionId: string): Promise<ActionResult> {
  await remove("decisions", decisionId);
  refresh("/character/decisions");
  return ok();
}

/* --------------------------------------------------------------- LEARNING */

export async function upsertSkill(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id: optionalText,
      name: requiredText,
      why: optionalText,
      current_level: optionalInt,
      target_level: optionalInt,
      evidence: optionalText,
      active: checkbox,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const current = v.current_level ?? 1;
  const target = v.target_level ?? 8;
  if (current < 0 || current > 10 || target < 0 || target > 10) {
    return fail("Skill levels are on a 0–10 scale.");
  }

  const values = {
    name: v.name,
    why: v.why ?? null,
    current_level: current,
    target_level: target,
    evidence: v.evidence ?? null,
    active: form.has("active") ? (v.active ? 1 : 0) : 1,
  };
  if (v.id) await update("skills", v.id, values);
  else {
    const clash = await get<{ id: string }>("SELECT id FROM skills WHERE name = ?", [v.name]);
    if (clash) return fail(`A skill called "${v.name}" already exists.`);
    await insert("skills", values);
  }
  refreshPaths(["/learning"]);
  return ok();
}

export async function deleteSkill(skillId: string): Promise<ActionResult> {
  await remove("skills", skillId);
  refreshPaths(["/learning"]);
  return ok();
}

export async function logLearning(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      skill_id: optionalText,
      title: requiredText,
      source: optionalText,
      kind: z.enum(["STUDY", "PRACTICE", "APPLICATION", "TEST"]).default("STUDY"),
      date: dayWithDefault,
      minutes: optionalInt,
      what_i_learned: optionalText,
      why_it_matters: optionalText,
      how_i_will_apply: optionalText,
      result: optionalText,
      applied: checkbox,
      revenue: randToCents,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if ((v.minutes ?? 0) < 0) return fail("Minutes cannot be negative.");

  await insert("learning_items", {
        skill_id: v.skill_id ?? null,
        title: v.title,
        source: v.source ?? null,
        kind: v.kind,
        date: v.date,
        minutes: v.minutes ?? 0,
        what_i_learned: v.what_i_learned ?? null,
        why_it_matters: v.why_it_matters ?? null,
        how_i_will_apply: v.how_i_will_apply ?? null,
        result: v.result ?? null,
        applied: v.applied || v.kind === "APPLICATION" ? 1 : 0,
        applied_at: v.applied || v.kind === "APPLICATION" ? nowIso() : null,
        revenue_cents: v.revenue ?? null,
      });

  await recomputeDayScore(v.date);
  refreshPaths(["/learning"]);
  refreshPaths(["/"]);
  return ok();
}

export async function markLearningApplied(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ id, result: optionalText, revenue: randToCents }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const row = await get<{ date: string }>("SELECT date FROM learning_items WHERE id = ?", [
      parsed.value.id,
    ]);
  if (!row) return fail("Learning item not found.");

  await update("learning_items", parsed.value.id, {
        applied: 1,
        applied_at: nowIso(),
        result: parsed.value.result,
        revenue_cents: parsed.value.revenue,
      });
  await recomputeDayScore(row.date);
  refreshPaths(["/learning"]);
  return ok();
}

export async function deleteLearningItem(itemId: string): Promise<ActionResult> {
  const row = await get<{ date: string }>("SELECT date FROM learning_items WHERE id = ?", [itemId]);
  await remove("learning_items", itemId);
  if (row) await recomputeDayScore(row.date);
  refreshPaths(["/learning"]);
  return ok();
}

/* ------------------------------------------------------------------ IDEAS */

export async function captureIdea(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(
    z.object({ title: requiredText, summary: optionalText }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const ideaId = await insert("ideas", {
      title: parsed.value.title,
      summary: parsed.value.summary ?? null,
      stage: "CAPTURE",
    });
  refreshPaths(["/ideas"]);
  return ok({ id: ideaId });
}

export async function updateIdea(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      title: optionalText,
      summary: optionalText,
      stage: z
        .enum(["CAPTURE", "RESEARCH", "VALIDATE", "SCORED", "PARKED", "ACTIVE", "KILLED"])
        .optional(),
      research_notes: optionalText,
      validation_notes: optionalText,
      score_potential: optionalInt,
      score_difficulty: optionalInt,
      score_cost: optionalInt,
      score_speed: optionalInt,
      score_fit: optionalInt,
      score_advantage: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { id: ideaId, ...rest } = parsed.value;

  for (const [key, value] of Object.entries(rest)) {
    if (key.startsWith("score_") && typeof value === "number" && (value < 1 || value > 10)) {
      return fail("Scores are on a 1–10 scale.");
    }
  }

  await update("ideas", ideaId, rest);
  refreshPaths(["/ideas"]);
  refreshPaths([`/ideas/${ideaId}`]);
  return ok();
}

/**
 * Promotion is always deliberate and always gated: an idea must be researched,
 * validated and fully scored before it can consume attention as a project.
 */
export async function activateIdea(ideaId: string): Promise<ActionResult<{ projectId: string }>> {
  const idea = await getIdea(ideaId);
  if (!idea) return fail("Idea not found.");

  const gate = canActivate(idea);
  if (!gate.ok) return fail(gate.reason);

  const projectId = await insert("projects", {
      title: idea.title,
      objective: idea.summary,
      expected_outcome: idea.validation_notes,
      pillar: "BUSINESS",
      status: "PLANNED",
    });
  await update("ideas", ideaId, {
        stage: "ACTIVE",
        activated_at: nowIso(),
        promoted_project_id: projectId,
      });
  refreshPaths(["/ideas"]);
  refreshPaths(["/business/projects"]);
  return ok({ projectId });
}

export async function setIdeaStage(ideaId: string, stage: string): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      stage: z.enum(["CAPTURE", "RESEARCH", "VALIDATE", "SCORED", "PARKED", "ACTIVE", "KILLED"]),
    }),
    { id: ideaId, stage },
  );
  if (!parsed.ok) return parsed.result;
  if (parsed.value.stage === "ACTIVE") {
    return fail("Use Activate — promoting an idea is a deliberate step, not a stage change.");
  }
  await update("ideas", ideaId, { stage: parsed.value.stage });
  refreshPaths(["/ideas"]);
  refreshPaths([`/ideas/${ideaId}`]);
  return ok();
}

export async function deleteIdea(ideaId: string): Promise<ActionResult> {
  await remove("ideas", ideaId);
  refreshPaths(["/ideas"]);
  return ok();
}

/* ------------------------------------------------------------------ NOTES */

export async function createNote(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      title: optionalText,
      body: requiredText,
      pillar: optionalText,
      entity_type: optionalText,
      entity_id: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  await insert("notes", {
        title: v.title ?? null,
        body: v.body,
        pillar: v.pillar ?? null,
        entity_type: v.entity_type ?? null,
        entity_id: v.entity_id ?? null,
      });
  refreshPaths(["/ideas"]);
  return ok();
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  await remove("notes", noteId);
  refreshPaths(["/ideas"]);
  return ok();
}
