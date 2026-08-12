import "server-only";

import { scalar } from "@/lib/db";
import { addDays, today, type DayString } from "@/lib/core/date";
import { money, pct } from "@/lib/core/format";
import { PILLAR_NAME } from "@/lib/domain/balance";
import { round } from "@/lib/domain/stats";
import type { ScoredPillar } from "@/lib/types";
import { computeMissionProgress, dayLoad, flagTasks, openTasks, primaryMission, unalignedProjects } from "./core";
import { bodyDashboard, nutritionTrend, trainingLoad } from "./body";
import { businessDashboard } from "./business";
import { financeDashboard } from "./finance";
import { characterDashboard } from "./character";
import { learningStats, ideaViews } from "./growth";
import { averageScores, balanceNow, pillarTrajectories, scoreHistory } from "./scores";
import { outstandingReviews } from "./reviews";

/**
 * THE STRATEGIST
 *
 * A strategic layer on top of the data — not the centre of the product, and not
 * a language model. Every observation below is derived from rows the user
 * recorded and states the numbers it rests on. Nothing here can invent data,
 * because there is nowhere for invented data to come from.
 *
 * Five roles, in the order a strategist would work through them:
 * ANALYST (what the numbers say), REVIEWER (what changed), STRATEGIST (where
 * the leverage is), PLANNER (what to do next), ACCOUNTABILITY (what you said).
 */

export type StrategistRole = "ANALYST" | "REVIEWER" | "STRATEGIST" | "PLANNER" | "ACCOUNTABILITY";

export interface Observation {
  role: StrategistRole;
  pillar: ScoredPillar | "LIFE" | null;
  headline: string;
  /** The statement, with the figures it is based on stated inline. */
  detail: string;
  /** Where to act on it. */
  href: string | null;
  weight: number;
}

export interface StrategistBriefing {
  date: DayString;
  scoredDays: number;
  observations: Observation[];
  /** Said plainly when the data is too thin to conclude anything. */
  dataNote: string | null;
}

