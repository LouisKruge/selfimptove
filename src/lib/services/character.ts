import "server-only";

import { all, get, scalar } from "@/lib/db";
import { byId } from "@/lib/db/repo";
import { addDays, diffDays, today, type DayString } from "@/lib/core/date";
import {
  decisionQuality,
  habitConsistency,
  habitPortfolio,
  promiseStats,
  type HabitConsistency,
} from "@/lib/domain/character";
import { coolingState } from "@/lib/domain/firewall";
import type { Decision, DecisionOption, Habit, HabitLog, Promise_ } from "@/lib/types";

/* ----------------------------------------------------------------- habits */

export async function listHabits(activeOnly = true): Promise<Habit[]> {
  return await all<Habit>(
      `SELECT * FROM habits ${activeOnly ? "WHERE active = 1" : ""} ORDER BY sort_order, name`,
    );
}

export async function habitLogsFor(day: DayString): Promise<HabitLog[]> {
  return await all<HabitLog>("SELECT * FROM habit_logs WHERE date = ?", [day]);
}

export async function habitDoneSet(day: DayString): Promise<Set<string>> {
  return new Set((await habitLogsFor(day)).filter((l) => l.done === 1).map((l) => l.habit_id));
}

export async function habitStats(day: DayString = today()): Promise<HabitConsistency[]> {
  const habits = await listHabits();
  return Promise.all(
    habits.map(async (h) => {
      const dates = (
        await all<{ date: string }>(
          "SELECT date FROM habit_logs WHERE habit_id = ? AND done = 1 ORDER BY date DESC LIMIT 400",
          [h.id],
        )
      ).map((r) => r.date);
      const ageDays = Math.max(1, diffDays(day, h.created_at.slice(0, 10)) + 1);
      return habitConsistency({
        habitId: h.id,
        name: h.name,
        targetPerWeek: h.target_per_week,
        doneDates: dates,
        today: day,
        ageDays,
      });
    }),
  );
}

export async function habitGrid(days = 28, day: DayString = today()) {
  const habits = await listHabits();
  const from = addDays(day, -(days - 1));
  const logs = await all<HabitLog>(
      "SELECT * FROM habit_logs WHERE date BETWEEN ? AND ? AND done = 1",
      [from, day],
    );
  const key = (habitId: string, date: string) => `${habitId}:${date}`;
  const done = new Set(logs.map((l) => key(l.habit_id, l.date)));
  const dates: DayString[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(addDays(day, -i));
  return {
    habits,
    dates,
    isDone: (habitId: string, date: string) => done.has(key(habitId, date)),
  };
}

/* --------------------------------------------------------------- promises */

export async function listPromises(from: DayString, to: DayString): Promise<Promise_[]> {
  return await all<Promise_>(
      "SELECT * FROM promises WHERE date BETWEEN ? AND ? ORDER BY date DESC, due_time",
      [from, to],
    );
}

export async function promisesFor(day: DayString): Promise<Promise_[]> {
  return await all<Promise_>("SELECT * FROM promises WHERE date = ? ORDER BY due_time, created_at", [day]);
}

export async function openPromises(): Promise<Promise_[]> {
  return await all<Promise_>("SELECT * FROM promises WHERE status = 'OPEN' ORDER BY date, due_time");
}

export async function promiseRate(windowDays = 30, day: DayString = today()) {
  return promiseStats(await listPromises(addDays(day, -(windowDays - 1)), day));
}

/* -------------------------------------------------------------- decisions */

export async function listDecisions(): Promise<Decision[]> {
  return await all<Decision>(
      `SELECT * FROM decisions
      ORDER BY CASE status WHEN 'COOLING' THEN 0 WHEN 'READY' THEN 1 WHEN 'DECIDED' THEN 2 ELSE 3 END,
               created_at DESC`,
    );
}

export async function getDecision(id: string): Promise<Decision | undefined> {
  return await byId<Decision>("decisions", id);
}

export async function decisionOptions(decisionId: string): Promise<DecisionOption[]> {
  return await all<DecisionOption>(
      "SELECT * FROM decision_options WHERE decision_id = ? ORDER BY sort_order",
      [decisionId],
    );
}

export interface DecisionView extends Decision {
  options: DecisionOption[];
  cooling: Awaited<ReturnType<typeof coolingState>>;
}

export async function decisionView(id: string): Promise<DecisionView | undefined> {
  const decision = await getDecision(id);
  if (!decision) return undefined;
  return {
    ...decision,
    options: await decisionOptions(id),
    cooling: coolingState(decision.cooling_until),
  };
}

/** Decisions whose cooling period is still running — the firewall in action. */
export async function coolingDecisions(): Promise<DecisionView[]> {
  const decisions = await all<Decision>(
    "SELECT * FROM decisions WHERE status = 'COOLING' ORDER BY cooling_until",
  );
  return Promise.all(
    decisions.map(async (d) => ({
      ...d,
      options: await decisionOptions(d.id),
      cooling: coolingState(d.cooling_until),
    })),
  );
}

/* ------------------------------------------------------------- dashboard */

export interface CharacterDashboard {
  promises30: Awaited<ReturnType<typeof promiseStats>>;
  promises90: Awaited<ReturnType<typeof promiseStats>>;
  todayPromises: Promise_[];
  openPromises: Promise_[];
  habits: HabitConsistency[];
  portfolio7: Awaited<ReturnType<typeof habitPortfolio>>;
  portfolio30: Awaited<ReturnType<typeof habitPortfolio>>;
  portfolio90: Awaited<ReturnType<typeof habitPortfolio>>;
  decisions: Decision[];
  cooling: DecisionView[];
  quality: Awaited<ReturnType<typeof decisionQuality>>;
  disciplineScore: number | null;
}

export async function characterDashboard(day: DayString = today()): Promise<CharacterDashboard> {
  const habits = await habitStats(day);
  const promises30 = await promiseRate(30, day);
  const p7 = habitPortfolio(habits, 7);
  const p30 = habitPortfolio(habits, 30);

  // Discipline = promise reliability and habit consistency, both over 30 days.
  const parts = [promises30.rate, p30.average].filter((v): v is number => v !== null);
  const discipline = parts.length
    ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10
    : null;

  return {
    promises30,
    promises90: await promiseRate(90, day),
    todayPromises: await promisesFor(day),
    openPromises: await openPromises(),
    habits,
    portfolio7: p7,
    portfolio30: p30,
    portfolio90: habitPortfolio(habits, 90),
    decisions: await listDecisions(),
    cooling: await coolingDecisions(),
    quality: decisionQuality(await listDecisions()),
    disciplineScore: discipline,
  };
}

/* --------------------------------------------------------- daily helpers */

export async function characterDayCounts(day: DayString) {
  const promises = await promisesFor(day);
  const habits = await listHabits();
  const done = await habitDoneSet(day);
  return {
    promisesKept: promises.filter((p) => p.status === "KEPT").length,
    promisesBroken: promises.filter((p) => p.status === "BROKEN").length,
    promisesOpen: promises.filter((p) => p.status === "OPEN").length,
    habitsDue: habits.length,
    habitsDone: habits.filter((h) => done.has(h.id)).length,
  };
}

export async function habitById(id: string): Promise<Habit | undefined> {
  return await byId<Habit>("habits", id);
}

export async function habitLogFor(habitId: string, day: DayString): Promise<HabitLog | undefined> {
  return await get<HabitLog>("SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?", [habitId, day]);
}

export async function activeHabitCount(): Promise<number> {
  return await scalar("SELECT COUNT(*) AS v FROM habits WHERE active = 1");
}
