import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addDays,
  daysBetween,
  diffDays,
  endOfMonth,
  endOfWeek,
  formatCommandDate,
  isValidDay,
  isoWeekKey,
  startOfWeek,
} from "@/lib/core/date";
import { money, moneyCompact, duration, pace, distance, humanize } from "@/lib/core/format";
import { clamp, pctChange, progressPct, roundToIncrement, slope, weightedAverage } from "@/lib/domain/stats";
import { computeProgression, formatTarget } from "@/lib/domain/progression";
import { estimate1RM, summariseSets } from "@/lib/domain/strength";
import {
  DEFAULT_WEIGHTS,
  bandAdherence,
  overallScore,
  scoreBody,
  scoreBusiness,
  scoreCharacter,
  scoreFinance,
  scoreLearning,
} from "@/lib/domain/scoring";
import { trajectory, metricTrajectory } from "@/lib/domain/trajectory";
import { analyseBalance } from "@/lib/domain/balance";
import { forecastCash, occurrences } from "@/lib/domain/forecast";
import { analysePipeline, planToTarget, rankNextActions } from "@/lib/domain/pipeline";
import { analyseNutritionTrend } from "@/lib/domain/nutrition";
import { assessReadiness } from "@/lib/domain/recovery";
import { analyseLoad, sessionLoad } from "@/lib/domain/load";
import { classifyDecision, coolingState } from "@/lib/domain/firewall";
import { canActivate, scoreIdea } from "@/lib/domain/ideas";
import { missionProgress, progressBar } from "@/lib/domain/mission";
import { habitConsistency, promiseStats, decisionQuality } from "@/lib/domain/character";
import { analyseIntervals, paceSecPerKm } from "@/lib/domain/running";
import { analyseSimulation, projectRaceTime, stationProfiles } from "@/lib/domain/hyrox";
import type { WorkoutSet, RunInterval, ScheduledCashItem, Idea } from "@/lib/types";

/* ------------------------------------------------------------------ dates */

test("date: day arithmetic and validation", () => {
  assert.equal(addDays("2026-08-12", 1), "2026-08-13");
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(diffDays("2026-08-12", "2026-08-01"), 11);
  assert.equal(isValidDay("2026-02-30"), false);
  assert.equal(isValidDay("2026-02-28"), true);
  assert.equal(isValidDay("not-a-day"), false);
  assert.equal(daysBetween("2026-08-10", "2026-08-12").length, 3);
  assert.equal(daysBetween("2026-08-12", "2026-08-10").length, 0);
});

test("date: week and month boundaries are Monday-anchored", () => {
  // 2026-08-12 is a Wednesday.
  assert.equal(startOfWeek("2026-08-12"), "2026-08-10");
  assert.equal(endOfWeek("2026-08-12"), "2026-08-16");
  assert.equal(startOfWeek("2026-08-10"), "2026-08-10");
  assert.equal(startOfWeek("2026-08-16"), "2026-08-10");
  assert.equal(endOfMonth("2026-02-05"), "2026-02-28");
  assert.equal(endOfMonth("2024-02-05"), "2024-02-29");
  assert.equal(endOfMonth("2026-12-01"), "2026-12-31");
});

test("date: ISO week keys handle year boundaries", () => {
  assert.equal(isoWeekKey("2026-01-01"), "2026-W01");
  assert.equal(isoWeekKey("2026-08-12"), "2026-W33");
  assert.equal(isoWeekKey("2027-01-01"), "2026-W53");
});

test("date: command header format", () => {
  assert.equal(formatCommandDate("2026-08-12"), "WEDNESDAY · 12 AUGUST");
});

/* ----------------------------------------------------------------- format */

test("format: money never shows fabricated values", () => {
  assert.equal(money(15_000_000), "R150,000");
  assert.equal(money(null), "—");
  assert.equal(money(-500_00), "−R500");
  assert.equal(moneyCompact(150_000_00), "R150k");
  assert.equal(moneyCompact(1_250_000_00), "R1.3m");
  assert.equal(moneyCompact(84_000), "R840");
});

test("format: durations, paces and distances", () => {
  assert.equal(duration(330), "5:30");
  assert.equal(duration(4530), "1:15:30");
  assert.equal(duration(null), "—");
  assert.equal(pace(270), "4:30/km");
  assert.equal(pace(0), "—");
  assert.equal(distance(800), "800m");
  assert.equal(distance(8000), "8km");
  assert.equal(humanize("MUST_WIN"), "Must Win");
});

/* ------------------------------------------------------------------ stats */

test("stats: pctChange refuses to divide by a zero baseline", () => {
  assert.equal(pctChange(0, 50), null);
  assert.equal(pctChange(100, 150), 50);
  assert.equal(pctChange(100, 50), -50);
});

