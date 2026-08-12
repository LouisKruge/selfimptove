import type { ScheduledCashItem } from "@/lib/types";
import { addDays, daysBetween, dayOfWeek, parseDay, type DayString } from "@/lib/core/date";

/**
 * CASH FLOW FORECAST
 *
 * Projects the cash balance forward from known scheduled movements only.
 * Nothing is extrapolated from historical averages — an unpredicted expense is
 * simply absent, and the forecast says so rather than inventing a trend.
 */

export interface ForecastEvent {
  date: DayString;
  name: string;
  direction: "IN" | "OUT";
  amountCents: number;
  category: string | null;
  balanceAfterCents: number;
}

export interface ForecastDay {
  date: DayString;
  inCents: number;
  outCents: number;
  balanceCents: number;
}

export interface ForecastResult {
  horizonDays: number;
  openingCents: number;
  closingCents: number;
  totalInCents: number;
  totalOutCents: number;
  netCents: number;
  lowestCents: number;
  lowestDate: DayString | null;
  days: ForecastDay[];
  events: ForecastEvent[];
  shortfall: { date: DayString; amountCents: number } | null;
}

/** Every occurrence of a scheduled item inside [from, to]. */
export function occurrences(
  item: Pick<
    ScheduledCashItem,
    "cadence" | "day_of_month" | "day_of_week" | "next_date" | "active"
  >,
  from: DayString,
  to: DayString,
): DayString[] {
  if (!item.active) return [];
  const out: DayString[] = [];

  if (item.cadence === "ONCE") {
    if (item.next_date && item.next_date >= from && item.next_date <= to) {
      out.push(item.next_date);
    }
    return out;
  }

  if (item.cadence === "WEEKLY") {
    const target = item.day_of_week;
    if (target === null) return out;
    for (const day of daysBetween(from, to)) {
      if (dayOfWeek(day) === target) out.push(day);
    }
    return out;
  }

  // MONTHLY — clamp to the last day of short months so the 31st still fires.
  const target = item.day_of_month;
  if (target === null) return out;
  for (const day of daysBetween(from, to)) {
    const d = parseDay(day);
    const lastOfMonth = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12),
    ).getUTCDate();
    const effective = Math.min(target, lastOfMonth);
    if (d.getUTCDate() === effective) out.push(day);
  }
  return out;
}

export function forecastCash(opts: {
  openingCents: number;
  items: readonly ScheduledCashItem[];
  from: DayString;
  horizonDays: number;
}): ForecastResult {
  const { openingCents, items, from, horizonDays } = opts;
  const to = addDays(from, horizonDays - 1);
  const range = daysBetween(from, to);

  const byDay = new Map<DayString, ForecastEvent[]>();
  for (const item of items) {
    for (const date of occurrences(item, from, to)) {
      const event: ForecastEvent = {
        date,
        name: item.name,
        direction: item.direction,
        amountCents: item.amount_cents,
        category: item.category,
        balanceAfterCents: 0,
      };
      const list = byDay.get(date);
      if (list) list.push(event);
      else byDay.set(date, [event]);
    }
  }

  let balance = openingCents;
  let lowest = openingCents;
  let lowestDate: DayString | null = null;
  let totalIn = 0;
  let totalOut = 0;
  const days: ForecastDay[] = [];
  const events: ForecastEvent[] = [];
  let shortfall: ForecastResult["shortfall"] = null;

  for (const date of range) {
    const todays = (byDay.get(date) ?? []).sort((a, b) =>
      a.direction === b.direction ? 0 : a.direction === "IN" ? -1 : 1,
    );
    let inCents = 0;
    let outCents = 0;
    for (const e of todays) {
      if (e.direction === "IN") {
        balance += e.amountCents;
        inCents += e.amountCents;
        totalIn += e.amountCents;
      } else {
        balance -= e.amountCents;
        outCents += e.amountCents;
        totalOut += e.amountCents;
      }
      e.balanceAfterCents = balance;
      events.push(e);
    }
    if (balance < lowest) {
      lowest = balance;
      lowestDate = date;
    }
    if (balance < 0 && shortfall === null) {
      shortfall = { date, amountCents: Math.abs(balance) };
    }
    days.push({ date, inCents, outCents, balanceCents: balance });
  }

  return {
    horizonDays,
    openingCents,
    closingCents: balance,
    totalInCents: totalIn,
    totalOutCents: totalOut,
    netCents: totalIn - totalOut,
    lowestCents: lowest,
    lowestDate,
    days,
    events,
    shortfall,
  };
}
