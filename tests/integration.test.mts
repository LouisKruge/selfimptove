/**
 * End-to-end checks over a throwaway database: schema, services, server
 * actions, progression, personal records and score derivation.
 *
 * Run with `npm test`. The react-server condition makes the `server-only`
 * guard resolve to its no-op entry point outside Next; cache revalidation is
 * already a no-op without a request context.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

const dir = mkdtempSync(join(tmpdir(), "command-test-"));
process.env.COMMAND_DB_PATH = join(dir, "test.db");
process.env.COMMAND_TZ = "UTC";

const { db } = await import("@/lib/db");
const { insert } = await import("@/lib/db/repo");
const { today, addDays } = await import("@/lib/core/date");

after(() => {
  try {
    db().close();
  } catch {
    /* already closed */
  }
  rmSync(dir, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ setup */

const DAY = today();
let benchId = "";
let squatId = "";
let workoutId = "";

before(() => {
  benchId = insert("exercises", {
    name: "Barbell Bench Press",
    category: "STRENGTH",
    modality: "WEIGHT_REPS",
    muscle_group: "CHEST",
    is_compound: 1,
    default_rest_sec: 150,
    progression_rule: "DOUBLE_PROGRESSION",
    increment_kg: 2.5,
    archived: 0,
  });
  squatId = insert("exercises", {
    name: "Back Squat",
    category: "STRENGTH",
    modality: "WEIGHT_REPS",
    muscle_group: "LEGS",
    is_compound: 1,
    default_rest_sec: 180,
    progression_rule: "DOUBLE_PROGRESSION",
    increment_kg: 2.5,
    archived: 0,
  });
  workoutId = insert("workouts", {
    name: "PUSH A",
    type: "STRENGTH",
    focus: "Chest",
    est_minutes: 60,
    archived: 0,
  });
  insert("workout_exercises", {
    workout_id: workoutId,
    exercise_id: benchId,
    sort_order: 0,
    target_sets: 3,
    rep_min: 8,
    rep_max: 10,
    target_weight_kg: 90,
    rest_sec: 150,
  });
  insert("seasons", {
    name: "TEST",
    start_date: addDays(DAY, -30),
    status: "ACTIVE",
    weight_body: 25,
    weight_business: 30,
    weight_character: 25,
    weight_finance: 10,
    weight_learning: 10,
  });
});

/* -------------------------------------------------------------- database */

describe("database", () => {
  test("schema applies and enforces its constraints", () => {
    const conn = db();
    assert.equal(conn.pragma("foreign_keys", { simple: true }), 1);

    // RPE is bounded 1–10 by a CHECK constraint.
    assert.throws(() =>
      insert("workout_sets", {
        session_exercise_id: "x",
        session_id: "x",
        exercise_id: benchId,
        date: DAY,
        set_index: 1,
        reps: 5,
        rpe: 42,
      }),
    );
  });

  test("pillar weights must total 100", () => {
    assert.throws(() =>
      insert("seasons", {
        name: "BROKEN",
        start_date: DAY,
        status: "PLANNED",
        weight_body: 50,
        weight_business: 50,
        weight_character: 50,
        weight_finance: 0,
        weight_learning: 0,
      }),
    );
  });
});

/* -------------------------------------------------- training round trip */

describe("training", () => {
  let sessionId = "";

  test("scheduling a session snapshots the prescription", async () => {
    const { scheduleSession } = await import("@/lib/actions/training");
    const form = new FormData();
    form.set("workout_id", workoutId);
    form.set("date", DAY);

    const result = await scheduleSession(form);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    sessionId = result.data.id;

    const { sessionDetail } = await import("@/lib/services/body");
    const detail = sessionDetail(sessionId);
    assert.ok(detail);
    assert.equal(detail.exercises.length, 1);
    assert.equal(detail.exercises[0].sessionExercise.target_weight_kg, 90);
    // No history yet, so the target comes from the template, not the engine.
    assert.equal(detail.exercises[0].progression.source, "TEMPLATE");
  });

  test("logging a set rejects an empty entry and accepts a real one", async () => {
    const { logSet } = await import("@/lib/actions/training");
    const { sessionDetail } = await import("@/lib/services/body");
    const sx = sessionDetail(sessionId)!.exercises[0].sessionExercise;

    const empty = new FormData();
    empty.set("session_exercise_id", sx.id);
    const bad = await logSet(empty);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.match(bad.error, /Log reps, time or distance/);

    for (const reps of [10, 10, 10]) {
      const form = new FormData();
      form.set("session_exercise_id", sx.id);
      form.set("weight_kg", "90");
      form.set("reps", String(reps));
      form.set("rpe", "8");
      const ok = await logSet(form);
      assert.equal(ok.ok, true);
    }

    const after = sessionDetail(sessionId)!;
    assert.equal(after.completedSets, 3);
    assert.equal(after.volumeKg, 2700);
    // Logging a set moves a planned session into progress.
    assert.equal(after.session.status, "IN_PROGRESS");
  });

  test("completing the session detects records and no more", async () => {
    const { completeSession } = await import("@/lib/actions/training");
    const form = new FormData();
    form.set("id", sessionId);
    form.set("duration_min", "62");
    form.set("session_rpe", "8");

    const result = await completeSession(form);
    assert.equal(result.ok, true);
    // The very first session is a baseline, so nothing counts as a record yet.
    if (result.ok) assert.equal(result.data.records.length, 0);
  });

  test("the next session's target comes from the engine, not the template", async () => {
    const { scheduleSession } = await import("@/lib/actions/training");
    const { sessionDetail } = await import("@/lib/services/body");

    const form = new FormData();
    form.set("workout_id", workoutId);
    form.set("date", addDays(DAY, 2));
    const result = await scheduleSession(form);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const detail = sessionDetail(result.data.id)!;
    const first = detail.exercises[0];
    assert.equal(first.progression.source, "PROGRESSION");
    // 3 × 10 at 90kg cleared the 8–10 range, so the load moves up one increment.
    assert.equal(first.sessionExercise.target_weight_kg, 92.5);
    assert.equal(first.progression.increased, true);
    assert.ok(first.last);
  });

  test("beating history records a personal record", async () => {
    const { logSet, completeSession, scheduleSession } = await import("@/lib/actions/training");
    const { sessionDetail } = await import("@/lib/services/body");

    const form = new FormData();
    form.set("workout_id", workoutId);
    form.set("date", addDays(DAY, 4));
    const created = await scheduleSession(form);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const sx = sessionDetail(created.data.id)!.exercises[0].sessionExercise;
    for (const reps of [9, 9, 9]) {
      const set = new FormData();
      set.set("session_exercise_id", sx.id);
      set.set("weight_kg", "95");
      set.set("reps", String(reps));
      await logSet(set);
    }

    const done = new FormData();
    done.set("id", created.data.id);
    const result = await completeSession(done);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const kinds = result.data.records.map((r) => r.kind).sort();
    // 3 × 9 @ 95kg beats the load and the estimated 1RM, but 2,565kg of volume
    // is below the previous 2,700kg — so no volume record is awarded.
    assert.deepEqual(kinds, ["E1RM", "WEIGHT"]);
    const weightPr = result.data.records.find((r) => r.kind === "WEIGHT");
    assert.equal(weightPr?.value, 95);
    assert.equal(weightPr?.previous, 90);
  });

  test("exercise history reflects every logged session", async () => {
    const { exerciseHistory } = await import("@/lib/services/body");
    const history = exerciseHistory(benchId)!;
    assert.equal(history.totalSessions, 2);
    assert.equal(history.bestWeightKg, 95);
    assert.equal(history.bestVolumeKg, 2700);
    assert.equal(history.records.length, 2);
  });

  test("an exercise never trained reports nothing rather than zero", async () => {
    const { exerciseHistory } = await import("@/lib/services/body");
    const history = exerciseHistory(squatId)!;
    assert.equal(history.totalSessions, 0);
    assert.equal(history.bestWeightKg, null);
    assert.equal(history.bestE1RM, null);
  });
});

/* ----------------------------------------------------------------- tasks */

describe("tasks", () => {
  test("only one must-win can exist on a day", async () => {
    const { createTask } = await import("@/lib/actions/plan");
    const { bigThree } = await import("@/lib/services/core");

    for (const title of ["First must-win", "Second must-win"]) {
      const form = new FormData();
      form.set("title", title);
      form.set("priority", "MUST_WIN");
      form.set("scheduled_date", DAY);
      form.set("pillar", "BUSINESS");
      const result = await createTask(form);
      assert.equal(result.ok, true);
    }

    const day = bigThree(DAY);
    assert.equal(day.mustWin?.title, "Second must-win");
    assert.equal(day.all.filter((t) => t.priority === "MUST_WIN").length, 1);
  });

  test("completing a task is reflected immediately", async () => {
    const { toggleTask } = await import("@/lib/actions/plan");
    const { bigThree } = await import("@/lib/services/core");

    const mustWin = bigThree(DAY).mustWin!;
    await toggleTask(mustWin.id);
    assert.equal(bigThree(DAY).mustWin?.status, "COMPLETE");
  });
});

/* ----------------------------------------------------- scores and pillars */

describe("scoring", () => {
  test("a day with logged work scores, an empty day does not", async () => {
    const { recomputeDayScore, storedScore } = await import("@/lib/services/scores");

    recomputeDayScore(DAY);
    const scored = storedScore(DAY);
    assert.ok(scored);
    assert.notEqual(scored.body, null, "training was logged, so body must score");
    assert.notEqual(scored.business, null, "a must-win existed, so business must score");

    // A day the user never touched is not a failed day — it is an unknown one.
    const emptyDay = addDays(DAY, -25);
    recomputeDayScore(emptyDay);
    const empty = storedScore(emptyDay)!;
    assert.equal(empty.body, null);
    assert.equal(empty.business, null);
    assert.equal(empty.character, null);
    assert.equal(empty.finance, null);
    assert.equal(empty.learning, null);
    assert.equal(empty.overall, null, "a day with nothing logged has no overall score");
  });

  test("the score breakdown explains itself", async () => {
    const { computeDayScore } = await import("@/lib/services/scores");
    const result = computeDayScore(DAY);
    const training = result.body.components.find((c) => c.key === "training");
    assert.ok(training);
    assert.match(training.detail, /session/);
  });
});

/* -------------------------------------------------------------- business */

describe("business", () => {
  test("a lead's stage history is the only source of conversion", async () => {
    const { createLead, moveLeadStage } = await import("@/lib/actions/money");
    const { pipeline } = await import("@/lib/services/business");

    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const form = new FormData();
      form.set("company", `Prospect ${i}`);
      form.set("potential", "5000");
      form.set("stage", "PROSPECT");
      const result = await createLead(form);
      assert.equal(result.ok, true);
      if (result.ok) ids.push(result.data.id);
    }

    // Two of four advance — a 50% recorded conversion.
    await moveLeadStage(ids[0], "CONTACTED");
    await moveLeadStage(ids[1], "CONTACTED");

    const p = pipeline();
    const first = p.conversions[0];
    assert.equal(first.from, "PROSPECT");
    assert.equal(first.rate, 50);
    assert.equal(first.sufficient, true);

    // Downstream stages have too few leads to state a rate.
    assert.equal(p.conversions[1].rate, null);
  });

  test("reaching CUSTOMER creates the customer record", async () => {
    const { createLead, moveLeadStage } = await import("@/lib/actions/money");
    const { listCustomers } = await import("@/lib/services/business");

    const form = new FormData();
    form.set("company", "Closes Fast");
    form.set("potential", "8000");
    const created = await createLead(form);
    assert.equal(created.ok, true);
    if (!created.ok) return;

    await moveLeadStage(created.data.id, "CUSTOMER");
    const customer = listCustomers().find((c) => c.name === "Closes Fast");
    assert.ok(customer);
    assert.equal(customer.mrr_cents, 800000);
    assert.equal(customer.status, "ACTIVE");
  });
});