test("stats: progress honours goal direction", () => {
  assert.equal(progressPct({ start: 0, current: 50, target: 100 }), 50);
  assert.equal(progressPct({ start: 100, current: 80, target: 60, direction: "DOWN" }), 50);
  assert.equal(progressPct({ start: 0, current: 200, target: 100 }), 100);
  assert.equal(progressPct({ start: 0, current: null, target: 100 }), null);
  assert.equal(progressPct({ start: 0, current: 5, target: null }), null);
});

test("stats: weighted average drops null components", () => {
  assert.equal(weightedAverage([{ value: 100, weight: 50 }, { value: null, weight: 50 }]), 100);
  assert.equal(weightedAverage([{ value: null, weight: 1 }]), null);
  assert.equal(weightedAverage([{ value: 80, weight: 1 }, { value: 40, weight: 1 }]), 60);
});

test("stats: slope needs three points and rounds loads to increments", () => {
  assert.equal(slope([1, 2]), null);
  assert.equal(slope([1, 2, 3, 4]), 1);
  assert.equal(roundToIncrement(91.3, 2.5), 92.5);
  assert.equal(roundToIncrement(90, 2.5), 90);
  assert.equal(clamp(150, 0, 100), 100);
});

/* ------------------------------------------------------------ progression */

const EX = { progression_rule: "DOUBLE_PROGRESSION" as const, increment_kg: 2.5, modality: "WEIGHT_REPS" as const };
const RX = { target_sets: 3, rep_min: 8, rep_max: 10, target_weight_kg: 90 };

function set(i: number, weight: number, reps: number): WorkoutSet {
  return {
    id: `s${i}`,
    session_exercise_id: "sx",
    session_id: "sess",
    exercise_id: "ex",
    date: "2026-08-05",
    set_index: i,
    weight_kg: weight,
    reps,
    seconds: null,
    distance_m: null,
    rpe: null,
    rir: null,
    is_warmup: 0,
    notes: null,
    created_at: "",
    updated_at: "",
  };
}

test("progression: never invents a target without history", () => {
  const r = computeProgression(EX, RX, null);
  assert.equal(r.source, "TEMPLATE");
  assert.equal(r.weightKg, 90);
  assert.match(r.rationale, /No previous performance/);
});

test("progression: double progression holds load until the range is cleared", () => {
  const first = computeProgression(EX, RX, {
    date: "2026-08-05",
    sets: [set(1, 90, 10), set(2, 90, 9), set(3, 90, 8)],
  });
  assert.equal(first.weightKg, 90);
  assert.equal(first.increased, false);
  assert.deepEqual(first.perSetReps, [10, 10, 9]);

  const second = computeProgression(EX, RX, {
    date: "2026-08-08",
    sets: [set(1, 90, 10), set(2, 90, 10), set(3, 90, 9)],
  });
  assert.equal(second.weightKg, 90);
  assert.deepEqual(second.perSetReps, [10, 10, 10]);

  const third = computeProgression(EX, RX, {
    date: "2026-08-11",
    sets: [set(1, 90, 10), set(2, 90, 10), set(3, 90, 10)],
  });
  assert.equal(third.weightKg, 92.5);
  assert.equal(third.increased, true);
  assert.equal(third.repMin, 8);
  assert.equal(third.repMax, 10);
});

test("progression: an incomplete set count does not trigger a load increase", () => {
  const r = computeProgression(EX, RX, {
    date: "2026-08-11",
    sets: [set(1, 90, 10), set(2, 90, 10)],
  });
  assert.equal(r.weightKg, 90);
  assert.equal(r.increased, false);
});

test("progression: warmups are excluded", () => {
  const warm = { ...set(0, 60, 12), is_warmup: 1 };
  const r = computeProgression(EX, RX, {
    date: "2026-08-11",
    sets: [warm, set(1, 90, 10), set(2, 90, 10), set(3, 90, 10)],
  });
  assert.equal(r.weightKg, 92.5);
});

test("progression: linear rule adds load on completion", () => {
  const r = computeProgression(
    { ...EX, progression_rule: "LINEAR" },
    { ...RX, rep_min: 5, rep_max: 5 },
    { date: "2026-08-11", sets: [set(1, 100, 5), set(2, 100, 5), set(3, 100, 5)] },
  );
  assert.equal(r.weightKg, 102.5);
});

test("progression: NONE returns the template untouched", () => {
  const r = computeProgression({ ...EX, progression_rule: "NONE" }, RX, {
    date: "2026-08-11",
    sets: [set(1, 90, 10), set(2, 90, 10), set(3, 90, 10)],
  });
  assert.equal(r.weightKg, 90);
  assert.equal(r.increased, false);
});