export function briefing(day: DayString = today()): StrategistBriefing {
  const out: Observation[] = [];
  const history = scoreHistory(90, day);
  const scoredDays = history.length;

  const push = (o: Observation) => out.push(o);

  /* --------------------------------------------------------- ANALYST */
  const week = averageScores(addDays(day, -6), day);
  const priorWeek = averageScores(addDays(day, -13), addDays(day, -7));
  const trajectories = pillarTrajectories(28, day);

  for (const t of trajectories) {
    const key = t.pillar.toLowerCase() as keyof typeof week;
    const now = week[key];
    const before = priorWeek[key];
    if (now === null || before === null) continue;
    const delta = round(now - before, 1);
    if (Math.abs(delta) < 5) continue;
    push({
      role: "ANALYST",
      pillar: t.pillar,
      headline: `${PILLAR_NAME[t.pillar]} ${delta > 0 ? "improved" : "declined"} week on week`,
      detail: `${PILLAR_NAME[t.pillar]} averaged ${now} over the last seven days against ${before} the week before — a change of ${delta > 0 ? "+" : "\u2212"}${Math.abs(delta)} points.`,
      href: pillarHref(t.pillar),
      weight: Math.abs(delta) + (delta < 0 ? 10 : 0),
    });
  }

  /* -------------------------------------------------------- REVIEWER */
  const balance = balanceNow(28, day);
  for (const finding of balance.findings) {
    push({
      role: "REVIEWER",
      pillar: finding.pillars.length === 1 ? finding.pillars[0] : "LIFE",
      headline: finding.headline,
      detail: finding.detail,
      href: "/analytics",
      weight: finding.severity === "CRITICAL" ? 60 : finding.severity === "ATTENTION" ? 40 : 10,
    });
  }

  const outstanding = outstandingReviews(day);
  if (outstanding.length > 0) {
    push({
      role: "REVIEWER",
      pillar: "LIFE",
      headline: `${outstanding.length} ${outstanding.length === 1 ? "review is" : "reviews are"} outstanding`,
      detail: `${outstanding.map((o) => o.label).join(", ")}. Execution without review produces activity, not improvement.`,
      href: "/reviews",
      weight: 35,
    });
  }

  /* ------------------------------------------------------ STRATEGIST */
  const business = businessDashboard(day);
  if (business.pipeline.bottleneck) {
    const b = business.pipeline.bottleneck;
    push({
      role: "STRATEGIST",
      pillar: "BUSINESS",
      headline: `${b.from.replace("_", " ")} → ${b.to.replace("_", " ")} is the bottleneck`,
      detail: `${b.advanced} of ${b.reached} leads that reached ${b.from.replace("_", " ")} moved on — ${b.rate}%. Improving that one step moves more revenue than adding leads at the top of the funnel.`,
      href: "/business/sales",
      weight: 50,
    });
  }

  if (business.pipeline.totalOpen === 0) {
    push({
      role: "STRATEGIST",
      pillar: "BUSINESS",
      headline: "The pipeline is empty",
      detail:
        "There are no open leads. No amount of product work produces revenue from an empty pipeline.",
      href: "/business/sales",
      weight: 70,
    });
  }

  // Activity without result — the pattern that looks like progress and is not.
  const touches90 = scalar(
    "SELECT COUNT(*) AS v FROM lead_stage_events WHERE date BETWEEN ? AND ?",
    [addDays(day, -89), day],
  );
  if (touches90 >= 15 && business.revenue90Cents === 0) {
    push({
      role: "STRATEGIST",
      pillar: "BUSINESS",
      headline: "Business activity is high but revenue is flat",
      detail: `${touches90} pipeline movements in 90 days with no revenue recorded. The constraint is conversion, not effort.`,
      href: "/business/strategy",
      weight: 65,
    });
  }

  const mission = primaryMission();
  if (mission) {
    const progress = computeMissionProgress(mission, day);
    const unaligned = unalignedProjects(mission.id).length;
    const activeProjects = scalar(
      "SELECT COUNT(*) AS v FROM projects WHERE status IN ('ACTIVE','BLOCKED')",
    );
    if (unaligned > 0 && activeProjects > 0) {
      push({
        role: "STRATEGIST",
        pillar: "LIFE",
        headline: `${unaligned} of ${activeProjects} active projects are not connected to the mission`,
        detail:
          "Work that is not attached to the mission competes with it. Link it, park it, or accept that the mission moves more slowly.",
        href: "/business/projects",
        weight: 45,
      });
    }
    if (progress.schedule === "BEHIND" || progress.schedule === "AT_RISK") {
      push({
        role: "STRATEGIST",
        pillar: "LIFE",
        headline: `${mission.title} is ${progress.schedule === "AT_RISK" ? "at risk" : "behind schedule"}`,
        detail: progress.message,
        href: `/missions/${mission.id}`,
        weight: progress.schedule === "AT_RISK" ? 80 : 55,
      });
    }
  } else {
    push({
      role: "STRATEGIST",
      pillar: "LIFE",
      headline: "No primary mission is active",
      detail:
        "Without one, every score is measured against nothing in particular. One 90-day mission is what makes the rest of the system mean something.",
      href: "/missions",
      weight: 90,
    });
  }

  /* ------------------------------------------------------------ BODY */
  const load = trainingLoad(day);
  if (load.status === "SHARP_INCREASE" || load.status === "SHARP_DROP") {
    push({
      role: "ANALYST",
      pillar: "BODY",
      headline: "Training workload changed sharply",
      detail: `${load.message} This describes recorded workload only — it is not a medical assessment.`,
      href: "/body/training",
      weight: 40,
    });
  }

  const nutrition = nutritionTrend(28, day);
  if (nutrition.verdict === "OFF_TREND") {
    push({
      role: "ANALYST",
      pillar: "BODY",
      headline: "Intake and bodyweight disagree",
      detail: nutrition.message,
      href: "/body/nutrition",
      weight: 45,
    });
  } else if (nutrition.verdict === "INSUFFICIENT_DATA") {
    push({
      role: "ANALYST",
      pillar: "BODY",
      headline: "Nutrition cannot be assessed yet",
      detail: nutrition.message,
      href: "/body/nutrition",
      weight: 12,
    });
  }

  /* --------------------------------------------------------- FINANCE */
  const finance = financeDashboard(day);
  if (finance.forecast30.shortfall) {
    push({
      role: "PLANNER",
      pillar: "FINANCE",
      headline: "A cash shortfall is projected",
      detail: `The balance is projected to fall ${money(finance.forecast30.shortfall.amountCents)} short on ${finance.forecast30.shortfall.date}, based on scheduled movements. Move a payment, bring income forward, or cut a scheduled item.`,
      href: "/finance/cash-flow",
      weight: 95,
    });
  }
  if (finance.savingsRate !== null && finance.savingsRate < 0) {
    push({
      role: "ANALYST",
      pillar: "FINANCE",
      headline: "Spending exceeds income",
      detail: `Over the last 30 days ${money(finance.expenses30Cents)} went out against ${money(finance.income30Cents)} in. Financial pressure is what makes patient decisions impossible.`,
      href: "/finance/cash-flow",
      weight: 75,
    });
  }
  if (finance.debt.totalCents > 0 && finance.debt.monthsToClearAtMinimum !== null) {
    if (finance.debt.monthsToClearAtMinimum > 36) {
      push({
        role: "STRATEGIST",
        pillar: "FINANCE",
        headline: "Debt will take years to clear at minimum payments",
        detail: `${money(finance.debt.totalCents)} outstanding, ${finance.debt.monthsToClearAtMinimum} months at minimum payments. The smallest balance is ${money(finance.debt.payoffOrder[0]?.balance_cents ?? 0)} — killing it first frees its payment for the next one.`,
        href: "/finance/debt",
        weight: 40,
      });
    }
  }

  /* ------------------------------------------------------- CHARACTER */
  const character = characterDashboard(day);
  if (character.promises30.rate !== null && character.promises30.meetsTarget === false) {
    push({
      role: "ACCOUNTABILITY",
      pillar: "CHARACTER",
      headline: `Promise rate is ${pct(character.promises30.rate, 1)}, below the ${character.promises30.target}% standard`,
      detail: `${character.promises30.kept} kept and ${character.promises30.broken} broken over 30 days. This measures reliability to yourself, which is the input to everything else.`,
      href: "/character",
      weight: 55,
    });
  }
  const overduePromises = character.openPromises.filter((p) => p.date < day).length;
  if (overduePromises > 0) {
    push({
      role: "ACCOUNTABILITY",
      pillar: "CHARACTER",
      headline: `${overduePromises} ${overduePromises === 1 ? "promise is" : "promises are"} unresolved`,
      detail:
        "An unresolved promise measures nothing. Mark each one kept or broken — the honest answer is the useful one.",
      href: "/character",
      weight: 50,
    });
  }
  const weakestHabit = character.portfolio30.weakest;
  if (weakestHabit && weakestHabit.consistency30 !== null) {
    const w = { ...weakestHabit, consistency30: weakestHabit.consistency30 };
    if (w.consistency30 < 60) {
      push({
        role: "REVIEWER",
        pillar: "CHARACTER",
        headline: `${w.name} is the habit that is slipping`,
        detail: `${pct(w.consistency30)} consistency over 30 days against a target of ${w.targetPerWeek} times a week${w.daysSince !== null ? `, last done ${w.daysSince === 0 ? "today" : `${w.daysSince} days ago`}` : ""}.`,
        href: "/character/habits",
        weight: 30,
      });
    }
  }
  if (character.quality.insight) {
    push({
      role: "ANALYST",
      pillar: "CHARACTER",
      headline: "Decision quality against emotional state",
      detail: character.quality.insight,
      href: "/character/decisions",
      weight: 25,
    });
  }

  /* -------------------------------------------------------- LEARNING */
  const learning = learningStats(day);
  if (learning.total30 >= 5 && learning.applicationRate !== null && learning.applicationRate < 40) {
    push({
      role: "STRATEGIST",
      pillar: "LEARNING",
      headline: "Learning is being consumed, not applied",
      detail: `${learning.applied30} of ${learning.total30} items over 30 days were applied — ${pct(learning.applicationRate)}. Hours only compound once something changed because of them.`,
      href: "/learning",
      weight: 35,
    });
  }

  /* ---------------------------------------------------------- PLANNER */
  const load2 = dayLoad(day);
  if (load2.overloaded) {
    push({
      role: "PLANNER",
      pillar: "LIFE",
      headline: "Today is carrying more than it can hold",
      detail: `${load2.count} open tasks estimated at ${Math.round(load2.minutes / 60)} hours. A day with more than three real commitments is a wish list.`,
      href: "/today",
      weight: 45,
    });
  }

  const flagged = flagTasks(openTasks(), day);
  const overdue = flagged.filter((f) => f.flags.includes("OVERDUE")).length;
  if (overdue > 0) {
    push({
      role: "PLANNER",
      pillar: "LIFE",
      headline: `${overdue} overdue ${overdue === 1 ? "task" : "tasks"}`,
      detail:
        "Reschedule, delegate or delete them. Carrying dead tasks costs attention every time you look at the list.",
      href: "/today",
      weight: 40,
    });
  }

  const nextAction = business.nextActions[0];
  if (nextAction) {
    push({
      role: "PLANNER",
      pillar: "BUSINESS",
      headline: `Highest-value sales action: ${nextAction.company}`,
      detail: `${nextAction.next_action ? `${nextAction.next_action}. ` : "No next action is set. "}Expected value ${money(nextAction.expectedCents)} — ${nextAction.reason.toLowerCase()}`,
      href: `/business/sales/${nextAction.id}`,
      weight: 30,
    });
  }

  const readyIdeas = ideaViews().filter((i) => i.activation.ok);
  if (readyIdeas.length > 0) {
    push({
      role: "PLANNER",
      pillar: "BUSINESS",
      headline: `${readyIdeas.length} ${readyIdeas.length === 1 ? "idea is" : "ideas are"} ready to activate`,
      detail: `${readyIdeas.map((i) => i.title).join(", ")} — researched, validated and fully scored. Activating one is still a deliberate choice.`,
      href: "/ideas",
      weight: 20,
    });
  }

  const body = bodyDashboard(day);
  if (body.readiness.level === "LOW") {
    push({
      role: "PLANNER",
      pillar: "BODY",
      headline: "Readiness is low today",
      detail: `${body.readiness.message} This is a summary of what you logged, not a diagnosis.`,
      href: "/body/recovery",
      weight: 35,
    });
  }

  /* ------------------------------------------------------- DATA NOTE */
  let dataNote: string | null = null;
  if (scoredDays < 14) {
    dataNote = `Only ${scoredDays} ${scoredDays === 1 ? "day has" : "days have"} scored data. Most observations here need three weeks of consistent logging before they mean anything — until then, this page will be short on purpose.`;
  }

  return {
    date: day,
    scoredDays,
    observations: out.sort((a, b) => b.weight - a.weight),
    dataNote,
  };
}

function pillarHref(pillar: ScoredPillar): string {
  switch (pillar) {
    case "BODY":
      return "/body";
    case "BUSINESS":
      return "/business";
    case "FINANCE":
      return "/finance";
    case "CHARACTER":
      return "/character";
    case "LEARNING":
      return "/learning";
  }
}

export const ROLE_LABEL: Record<StrategistRole, string> = {
  ANALYST: "Analyst",
  REVIEWER: "Reviewer",
  STRATEGIST: "Strategist",
  PLANNER: "Planner",
  ACCOUNTABILITY: "Accountability",
};

export const ROLE_DESCRIPTION: Record<StrategistRole, string> = {
  ANALYST: "What the numbers say.",
  REVIEWER: "What changed, and what it cost.",
  STRATEGIST: "Where the leverage actually is.",
  PLANNER: "What to do next.",
  ACCOUNTABILITY: "What you said you would do.",
};