/* --------------------------------------------------------------- finance */

describe("finance", () => {
  test("the forecast projects from scheduled items only", async () => {
    const { upsertAccount, upsertScheduled } = await import("@/lib/actions/money");
    const { forecast, cashOnHandCents } = await import("@/lib/services/finance");

    const account = new FormData();
    account.set("name", "Cheque");
    account.set("kind", "CASH");
    account.set("balance", "5000");
    account.set("include_in_cash", "on");
    assert.equal((await upsertAccount(account)).ok, true);
    assert.equal(cashOnHandCents(), 500000);

    const rent = new FormData();
    rent.set("name", "Rent");
    rent.set("direction", "OUT");
    rent.set("amount", "8000");
    rent.set("cadence", "MONTHLY");
    rent.set("day_of_month", "1");
    assert.equal((await upsertScheduled(rent)).ok, true);

    const f = forecast(60, DAY);
    assert.ok(f.totalOutCents > 0);
    assert.ok(f.shortfall, "a R8,000 rent against R5,000 cash must project a shortfall");
  });

  test("a monthly item without a day of month is rejected", async () => {
    const { upsertScheduled } = await import("@/lib/actions/money");
    const form = new FormData();
    form.set("name", "Broken");
    form.set("direction", "OUT");
    form.set("amount", "100");
    form.set("cadence", "MONTHLY");
    const result = await upsertScheduled(form);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /day of the month/);
  });
});

