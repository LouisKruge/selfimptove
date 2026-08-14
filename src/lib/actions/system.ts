"use server";

import { refreshPaths } from "./revalidate";
import { get, run } from "@/lib/db";
import { insert, update } from "@/lib/db/repo";
import { lastNDays, nowIso, today } from "@/lib/core/date";
import {
  fail,
  formObject,
  id,
  ok,
  optionalText,
  parseWith,
  requiredText,
  z,
  type ActionResult,
} from "./shared";
import {
  completeReview,
  ensureReview,
  REVIEW_QUESTIONS,
  reviewAnswers,
  saveReviewAnswers,
} from "@/lib/services/reviews";
import { dismissNotification } from "@/lib/services/notifications";
import { recomputeDayScore } from "@/lib/services/scores";
import type { ReviewKind } from "@/lib/types";

const reviewKind = z.enum(["DAILY", "WEEKLY", "MONTHLY", "NINETY_DAY"]);

/* ---------------------------------------------------------------- REVIEWS */

export async function openReview(
  kind: string,
  date?: string,
): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(z.object({ kind: reviewKind }), { kind });
  if (!parsed.ok) return parsed.result;
  const review = await ensureReview(parsed.value.kind as ReviewKind, date ?? today());
  refreshPaths(["/reviews"]);
  return ok({ id: review.id });
}

export async function saveReview(form: FormData): Promise<ActionResult> {
  const data = formObject(form);
  const parsed = parseWith(z.object({ id, complete: optionalText }), data);
  if (!parsed.ok) return parsed.result;

  const review = await get<{ id: string; kind: ReviewKind; answers_json: string }>(
      "SELECT id, kind, answers_json FROM reviews WHERE id = ?",
      [parsed.value.id],
    );
  if (!review) return fail("Review not found.");

  const questions = REVIEW_QUESTIONS[review.kind];
  const answers: Record<string, string> = {};
  for (const q of questions) {
    const value = data[`q_${q.key}`];
    if (typeof value === "string" && value.trim() !== "") answers[q.key] = value.trim();
  }
  await saveReviewAnswers(review.id, answers);

  if (parsed.value.complete === "1") {
    const unanswered = questions.filter((q) => !answers[q.key]);
    if (unanswered.length > 0) {
      return fail(
        `Answer every question before completing: ${unanswered.map((q) => q.label).join(", ")}.`,
      );
    }
    await completeReview(review.id);
    await recomputeDayScore(today());
  }

  refreshPaths(["/reviews"]);
  refreshPaths([`/reviews/${review.id}`]);
  refreshPaths(["/"]);
  return ok();
}

export async function reopenReview(reviewId: string): Promise<ActionResult> {
  await update("reviews", reviewId, { status: "DRAFT", completed_at: null });
  refreshPaths(["/reviews"]);
  refreshPaths([`/reviews/${reviewId}`]);
  return ok();
}

/* --------------------------------------------------------- NOTIFICATIONS */

export async function dismissAlert(notificationId: string): Promise<ActionResult> {
  await dismissNotification(notificationId);
  refreshPaths(["/"]);
  return ok();
}

/* -------------------------------------------------------------- SETTINGS */

const SETTING_KEYS = new Set([
  "sleep_target_hours",
  "savings_rate_target",
  "learning_days_target",
  "learning_minutes_target",
  "major_spend_cents",
  "streak_threshold",
]);

export async function saveSettings(form: FormData): Promise<ActionResult> {
  const data = formObject(form);
  const writes: Array<[string, string]> = [];

  for (const [key, raw] of Object.entries(data)) {
    if (!SETTING_KEYS.has(key)) continue;
    const value = raw.trim();
    if (value === "") continue;
    if (!Number.isFinite(Number(value))) return fail(`${key.replace(/_/g, " ")} must be a number.`);
    writes.push([key, value]);
  }

  // settings is keyed by `key`, so it does not go through the id-based repo.
  for (const [key, value] of writes) {
    await run(
            `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [key, value, nowIso()],
          );
  }

  await recomputeDayScore(today());
  refreshPaths(["/settings"]);
  refreshPaths(["/"]);
  return ok();
}

export async function saveProfile(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id,
      name: requiredText,
      email: optionalText,
      life_vision: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const { id: userId, ...rest } = parsed.value;
  await update("users", userId, rest);
  refreshPaths(["/settings"]);
  refreshPaths(["/goals"]);
  return ok();
}

/* ----------------------------------------------------------- MAINTENANCE */

/** Recomputes stored scores across a window. Safe to run at any time. */
export async function rebuildScores(days = 90): Promise<ActionResult<{ days: number }>> {
  const window = Math.min(400, Math.max(1, Math.round(days)));
  for (const day of lastNDays(window)) await recomputeDayScore(day);
  refreshPaths(["/"]);
  refreshPaths(["/analytics"]);
  return ok({ days: window });
}

/* ------------------------------------------------------------ QUICK LOGS */

/** Fast capture used by the command palette when nothing else fits. */
export async function quickCapture(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ text: requiredText, kind: z.enum(["IDEA", "NOTE", "TASK"]).default("NOTE") }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if (v.kind === "IDEA") {
    await insert("ideas", { title: v.text, stage: "CAPTURE" });
    refreshPaths(["/ideas"]);
  } else if (v.kind === "TASK") {
    await insert("tasks", {
            title: v.text,
            pillar: "BUSINESS",
            priority: "BACKLOG",
            status: "TODO",
            scheduled_date: today(),
          });
    await recomputeDayScore(today());
    refreshPaths(["/today"]);
  } else {
    await insert("notes", { body: v.text });
    refreshPaths(["/ideas"]);
  }
  refreshPaths(["/"]);
  return ok();
}
