import "server-only";

import { all, get, scalar } from "@/lib/db";
import { insert, update } from "@/lib/db/repo";
import {
  addDays,
  isoWeekKey,
  monthLabel,
  nowIso,
  startOfMonth,
  startOfWeek,
  today,
  type DayString,
} from "@/lib/core/date";
import { money } from "@/lib/core/format";
import type { Notification } from "@/lib/types";
import { computeMissionProgress, dayLoad, flagTasks, openTasks, primaryMission } from "./core";
import { bodyDashboard, nutritionDay, recordsOnDate } from "./body";
import { pipeline } from "./business";
import { forecast } from "./finance";
import { coolingDecisions, openPromises } from "./character";
import { balanceNow } from "./scores";

export interface Alert {
  key: string;
  severity: Notification["severity"];
  title: string;
  body: string;
  href: string | null;
}

/**
 * Derives the alerts worth showing right now. Every alert is a fact about
 * recorded data plus a place to act on it. Nothing is emitted "just in case".
 */
export async function computeAlerts(day: DayString = today()): Promise<Alert[]> {
  const alerts: Alert[] = [];

  /* ------------------------------------------------------------- mission */
  const mission = await primaryMission();
  if (mission) {
    const progress = await computeMissionProgress(mission, day);
    if (progress.schedule === "BEHIND" || progress.schedule === "AT_RISK") {
      alerts.push({
        key: `mission-behind:${mission.id}:${startOfWeek(day)}`,
        severity: progress.schedule === "AT_RISK" ? "CRITICAL" : "ATTENTION",
        title: `${mission.title} is behind schedule`,
        body: progress.message,
        href: `/missions/${mission.id}`,
      });
    }
    if (progress.daysRemaining <= 14 && progress.daysRemaining > 0) {
      alerts.push({
        key: `mission-closing:${mission.id}:${day}`,
        severity: "ATTENTION",
        title: `${progress.daysRemaining} days left on the mission`,
        body: `${mission.title} ends ${mission.end_date}. ${progress.progressPct ?? "—"}% complete.`,
        href: `/missions/${mission.id}`,
      });
    }
  } else {
    alerts.push({
      key: "no-primary-mission",
      severity: "ATTENTION",
      title: "No active 90-day mission",
      body: "One primary mission focuses everything else. Set one to give the system a direction.",
      href: "/missions",
    });
  }

  /* --------------------------------------------------------------- tasks */
  const flagged = flagTasks(await openTasks(), day);
  const overdue = flagged.filter((f) => f.flags.includes("OVERDUE"));
  if (overdue.length > 0) {
    alerts.push({
      key: `overdue-tasks:${day}`,
      severity: overdue.length >= 5 ? "CRITICAL" : "ATTENTION",
      title: `${overdue.length} overdue ${overdue.length === 1 ? "task" : "tasks"}`,
      body: "Reschedule, delegate or delete them. Carrying dead tasks costs attention.",
      href: "/today",
    });
  }
  const blocked = flagged.filter((f) => f.flags.includes("BLOCKED"));
  if (blocked.length > 0) {
    alerts.push({
      key: `blocked-tasks:${day}`,
      severity: "ATTENTION",
      title: `${blocked.length} blocked ${blocked.length === 1 ? "task" : "tasks"}`,
      body: blocked[0].task.blocked_reason ?? "Unblock these or cancel them.",
      href: "/today",
    });
  }
  const load = await dayLoad(day);
  if (load.overloaded) {
    alerts.push({
      key: `overloaded:${day}`,
      severity: "ATTENTION",
      title: "Today is overloaded",
      body: `${load.count} open tasks estimated at ${Math.round(load.minutes / 60)}h. Cut it back to a must-win and two support tasks.`,
      href: "/today",
    });
  }

  /* ---------------------------------------------------------------- body */
  const bodyState = await bodyDashboard(day);
  const plannedToday = bodyState.todaySessions.filter(
    (s) => s.status === "PLANNED" || s.status === "IN_PROGRESS",
  );
  if (plannedToday.length > 0) {
    alerts.push({
      key: `training-ready:${plannedToday[0].id}`,
      severity: "INFO",
      title: "Training target available",
      body: `${plannedToday[0].name} is planned for today with targets ready.`,
      href: `/body/training/${plannedToday[0].id}`,
    });
  }
  if (bodyState.load.status === "SHARP_INCREASE" || bodyState.load.status === "SHARP_DROP") {
    alerts.push({
      key: `training-load:${startOfWeek(day)}`,
      severity: "ATTENTION",
      title: "Training workload changed sharply",
      body: bodyState.load.message,
      href: "/body/training",
    });
  }
  const nut = await nutritionDay(day);
  if (nut.target && nut.log && nut.proteinPct !== null && nut.proteinPct < 80) {
    alerts.push({
      key: `protein:${day}`,
      severity: "INFO",
      title: "Protein target is incomplete",
      body: `${Math.round(nut.log.protein_g)}g of ${nut.target.protein_g}g logged.`,
      href: "/body/nutrition",
    });
  }
  if (bodyState.nutritionTrend.verdict === "OFF_TREND") {
    alerts.push({
      key: `nutrition-trend:${startOfWeek(day)}`,
      severity: "ATTENTION",
      title: "Nutrition is not producing the intended trend",
      body: bodyState.nutritionTrend.message,
      href: "/body/nutrition",
    });
  }
  for (const pr of await recordsOnDate(day)) {
    alerts.push({
      key: `pr:${pr.id}`,
      severity: "WIN",
      title: "New personal record",
      body: `${pr.exerciseName ?? pr.station ?? "Record"} — ${pr.display}`,
      href: pr.exercise_id ? `/body/strength/${pr.exercise_id}` : "/body/dashboard",
    });
  }

  /* ------------------------------------------------------------ business */
  const pipe = await pipeline();
  if (pipe.totalOpen === 0) {
    alerts.push({
      key: `empty-pipeline:${startOfWeek(day)}`,
      severity: "ATTENTION",
      title: "Business pipeline is empty",
      body: "No open leads. Revenue cannot arrive from a pipeline with nothing in it.",
      href: "/business/sales",
    });
  } else if (pipe.bottleneck) {
    alerts.push({
      key: `bottleneck:${pipe.bottleneck.from}:${startOfWeek(day)}`,
      severity: "INFO",
      title: `${pipe.bottleneck.from} → ${pipe.bottleneck.to} is the bottleneck`,
      body: `Converting at ${pipe.bottleneck.rate}% across ${pipe.bottleneck.reached} leads.`,
      href: "/business/sales",
    });
  }
  const staleLeads = await scalar(
      `SELECT COUNT(*) AS v FROM leads
      WHERE stage NOT IN ('LOST','RETAINED','CUSTOMER')
        AND next_action_date IS NOT NULL AND next_action_date < ?`,
      [day],
    );
  if (staleLeads > 0) {
    alerts.push({
      key: `stale-leads:${day}`,
      severity: "ATTENTION",
      title: `${staleLeads} ${staleLeads === 1 ? "lead has" : "leads have"} an overdue next action`,
      body: "Deals go cold in the gap between conversations.",
      href: "/business/sales",
    });
  }

  /* ------------------------------------------------------------- finance */
  if (await scalar("SELECT COUNT(*) AS v FROM accounts") > 0) {
    const f30 = await forecast(30, day);
    if (f30.shortfall) {
      alerts.push({
        key: `cash-shortfall:${f30.shortfall.date}`,
        severity: "CRITICAL",
        title: "Projected cash shortfall",
        body: `Balance is projected to fall ${money(f30.shortfall.amountCents)} short on ${f30.shortfall.date}.`,
        href: "/finance/cash-flow",
      });
    }
  }

  /* ----------------------------------------------------------- character */
  const promises = (await openPromises()).filter((p) => p.date < day);
  if (promises.length > 0) {
    alerts.push({
      key: `unresolved-promises:${day}`,
      severity: "ATTENTION",
      title: `${promises.length} unresolved ${promises.length === 1 ? "promise" : "promises"}`,
      body: "Mark them kept or broken. An unresolved promise measures nothing.",
      href: "/character",
    });
  }
  for (const d of await coolingDecisions()) {
    if (d.cooling.released) {
      alerts.push({
        key: `cooling-released:${d.id}`,
        severity: "INFO",
        title: "Cooling period complete",
        body: `"${d.title}" is ready to be decided with a clear head.`,
        href: `/character/decisions/${d.id}`,
      });
    }
  }

  /* ------------------------------------------------------------ reviews */
  const weekKey = isoWeekKey(day);
  const weeklyDone = await get<{ status: string }>(
      "SELECT status FROM reviews WHERE kind = 'WEEKLY' AND period_start = ?",
      [startOfWeek(addDays(day, -7))],
    );
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay();
  if ((dow === 0 || dow === 1) && (!weeklyDone || weeklyDone.status !== "COMPLETE")) {
    alerts.push({
      key: `weekly-review:${weekKey}`,
      severity: "ATTENTION",
      title: "Weekly review due",
      body: "A week without a review is a week that taught you nothing.",
      href: "/reviews",
    });
  }
  const monthStart = startOfMonth(day);
  const monthlyDone = await get<{ status: string }>(
      "SELECT status FROM reviews WHERE kind = 'MONTHLY' AND period_start = ?",
      [startOfMonth(addDays(monthStart, -1))],
    );
  if (Number(day.slice(8, 10)) <= 3 && (!monthlyDone || monthlyDone.status !== "COMPLETE")) {
    alerts.push({
      key: `monthly-review:${monthStart}`,
      severity: "ATTENTION",
      title: `${monthLabel(addDays(monthStart, -1))} review due`,
      body: "Close the month out before the new one absorbs it.",
      href: "/reviews",
    });
  }

  /* ------------------------------------------------------------- balance */
  for (const finding of (await balanceNow(28, day)).findings) {
    if (finding.severity === "INFO") continue;
    alerts.push({
      key: `balance:${finding.headline}:${startOfWeek(day)}`,
      severity: finding.severity,
      title: finding.headline,
      body: finding.detail,
      href: "/analytics",
    });
  }

  return alerts;
}