/* ------------------------------------------------------------- character */

describe("character", () => {
  test("the impulse firewall blocks a decision inside its cooling period", async () => {
    const { createDecision, decide } = await import("@/lib/actions/self");

    const form = new FormData();
    form.set("title", "Borrow to fund ads");
    form.set("reversibility", "COSTLY");
    form.set("involves_borrowing", "on");
    form.set("amount", "20000");
    const created = await createDecision(form);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.data.level, "RED");

    const attempt = new FormData();
    attempt.set("id", created.data.id);
    attempt.set("decision", "Doing it anyway");
    const blocked = await decide(attempt);
    assert.equal(blocked.ok, false, "a cooling decision must not be recordable");
    if (!blocked.ok) assert.match(blocked.error, /Cooling period is still running/);
  });

  test("habits are capped at eight and promises only count once resolved", async () => {
    const { createHabit, createPromise, resolvePromise } = await import("@/lib/actions/self");
    const { promiseRate } = await import("@/lib/services/character");

    for (let i = 0; i < 8; i++) {
      const form = new FormData();
      form.set("name", `Habit ${i}`);
      form.set("target_per_week", "5");
      assert.equal((await createHabit(form)).ok, true);
    }
    const ninth = new FormData();
    ninth.set("name", "Habit 9");
    const rejected = await createHabit(ninth);
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.match(rejected.error, /ceiling/);

    const promise = new FormData();
    promise.set("text", "Train at 18:00");
    promise.set("date", DAY);
    assert.equal((await createPromise(promise)).ok, true);
    assert.equal(promiseRate(30, DAY).rate, null, "an open promise is not counted");

    const open = db()
      .prepare("SELECT id FROM promises WHERE status = 'OPEN' LIMIT 1")
      .get() as { id: string };
    await resolvePromise(open.id, "KEPT");
    assert.equal(promiseRate(30, DAY).rate, 100);
  });
});