test("progression: bodyweight work progresses reps, not load", () => {
  const r = computeProgression(
    { ...EX, modality: "BODYWEIGHT_REPS" },
    { target_sets: 3, rep_min: 6, rep_max: 10, target_weight_kg: null },
    { date: "2026-08-11", sets: [set(1, 0, 10), set(2, 0, 10), set(3, 0, 10)] },
  );
  assert.equal(r.repMax, 12);
  assert.equal(r.increased, true);
});

test("progression: target formatting", () => {
  assert.equal(formatTarget({ weightKg: 92.5, repMin: 8, repMax: 10 }), "92.5kg × 8–10");
  assert.equal(formatTarget({ repMin: 10, repMax: 10 }), "10 reps");
  assert.equal(formatTarget({}), "No target");
});

/* --------------------------------------------------------------- strength */

test("strength: e1RM is bounded to a meaningful rep range", () => {
  assert.equal(estimate1RM(100, 1), 103.3);
  assert.equal(estimate1RM(100, 5), 116.7);
  assert.equal(estimate1RM(100, 20), null);
  assert.equal(estimate1RM(0, 5), null);
});

test("strength: set summary ignores warmups", () => {
  const s = summariseSets([{ ...set(0, 60, 10), is_warmup: 1 }, set(1, 100, 5), set(2, 100, 4)]);
  assert.equal(s.workingSets.length, 2);
  assert.equal(s.volumeKg, 900);
  assert.equal(s.topWeightKg, 100);
  assert.equal(s.totalReps, 9);
});

/* ---------------------------------------------------------------- scoring */

test("scoring: a pillar with no data scores null, not zero", () => {
  const body = scoreBody({
    plannedSessions: 0,
    completedSessions: 0,
    skippedSessions: 0,
    isRestDay: false,
    proteinG: null,
    proteinTargetG: 180,
    calories: null,
    calorieTarget: 3000,
    sleepHours: null,
    sleepTargetHours: 8,
  });
  assert.equal(body.score, null);
});

test("scoring: body combines training, nutrition and sleep", () => {
  const body = scoreBody({
    plannedSessions: 1,
    completedSessions: 1,
    skippedSessions: 0,
    isRestDay: false,
    proteinG: 180,
    proteinTargetG: 180,
    calories: 3000,
    calorieTarget: 3000,
    sleepHours: 8,
    sleepTargetHours: 8,
  });
  assert.equal(body.score, 100);

  const missed = scoreBody({
    plannedSessions: 1,
    completedSessions: 0,
    skippedSessions: 1,
    isRestDay: false,
    proteinG: 90,
    proteinTargetG: 180,
    calories: 3000,
    calorieTarget: 3000,
    sleepHours: 8,
    sleepTargetHours: 8,
  });
  assert.ok(missed.score !== null && missed.score < 50);
});

test("scoring: a respected rest day counts as executed training", () => {
  const body = scoreBody({
    plannedSessions: 0,
    completedSessions: 0,
    skippedSessions: 0,
    isRestDay: true,
    proteinG: null,
    proteinTargetG: null,
    calories: null,
    calorieTarget: null,
    sleepHours: null,
    sleepTargetHours: 8,
  });
  assert.equal(body.score, 100);
});

test("scoring: band adherence punishes both directions", () => {
  assert.equal(bandAdherence(3000, 3000), 100);
  assert.equal(bandAdherence(3100, 3000, 0.08), 100);
  assert.ok((bandAdherence(4000, 3000, 0.08) ?? 100) < 50);
  assert.ok((bandAdherence(2000, 3000, 0.08) ?? 100) < 50);
});

test("scoring: business ignores pipeline activity when there is no pipeline", () => {
  const s = scoreBusiness({
    mustWinScheduled: 1,
    mustWinComplete: 1,
    supportScheduled: 2,
    supportComplete: 2,
    pipelineTouchesToday: 0,
    openLeads: 0,
    revenueTodayCents: 0,
    deepWorkMinutes: null,
  });
  assert.equal(s.score, 100);
  assert.equal(s.components.find((c) => c.key === "pipeline")?.value, null);
});

test("scoring: character promise rate and habits", () => {
  const s = scoreCharacter({
    promisesKept: 6,
    promisesBroken: 1,
    promisesOpen: 0,
    habitsDue: 5,
    habitsDone: 5,
    reviewCompleted: true,
  });
  assert.ok(s.score !== null && s.score > 85);
});

