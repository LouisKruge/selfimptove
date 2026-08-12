/**
 * Calendar helpers. Everything in COMMAND keys off a local calendar day string
 * ("YYYY-MM-DD") so that a training session logged at 23:50 belongs to that day
 * regardless of UTC drift.
 */

export type DayString = string; // YYYY-MM-DD

export const APP_TIMEZONE = process.env.COMMAND_TZ || "Africa/Johannesburg";

const DAY_MS = 86_400_000;

/** Today's calendar day in the app timezone. */
export function today(now: Date = new Date()): DayString {
  return toDayString(now);
}

/** Formats a Date into the app timezone's calendar day. */
export function toDayString(d: Date): DayString {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** ISO timestamp used for created_at / updated_at. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Parses a day string into a UTC-noon Date (noon avoids DST edge cases). */
export function parseDay(day: DayString): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

export function isValidDay(day: unknown): day is DayString {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const d = parseDay(day);
  return !Number.isNaN(d.getTime()) && toIsoDay(d) === day;
}

function toIsoDay(d: Date): DayString {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: DayString, n: number): DayString {
  return toIsoDay(new Date(parseDay(day).getTime() + n * DAY_MS));
}

export function diffDays(a: DayString, b: DayString): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / DAY_MS);
}

export function minDay(a: DayString, b: DayString): DayString {
  return a <= b ? a : b;
}

export function maxDay(a: DayString, b: DayString): DayString {
  return a >= b ? a : b;
}

export function clampDay(day: DayString, lo: DayString, hi: DayString): DayString {
  return maxDay(lo, minDay(day, hi));
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(day: DayString): number {
  return parseDay(day).getUTCDay();
}

/** Monday-anchored week start. */
export function startOfWeek(day: DayString): DayString {
  const dow = dayOfWeek(day);
  const back = (dow + 6) % 7;
  return addDays(day, -back);
}

export function endOfWeek(day: DayString): DayString {
  return addDays(startOfWeek(day), 6);
}

export function startOfMonth(day: DayString): DayString {
  return `${day.slice(0, 7)}-01`;
}

export function endOfMonth(day: DayString): DayString {
  const [y, m] = day.split("-").map(Number);
  return toIsoDay(new Date(Date.UTC(y, m, 0, 12)));
}

export function startOfYear(day: DayString): DayString {
  return `${day.slice(0, 4)}-01-01`;
}

/** Inclusive list of days between two bounds. */
export function daysBetween(from: DayString, to: DayString): DayString[] {
  const out: DayString[] = [];
  if (to < from) return out;
  let cur = from;
  // Guard against pathological ranges.
  for (let i = 0; i <= 4000 && cur <= to; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** The last `n` days ending at (and including) `end`. */
export function lastNDays(n: number, end: DayString = today()): DayString[] {
  return daysBetween(addDays(end, -(n - 1)), end);
}

/** ISO-8601 week identifier, e.g. 2026-W33. */
export function isoWeekKey(day: DayString): string {
  const d = parseDay(day);
  // Move to the Thursday of this ISO week — that Thursday's year is the ISO year.
  const thursday = new Date(d.getTime());
  thursday.setUTCDate(thursday.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);

  const isoYear = thursday.getUTCFullYear();
  // 4 January is always in ISO week 1; walk back to its Monday.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12));
  const week1Monday = new Date(jan4.getTime());
  week1Monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));

  const week = 1 + Math.round((thursday.getTime() - week1Monday.getTime()) / (7 * DAY_MS));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/* --------------------------------------------------------------- display */

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];
const WEEKDAYS = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
];

/** "WEDNESDAY · 12 AUGUST" */
export function formatCommandDate(day: DayString): string {
  const d = parseDay(day);
  return `${WEEKDAYS[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "12 Aug 2026" */
export function formatDay(day: DayString | null | undefined): string {
  if (!day || !isValidDay(day)) return "—";
  const d = parseDay(day);
  const m = MONTHS[d.getUTCMonth()];
  return `${d.getUTCDate()} ${m.charAt(0)}${m.slice(1, 3).toLowerCase()} ${d.getUTCFullYear()}`;
}

/** "12 Aug" */
export function formatDayShort(day: DayString | null | undefined): string {
  if (!day || !isValidDay(day)) return "—";
  const d = parseDay(day);
  const m = MONTHS[d.getUTCMonth()];
  return `${d.getUTCDate()} ${m.charAt(0)}${m.slice(1, 3).toLowerCase()}`;
}

export function weekdayShort(day: DayString): string {
  return WEEKDAYS[dayOfWeek(day)].slice(0, 3);
}

export function monthLabel(day: DayString): string {
  const d = parseDay(day);
  const m = MONTHS[d.getUTCMonth()];
  return `${m.charAt(0)}${m.slice(1).toLowerCase()} ${d.getUTCFullYear()}`;
}

/** "in 12 days" / "6 days ago" / "today" */
export function relativeDays(day: DayString, from: DayString = today()): string {
  const n = diffDays(day, from);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  if (n > 0) return `in ${n} days`;
  return `${Math.abs(n)} days ago`;
}