/* ------------------------------------------------------------------ ideas */

describe("ideas", () => {
  test("an idea cannot be activated until it is researched, validated and scored", async () => {
    const { captureIdea, updateIdea, activateIdea } = await import("@/lib/actions/self");

    const capture = new FormData();
    capture.set("title", "A promising idea");
    const created = await captureIdea(capture);
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const id = created.data.id;

    const blocked = await activateIdea(id);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.match(blocked.error, /Research it/);

    const scored = new FormData();
    scored.set("id", id);
    scored.set("research_notes", "Talked to nine people.");
    scored.set("validation_notes", "Three pre-paid.");
    for (const [k, v] of [
      ["score_potential", "9"],
      ["score_difficulty", "3"],
      ["score_cost", "2"],
      ["score_speed", "8"],
      ["score_fit", "9"],
      ["score_advantage", "7"],
    ]) {
      scored.set(k, v);
    }
    assert.equal((await updateIdea(scored)).ok, true);

    const promoted = await activateIdea(id);
    assert.equal(promoted.ok, true);
    if (!promoted.ok) return;

    const project = db()
      .prepare("SELECT title, status FROM projects WHERE id = ?")
      .get(promoted.data.projectId) as { title: string; status: string };
    assert.equal(project.title, "A promising idea");
    assert.equal(project.status, "PLANNED");
  });
});

/* ---------------------------------------------------------------- search */

describe("search", () => {
  test("finds entities by name and ignores very short queries", async () => {
    const { search } = await import("@/lib/services/search");
    assert.deepEqual(search("a"), []);
    const results = search("bench");
    assert.ok(results.some((r) => r.type === "Exercise" && r.title === "Barbell Bench Press"));
  });
});