test("scoring: finance flags a projected shortfall as zero cash safety", () => {
  const s = scoreFinance({
    projectedLowCents: -100_00,
    bufferTargetCents: 10_000_00,
    debtNowCents: 50_000_00,
    debtPriorCents: 52_000_00,
    incomeCents: 40_000_00,
    expensesCents: 35_000_00,
    savingsRateTarget: 0.2,
  });
  assert.equal(s.components.find((c) => c.key === "runway")?.value, 0);
});

test("scoring: learning rewards application over consumption", () => {
  const consumer = scoreLearning({
    activeDays7: 5,
    targetDaysPerWeek: 5,
    minutes7: 300,
    targetMinutesPerWeek: 300,
    applied30: 0,
    total30: 20,
  });
  const applier = scoreLearning({
    activeDays7: 3,
    targetDaysPerWeek: 5,
    minutes7: 180,
    targetMinutesPerWeek: 300,
    applied30: 8,
    total30: 10,
  });
  assert.ok(applier.score !== null && consumer.score !== null);
  assert.ok(applier.score > consumer.score);
});

test("scoring: overall renormalises around missing pillars", () => {
  assert.equal(overallScore({ BODY: 80, BUSINESS: 80 }, DEFAULT_WEIGHTS), 80);
  assert.equal(overallScore({}, DEFAULT_WEIGHTS), null);
  const mixed = overallScore({ BODY: 100, BUSINESS: 0 }, DEFAULT_WEIGHTS);
  assert.equal(mixed, 45.5);
});

/* ------------------------------------------------------------- trajectory */

test("trajectory: refuses a verdict on thin data", () => {
  const t = trajectory([70, 72, null]);
  assert.equal(t.trend, null);
  assert.match(t.detail, /Needs 4 scored days/);
});

test("trajectory: detects direction", () => {
  assert.equal(trajectory([50, 60, 70, 80, 90]).trend, "UP");
  assert.equal(trajectory([90, 80, 70, 60, 50]).trend, "DOWN");
  assert.equal(trajectory([70, 70, 70, 70, 70]).trend, "FLAT");
});

test("trajectory: metric series uses a relative threshold", () => {
  assert.equal(metricTrajectory([100, 100, 101, 100]).trend, "FLAT");
  assert.equal(metricTrajectory([100, 110, 120, 130]).trend, "UP");
});

/* ---------------------------------------------------------------- balance */

test("balance: names the trade-off when one pillar rises as another falls", () => {
  const r = analyseBalance([
    { pillar: "BUSINESS", score: 95, trend: "UP" },
    { pillar: "BODY", score: 43, trend: "DOWN" },
    { pillar: "CHARACTER", score: 51, trend: "DOWN" },
  ]);
  assert.equal(r.spread, 52);
  assert.equal(r.strongest?.pillar, "BUSINESS");
  assert.equal(r.weakest?.pillar, "BODY");
  assert.ok(r.findings.some((f) => f.headline.includes("traded")));
  assert.ok(r.findings.some((f) => f.detail.includes("Business")));
});

/* --------------------------------------------------------------- forecast */

