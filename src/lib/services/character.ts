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

export function listHabits(activeOnly = true): Habit[] {
  return all<Habit>(
    `SELECT * FROM habits ${activeOnly ? "WHERE active = 1" : ""} ORDER BY sort_order, name`,
  );
}

export function habitLogsFor(day: DayString): HabitLog[] {
  return all<HabitLog>("SELECT * FROM habit_logs WHERE date = ?", [day]);
}

export function habitDoneSet(day: DayString): Set<string> {
  return new Set(habitLogsFor(day).filter((l) => l.done === 1).map((l) => l.habit_id));
}

export function habitStats(day: DayString = today()): HabitConsistency[] {
  const habits = listHabits();
  return habits.map((h) => {
    const dates = all<{ date: string }>(
      "SELECT date FROM habit_logs WHERE habit_id = ? AND done = 1 ORDER BY date DESC LIMIT 400",
      [h.id],
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
  });
}

export function habitGrid(days = 28, day: DayString = today()) {
  const habits = listHabits();
  const from = addDays(day, -(days - 1));
  const logs = all<HabitLog>(
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

export function listPromises(from: DayString, to: DayString): Promise_[] {
  return all<Promise_>(
    "SELECT * FROM promises WHERE date BETWEEN ? AND ? ORDER BY date DESC, due_time",
    [from, to],
  );
}

export function promisesFor(day: DayString): Promise_[] {
  return all<Promise_>("SELECT * FROM promises WHERE date = ? ORDER BY due_time, created_at", [day]);
}

export function openPromises(): Promise_[] {
  return all<Promise_>("SELECT * FROM promises WHERE status = 'OPEN' ORDER BY date, due_time");
}

export function promiseRate(windowDays = 30, day: DayString = today()) {
  return promiseStats(listPromises(addDays(day, -(windowDays - 1)), day));
}

/* -------------------------------------------------------------- decisions */

export function listDecisions(): Decision[] {
  return all<Decision>(
    `SELECT * FROM decisions
      ORDER BY CASE status WHEN 'COOLING' THEN 0 WHEN 'READY' THEN 1 WHEN 'DECIDED' THEN 2 ELSE 3 END,
               created_at DESC`,
  );
}

export function getDecision(id: string): Decision | undefined {
  return byId<Decision>("decisions", id);
}

export function decisionOptions(decisionId: string): DecisionOption[] {
  return all<DecisionOption>(
    "SELECT * FROM decision_options WHERE decision_id = ? ORDER BY sort_order",
    [decisionId],
  );
}

export interface DecisionView extends Decision {
  options: DecisionOption[];
  cooling: ReturnType<typeof coolingState>;
}

export function decisionView(id: string): DecisionView | undefined {
  const decision = getDecision(id);
  if (!decision) return undefined;
  return {
    ...decision,
    options: decisionOptions(id),
    cooling: coolingState(decision.cooling_until),
  };
}

/** Decisions whose cooling period is still running — the firewall in action. */
export function coolingDecisions(): DecisionView[] {
  return all<Decision>("SELECT * FROM decisions WHERE status = 'COOLING' ORDER BY cooling_until")
    .map((d) => ({ ...d, options: decisionOptions(d.id), cooling: coolingState(d.cooling_until) }));
}

/* ------------------------------------------------------------- dashboard */

export interface CharacterDashboard {
  promises30: ReturnType<typeof promiseStats>;
  promises90: ReturnType<typeof promiseStats>;
  todayPromises: Promise_[];
  openPromises: Promise_[];
  habits: HabitConsistency[];
  portfolio7: ReturnType<typeof habitPortfolio>;
  portfolio30: ReturnType<typeof habitPortfolio>;
  portfolio90: ReturnType<typeof habitPortfolio>;
  decisions: Decision[];
  cooling: DecisionView[];
  quality: ReturnType<typeof decisionQuality>;
  disciplineScore: number | null;
}

export function characterDashboard(day: DayString = today()): CharacterDashboard {
  const habits = habitStats(day);
  const promises30 = promiseRate(30, day);
  const p7 = habitPortfolio(habits, 7);
  const p30 = habitPortfolio(habits, 30);

  // Discipline = promise reliability and habit consistency, both over 30 days.
  const parts = [promises30.rate, p30.average].filter((v): v is number => v !== null);
  const discipline = parts.length
    ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 10) / 10
    : null;

  return {
    promises30,
    promises90: promiseRate(90, day),
    todayPromises: promisesFor(day),
    openPromises: openPromises(),
    habits,
    portfolio7: p7,
    portfolio30: p30,
    portfolio90: habitPortfolio(habits, 90),
    decisions: listDecisions(),
    cooling: coolingDecisions(),
    quality: decisionQuality(listDecisions()),
    disciplineScore: discipline,
  };
}

/* --------------------------------------------------------- daily helpers */

export function characterDayCounts(day: DayString) {
  const promises = promisesFor(day);
  const habits = listHabits();
  const done = habitDoneSet(day);
  return {
    promisesKept: promises.filter((p) => p.status === "KEPT").length,
    promisesBroken: promises.filter((p) => p.status === "BROKEN").length,
    promisesOpen: promises.filter((p) => p.status === "OPEN").length,
    habitsDue: habits.length,
    habitsDone: habits.filter((h) => done.has(h.id)).length,
  };
}

export function habitById(id: string): Habit | undefined {
  return byId<Habit>("habits", id);
}

export function habitLogFor(habitId: string, day: DayString): HabitLog | undefined {
  return get<HabitLog>("SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?", [habitId, day]);
}

export function activeHabitCount(): number {
  return scalar("SELECT COUNT(*) AS v FROM habits WHERE active = 1");
}