const SEVERITY_RANK: Record<Notification["severity"], number> = {
  CRITICAL: 0,
  ATTENTION: 1,
  WIN: 2,
  INFO: 3,
};

export async function sortedAlerts(day: DayString = today()): Promise<Alert[]> {
  return (await computeAlerts(day)).sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity],
  );
}

/** Persists alerts so dismissals stick. Deduped by key. */
export async function syncNotifications(day: DayString = today()): Promise<Notification[]> {
  const alerts = await sortedAlerts(day);
  for (const alert of alerts) {
    const existing = await get<Notification>("SELECT * FROM notifications WHERE key = ?", [alert.key]);
    if (existing) {
      await update("notifications", existing.id, {
                severity: alert.severity,
                title: alert.title,
                body: alert.body,
                href: alert.href,
              });
    } else {
      await insert("notifications", {
                key: alert.key,
                severity: alert.severity,
                title: alert.title,
                body: alert.body,
                href: alert.href,
              });
    }
  }
  const keys = new Set(alerts.map((a) => a.key));
  return (await listNotifications()).filter((n) => keys.has(n.key));
}

export async function listNotifications(): Promise<Notification[]> {
  return await all<Notification>(
      `SELECT * FROM notifications WHERE dismissed_at IS NULL
      ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'ATTENTION' THEN 1
                             WHEN 'WIN' THEN 2 ELSE 3 END, created_at DESC`,
    );
}

export async function dismissNotification(id: string): Promise<void> {
  await update("notifications", id, { dismissed_at: nowIso() });
}