function sched(over: Partial<ScheduledCashItem>): ScheduledCashItem {
  return {
    id: "x",
    name: "Item",
    direction: "OUT",
    amount_cents: 1000_00,
    cadence: "MONTHLY",
    day_of_month: 1,
    day_of_week: null,
    next_date: null,
    category: null,
    debt_id: null,
    active: 1,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

test("forecast: monthly items clamp to the last day of short months", () => {
  const days = occurrences(sched({ day_of_month: 31 }), "2026-01-01", "2026-03-31");
  assert.deepEqual(days, ["2026-01-31", "2026-02-28", "2026-03-31"]);
});

test("forecast: weekly items fire on the right weekday", () => {
  const days = occurrences(
    sched({ cadence: "WEEKLY", day_of_week: 1, day_of_month: null }),
    "2026-08-10",
    "2026-08-24",
  );
  assert.deepEqual(days, ["2026-08-10", "2026-08-17", "2026-08-24"]);
});

test("forecast: projects a balance and surfaces the shortfall date", () => {
  const r = forecastCash({
    openingCents: 5_000_00,
    from: "2026-08-01",
    horizonDays: 30,
    items: [
      sched({ id: "rent", name: "Rent", direction: "OUT", amount_cents: 8_000_00, day_of_month: 5 }),
      sched({ id: "pay", name: "Salary", direction: "IN", amount_cents: 20_000_00, day_of_month: 25 }),
    ],
  });
  assert.equal(r.shortfall?.date, "2026-08-05");
  assert.equal(r.shortfall?.amountCents, 3_000_00);
  assert.equal(r.closingCents, 17_000_00);
  assert.equal(r.lowestCents, -3_000_00);
});

test("forecast: no scheduled items leaves the balance flat", () => {
  const r = forecastCash({ openingCents: 1000_00, from: "2026-08-01", horizonDays: 7, items: [] });
  assert.equal(r.closingCents, 1000_00);
  assert.equal(r.shortfall, null);
  assert.equal(r.days.length, 7);
});

/* --------------------------------------------------------------- pipeline */

test("pipeline: conversion is null below the minimum sample", () => {
  const events = [
    { lead_id: "a", to_stage: "PROSPECT" },
    { lead_id: "b", to_stage: "PROSPECT" },
    { lead_id: "a", to_stage: "CONTACTED" },
  ];
  const r = analysePipeline(
    [
      { stage: "CONTACTED", potential_cents: 5000_00, probability: 20 },
      { stage: "PROSPECT", potential_cents: 5000_00, probability: 10 },
    ],
    events,
  );
  assert.equal(r.conversions[0].rate, null);
  assert.equal(r.conversions[0].sufficient, false);
});

test("pipeline: conversion computed from recorded stage history", () => {
  const events = [
    ...["a", "b", "c", "d"].map((l) => ({ lead_id: l, to_stage: "PROSPECT" })),
    ...["a", "b"].map((l) => ({ lead_id: l, to_stage: "CONTACTED" })),
  ];
  const r = analysePipeline([], events);
  assert.equal(r.conversions[0].rate, 50);
  assert.equal(r.conversions[0].sufficient, true);
});

test("pipeline: target plan refuses to back-solve on unknown rates", () => {
  const plan = planToTarget({
    targetMrrCents: 150_000_00,
    avgDealCents: 5_000_00,
    currentCustomers: 0,
    conversions: [],
  });
  assert.equal(plan.customersRequired, 30);
  assert.equal(plan.steps.find((s) => s.stage === "PROPOSAL")?.required, null);
  assert.match(plan.note, /Conversion is unknown/);
});

test("pipeline: target plan works backward through known rates", () => {
  const conversions = [
    { from: "PROSPECT" as const, to: "CONTACTED" as const, rate: 50, reached: 10, advanced: 5, sufficient: true },
    { from: "CONTACTED" as const, to: "RESPONDED" as const, rate: 50, reached: 10, advanced: 5, sufficient: true },
    { from: "RESPONDED" as const, to: "MEETING" as const, rate: 50, reached: 10, advanced: 5, sufficient: true },
    { from: "MEETING" as const, to: "PROPOSAL" as const, rate: 50, reached: 10, advanced: 5, sufficient: true },
    { from: "PROPOSAL" as const, to: "CUSTOMER" as const, rate: 25, reached: 10, advanced: 3, sufficient: true },
  ];
  const plan = planToTarget({
    targetMrrCents: 150_000_00,
    avgDealCents: 5_000_00,
    currentCustomers: 2,
    conversions,
  });
  assert.equal(plan.customersRequired, 30);
  assert.equal(plan.customerGap, 28);
  assert.equal(plan.steps.find((s) => s.stage === "PROPOSAL")?.required, 120);
  assert.equal(plan.steps.find((s) => s.stage === "MEETING")?.required, 240);
  assert.equal(plan.steps.find((s) => s.stage === "PROSPECT")?.required, 1920);
  assert.equal(plan.missing.length, 0);
});

test("pipeline: highest-value action ranks overdue big deals first", () => {
  const ranked = rankNextActions(
    [
      {
        id: "small",
        company: "Small",
        stage: "PROPOSAL",
        potential_cents: 10_000_00,
        probability: 90,
        next_action: "Follow up",
        next_action_date: "2026-08-20",
        last_contact_date: "2026-08-10",
      },
      {
        id: "big",
        company: "Big",
        stage: "PROPOSAL",
        potential_cents: 50_000_00,
        probability: 40,
        next_action: "Send proposal",
        next_action_date: "2026-08-01",
        last_contact_date: "2026-07-20",
      },
    ],
    "2026-08-12",
  );
  assert.equal(ranked[0].id, "big");
  assert.equal(ranked[0].reason, "Next action is overdue.");
});

/* -------------------------------------------------------------- nutrition */

test("nutrition: says insufficient data rather than guessing", () => {
  const r = analyseNutritionTrend({
    calories: [3000, 3000, null, null, null, null, null],
    proteinG: [180, 180, null, null, null, null, null],
    weightKg: [88, null, null, null, null, null, null],
    calorieTarget: 3000,
    proteinTarget: 180,
    intendedWeeklyKg: 0.25,
    windowDays: 7,
  });
  assert.equal(r.verdict, "INSUFFICIENT_DATA");
});

test("nutrition: flags intake that is not producing the intended trend", () => {
  const days = 28;
  const r = analyseNutritionTrend({
    calories: Array(days).fill(2400),
    proteinG: Array(days).fill(170),
    // Flat weight against an intended gain.
    weightKg: Array.from({ length: days }, () => 88),
    calorieTarget: 3000,
    proteinTarget: 180,
    intendedWeeklyKg: 0.25,
    windowDays: days,
  });
  assert.equal(r.verdict, "OFF_TREND");
  assert.match(r.message, /may not be producing the intended weight trend/);
});

test("nutrition: confirms an on-track trend", () => {
  const days = 28;
  const r = analyseNutritionTrend({
    calories: Array(days).fill(3000),
    proteinG: Array(days).fill(180),
    weightKg: Array.from({ length: days }, (_, i) => 88 + i * (0.25 / 7)),
    calorieTarget: 3000,
    proteinTarget: 180,
    intendedWeeklyKg: 0.25,
    windowDays: days,
  });
  assert.equal(r.verdict, "ON_TRACK");
});

/* --------------------------------------------------------------- recovery */

test("recovery: needs at least two inputs", () => {
  const r = assessReadiness({
    sleepHours: 8,
    sleepQuality: null,
    energy: null,
    stress: null,
    soreness: null,
    recentSessionRpe: null,
    consecutiveTrainingDays: 0,
  });
  assert.equal(r.level, null);
});

test("recovery: grades readiness from logged inputs", () => {
  const high = assessReadiness({
    sleepHours: 8,
    sleepQuality: 5,
    energy: 5,
    stress: 1,
    soreness: 1,
    recentSessionRpe: 6,
    consecutiveTrainingDays: 1,
  });
  assert.equal(high.level, "HIGH");

  const low = assessReadiness({
    sleepHours: 4,
    sleepQuality: 1,
    energy: 1,
    stress: 5,
    soreness: 5,
    recentSessionRpe: 9.5,
    consecutiveTrainingDays: 6,
  });
  assert.equal(low.level, "LOW");
});

/* ------------------------------------------------------------------- load */

test("load: builds a baseline before comparing", () => {
  const points = [{ date: "2026-08-11", load: 500 }];
  const r = analyseLoad(points, "2026-08-12");
  assert.equal(r.status, "BUILDING");
  assert.equal(r.chronic, null);
});

test("load: reports a sharp increase against the 4-week average", () => {
  const points: Array<{ date: string; load: number }> = [];
  for (let i = 27; i >= 7; i--) {
    points.push({ date: addDays("2026-08-12", -i), load: 100 });
  }
  for (let i = 6; i >= 0; i--) {
    points.push({ date: addDays("2026-08-12", -i), load: 600 });
  }
  const r = analyseLoad(points, "2026-08-12");
  assert.equal(r.status, "SHARP_INCREASE");
  assert.ok(r.ratio !== null && r.ratio > 1.5);
});

test("load: session load requires both inputs", () => {
  assert.equal(sessionLoad(60, 8), 480);
  assert.equal(sessionLoad(60, null), null);
  assert.equal(sessionLoad(null, 8), null);
});

/* --------------------------------------------------------------- firewall */

test("firewall: borrowing and irreversibility force a 72-hour cool-off", () => {
  const r = classifyDecision({
    amountCents: 1000_00,
    reversibility: "REVERSIBLE",
    emotionalIntensity: 1,
    involvesBorrowing: true,
    isBusinessPivot: false,
    majorSpendCents: 5_000_00,
  });
  assert.equal(r.level, "RED");
  assert.equal(r.coolingHours, 72);
});

test("firewall: a major spend is yellow, a routine one green", () => {
  const yellow = classifyDecision({
    amountCents: 6_000_00,
    reversibility: "REVERSIBLE",
    emotionalIntensity: 1,
    involvesBorrowing: false,
    isBusinessPivot: false,
    majorSpendCents: 5_000_00,
  });
  assert.equal(yellow.level, "YELLOW");
  assert.equal(yellow.coolingHours, 24);

  const green = classifyDecision({
    amountCents: 100_00,
    reversibility: "REVERSIBLE",
    emotionalIntensity: 1,
    involvesBorrowing: false,
    isBusinessPivot: false,
    majorSpendCents: 5_000_00,
  });
  assert.equal(green.level, "GREEN");
  assert.equal(green.coolingHours, 0);
});

test("firewall: cooling state counts down and releases", () => {
  const now = new Date("2026-08-12T10:00:00Z");
  assert.equal(coolingState("2026-08-12T09:00:00Z", now).released, true);
  const pending = coolingState("2026-08-12T12:30:00Z", now);
  assert.equal(pending.released, false);
  assert.equal(pending.label, "2h 30m remaining");
});

/* ------------------------------------------------------------------ ideas */

function idea(over: Partial<Idea> = {}): Idea {
  return {
    id: "i",
    title: "Idea",
    summary: null,
    stage: "SCORED",
    score_potential: 9,
    score_difficulty: 4,
    score_cost: 3,
    score_speed: 8,
    score_fit: 9,
    score_advantage: 7,
    research_notes: "notes",
    validation_notes: "validated",
    promoted_project_id: null,
    activated_at: null,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

test("ideas: difficulty and cost are inverted in the score", () => {
  const easy = scoreIdea(idea({ score_difficulty: 1, score_cost: 1 }));
  const hard = scoreIdea(idea({ score_difficulty: 10, score_cost: 10 }));
  assert.ok(easy.total !== null && hard.total !== null && easy.total > hard.total);
});

test("ideas: incomplete scoring is reported, not filled in", () => {
  const s = scoreIdea(idea({ score_fit: null }));
  assert.equal(s.complete, false);
  assert.deepEqual(s.missing, ["Strategic fit"]);
});

test("ideas: activation requires research, validation and a full score", () => {
  assert.equal(canActivate(idea()).ok, true);
  assert.equal(canActivate(idea({ research_notes: null })).ok, false);
  assert.equal(canActivate(idea({ validation_notes: null })).ok, false);
  assert.equal(canActivate(idea({ score_cost: null })).ok, false);
  assert.equal(canActivate(idea({ stage: "ACTIVE" })).ok, false);
});

/* ---------------------------------------------------------------- mission */

test("mission: progress is derived, and schedule compared to elapsed time", () => {
  const r = missionProgress({
    milestones: [
      { weight: 1, status: "COMPLETE" },
      { weight: 1, status: "COMPLETE" },
      { weight: 1, status: "IN_PROGRESS" },
      { weight: 1, status: "PENDING" },
    ],
    tasksTotal: 10,
    tasksComplete: 5,
    kpis: [{ current_value: 25, target_value: 100 }],
    startDate: "2026-07-01",
    endDate: "2026-09-28",
    today: "2026-08-12",
  });
  assert.equal(r.milestonePct, 62.5);
  assert.equal(r.taskPct, 50);
  assert.equal(r.kpiPct, 25);
  assert.ok(r.progressPct !== null && r.progressPct > 45 && r.progressPct < 55);
  assert.equal(r.daysTotal, 90);
  assert.equal(r.daysRemaining, 47);
  assert.notEqual(r.schedule, "UNKNOWN");
});

test("mission: nothing linked means no fabricated percentage", () => {
  const r = missionProgress({
    milestones: [],
    tasksTotal: 0,
    tasksComplete: 0,
    kpis: [],
    startDate: "2026-07-01",
    endDate: "2026-09-28",
    today: "2026-08-12",
  });
  assert.equal(r.progressPct, null);
  assert.equal(r.schedule, "UNKNOWN");
  assert.equal(progressBar(null, 4), "····");
  assert.equal(progressBar(50, 4), "██░░");
});

/* -------------------------------------------------------------- character */

test("character: promise rate excludes unresolved promises", () => {
  const s = promiseStats([
    { status: "KEPT" },
    { status: "KEPT" },
    { status: "KEPT" },
    { status: "KEPT" },
    { status: "KEPT" },
    { status: "KEPT" },
    { status: "BROKEN" },
    { status: "OPEN" },
  ]);
  assert.equal(s.rate, 85.7);
  assert.equal(s.open, 1);
  assert.equal(s.meetsTarget, false);
});

test("character: promise rate is null before anything resolves", () => {
  assert.equal(promiseStats([{ status: "OPEN" }]).rate, null);
  assert.equal(promiseStats([]).rate, null);
});

test("character: habit consistency scales to the habit's age", () => {
  const dates = ["2026-08-12", "2026-08-11", "2026-08-10", "2026-08-09"];
  const c = habitConsistency({
    habitId: "h",
    name: "Train",
    targetPerWeek: 4,
    doneDates: dates,
    today: "2026-08-12",
    ageDays: 7,
  });
  assert.equal(c.done7, 4);
  assert.equal(c.consistency7, 100);
  assert.equal(c.daysSince, 0);
  // A 3-day-old habit is not judged against a 90-day window.
  const young = habitConsistency({
    habitId: "h",
    name: "Train",
    targetPerWeek: 4,
    doneDates: ["2026-08-12", "2026-08-11"],
    today: "2026-08-12",
    ageDays: 3,
  });
  assert.equal(young.consistency90, 100);
});

test("character: decision quality compares calm against charged decisions", () => {
  const r = decisionQuality([
    ...Array(3).fill({ status: "DECIDED", outcome_rating: 5, emotional_intensity: 1 }),
    ...Array(3).fill({ status: "DECIDED", outcome_rating: 2, emotional_intensity: 5 }),
  ]);
  assert.equal(r.calmAverage, 5);
  assert.equal(r.highEmotionAverage, 2);
  assert.match(r.insight ?? "", /calmly are rating 3 points higher/);
});

/* ---------------------------------------------------------------- running */

function interval(i: number, distanceM: number, sec: number, target: number | null): RunInterval {
  return {
    id: `i${i}`,
    run_id: "r",
    interval_index: i,
    distance_m: distanceM,
    duration_sec: sec,
    pace_sec: null,
    target_pace_sec: target,
    recovery_sec: 90,
    avg_hr: null,
    notes: null,
    created_at: "",
    updated_at: "",
  };
}

test("running: pace maths", () => {
  assert.equal(paceSecPerKm(1000, 270), 270);
  assert.equal(paceSecPerKm(800, 216), 270);
  assert.equal(paceSecPerKm(0, 100), null);
});

test("running: interval analysis finds best, worst and consistency", () => {
  // Target 4:30/km = 270 s/km; 800m splits below 216s beat it.
  const r = analyseIntervals([
    interval(1, 800, 212, 270), // 265 s/km
    interval(2, 800, 214, 270), // 268 s/km
    interval(3, 800, 210, 270), // 263 s/km
    interval(4, 800, 216, 270), // 270 s/km
  ]);
  assert.equal(r.count, 4);
  assert.equal(r.bestIndex, 3);
  assert.equal(r.worstIndex, 4);
  assert.equal(r.onTargetCount, 4);
  assert.ok(r.consistency !== null && r.consistency > 90);
  assert.ok(r.differenceSec !== null && r.differenceSec < 0);
});

test("running: no completed intervals reports nothing rather than zero", () => {
  const r = analyseIntervals([]);
  assert.equal(r.averagePaceSec, null);
  assert.equal(r.consistency, null);
});

/* ------------------------------------------------------------------ hyrox */

test("hyrox: no race projection until every component is recorded", () => {
  const profiles = stationProfiles([
    { station: "RUN", duration_sec: 260, date: "2026-08-01" },
    { station: "SKIERG", duration_sec: 240, date: "2026-08-01" },
  ]);
  const p = projectRaceTime(profiles);
  assert.equal(p.predictedSec, null);
  assert.equal(p.missing.length, 7);
});

test("hyrox: race projection sums personal bests", () => {
  const records = [
    { station: "RUN" as const, duration_sec: 260, date: "2026-08-01" },
    { station: "RUN" as const, duration_sec: 250, date: "2026-08-05" },
    { station: "SKIERG" as const, duration_sec: 240, date: "2026-08-01" },
    { station: "SLED_PUSH" as const, duration_sec: 150, date: "2026-08-01" },
    { station: "SLED_PULL" as const, duration_sec: 180, date: "2026-08-01" },
    { station: "BURPEE_BROAD_JUMP" as const, duration_sec: 300, date: "2026-08-01" },
    { station: "ROW" as const, duration_sec: 230, date: "2026-08-01" },
    { station: "FARMERS_CARRY" as const, duration_sec: 120, date: "2026-08-01" },
    { station: "SANDBAG_LUNGES" as const, duration_sec: 260, date: "2026-08-01" },
    { station: "WALL_BALLS" as const, duration_sec: 330, date: "2026-08-01" },
  ];
  const p = projectRaceTime(stationProfiles(records));
  assert.equal(p.runSec, 2000);
  assert.equal(p.stationSec, 1810);
  assert.equal(p.predictedSec, 3810);
});

test("hyrox: simulation names the biggest time to reclaim", () => {
  const profiles = stationProfiles([
    { station: "WALL_BALLS", duration_sec: 300, date: "2026-07-01" },
    { station: "ROW", duration_sec: 230, date: "2026-07-01" },
  ]);
  const sim = analyseSimulation(
    [
      { station: "RUN", duration_sec: 280, transition_sec: 10 },
      { station: "ROW", duration_sec: 235, transition_sec: 10 },
      { station: "RUN", duration_sec: 285, transition_sec: 10 },
      { station: "WALL_BALLS", duration_sec: 400, transition_sec: 10 },
    ],
    profiles,
  );
  assert.equal(sim.opportunity?.station, "WALL_BALLS");
  assert.equal(sim.opportunity?.gapSec, 100);
  assert.equal(sim.slowest?.station, "WALL_BALLS");
  assert.equal(sim.fastest?.station, "ROW");
  assert.equal(sim.runSec, 565);
  assert.equal(sim.transitionSec, 40);
  assert.equal(sim.totalSec, 1240);
});
