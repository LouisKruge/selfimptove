import "server-only";

import { all, get, scalar } from "@/lib/db";
import { byId } from "@/lib/db/repo";
import { addDays, startOfMonth, today, type DayString } from "@/lib/core/date";
import { analysePipeline, planToTarget, rankNextActions } from "@/lib/domain/pipeline";
import { metricTrajectory } from "@/lib/domain/trajectory";
import { round } from "@/lib/domain/stats";
import type {
  Business,
  BusinessExpense,
  Customer,
  Lead,
  LeadStageEvent,
  Project,
  RevenueEntry,
} from "@/lib/types";

export async function primaryBusiness(): Promise<Business | undefined> {
  return await get<Business>("SELECT * FROM businesses ORDER BY created_at LIMIT 1");
}

export async function listBusinesses(): Promise<Business[]> {
  return await all<Business>("SELECT * FROM businesses ORDER BY created_at");
}

export async function getBusiness(id: string): Promise<Business | undefined> {
  return await byId<Business>("businesses", id);
}

/* ------------------------------------------------------------------ leads */

export async function listLeads(filter: { stage?: string } = {}): Promise<Lead[]> {
  const where = filter.stage ? "WHERE stage = ?" : "";
  return await all<Lead>(
      `SELECT * FROM leads ${where}
      ORDER BY CASE stage
        WHEN 'PROPOSAL' THEN 0 WHEN 'MEETING' THEN 1 WHEN 'RESPONDED' THEN 2
        WHEN 'CONTACTED' THEN 3 WHEN 'PROSPECT' THEN 4 WHEN 'CUSTOMER' THEN 5
        WHEN 'RETAINED' THEN 6 ELSE 7 END,
        potential_cents DESC`,
      filter.stage ? [filter.stage] : [],
    );
}

export async function getLead(id: string): Promise<Lead | undefined> {
  return await byId<Lead>("leads", id);
}

export async function leadEvents(leadId?: string): Promise<LeadStageEvent[]> {
  return leadId
    ? await all<LeadStageEvent>("SELECT * FROM lead_stage_events WHERE lead_id = ? ORDER BY date", [leadId])
    : await all<LeadStageEvent>("SELECT * FROM lead_stage_events ORDER BY date");
}

export async function pipeline() {
  return analysePipeline(await listLeads(), await leadEvents());
}

export async function nextSalesActions(limit = 5, day: DayString = today()) {
  return rankNextActions(await listLeads(), day).slice(0, limit);
}

/* -------------------------------------------------------------- customers */

export async function listCustomers(): Promise<Customer[]> {
  return await all<Customer>(
      `SELECT * FROM customers ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 ELSE 2 END,
             mrr_cents DESC`,
    );
}

export async function activeCustomers(): Promise<Customer[]> {
  return (await listCustomers()).filter((c) => c.status === "ACTIVE");
}

export async function currentMrrCents(): Promise<number> {
  return await scalar("SELECT COALESCE(SUM(mrr_cents), 0) AS v FROM customers WHERE status = 'ACTIVE'");
}

/* ---------------------------------------------------------------- revenue */

export async function listRevenue(limit = 100): Promise<RevenueEntry[]> {
  return await all<RevenueEntry>("SELECT * FROM revenue_entries ORDER BY date DESC LIMIT ?", [limit]);
}

export async function revenueBetween(from: DayString, to: DayString): Promise<number> {
  return await scalar(
      "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM revenue_entries WHERE date BETWEEN ? AND ?",
      [from, to],
    );
}

export async function expensesBetween(from: DayString, to: DayString): Promise<number> {
  return await scalar(
      "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM business_expenses WHERE date BETWEEN ? AND ?",
      [from, to],
    );
}

export interface MonthRevenue {
  month: string;
  revenueCents: number;
  expensesCents: number;
  profitCents: number;
}

export async function monthlyRevenue(months = 12, day: DayString = today()): Promise<MonthRevenue[]> {
  const rows = await all<{ month: string; total: number }>(
      `SELECT substr(date, 1, 7) AS month, SUM(amount_cents) AS total
       FROM revenue_entries GROUP BY month ORDER BY month`,
    );
  const exp = new Map(
    (await all<{ month: string; total: number }>(
            `SELECT substr(date, 1, 7) AS month, SUM(amount_cents) AS total
         FROM business_expenses GROUP BY month`,
          )).map((r) => [r.month, r.total]),
  );

  const out: MonthRevenue[] = [];
  const current = startOfMonth(day);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(current.slice(0, 4)), Number(current.slice(5, 7)) - 1 - i, 1, 12));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const revenueCents = rows.find((r) => r.month === key)?.total ?? 0;
    const expensesCents = exp.get(key) ?? 0;
    out.push({ month: key, revenueCents, expensesCents, profitCents: revenueCents - expensesCents });
  }
  return out;
}

export async function listBusinessExpenses(limit = 60): Promise<BusinessExpense[]> {
  return await all<BusinessExpense>("SELECT * FROM business_expenses ORDER BY date DESC LIMIT ?", [limit]);
}

/* ------------------------------------------------------------- dashboard */

export interface BusinessDashboard {
  business: Business | undefined;
  mrrCents: number;
  mrrTargetCents: number | null;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  expensesThisMonthCents: number;
  profitThisMonthCents: number;
  revenue90Cents: number;
  customers: Customer[];
  customerCount: number;
  pipeline: Awaited<ReturnType<typeof analysePipeline>>;
  plan: Awaited<ReturnType<typeof planToTarget>>;
  nextActions: Awaited<ReturnType<typeof rankNextActions>>;
  months: MonthRevenue[];
  revenueTrend: Awaited<ReturnType<typeof metricTrajectory>>;
  projects: Project[];
  avgDealCents: number | null;
}

export async function businessDashboard(day: DayString = today()): Promise<BusinessDashboard> {
  const business = await primaryBusiness();
  const monthStart = startOfMonth(day);
  const months = await monthlyRevenue(12, day);

  const lastMonthKey = months.length >= 2 ? months[months.length - 2].month : null;
  const revenueLastMonthCents = lastMonthKey
    ? (months.find((m) => m.month === lastMonthKey)?.revenueCents ?? 0)
    : 0;

  const pipe = await pipeline();
  const customers = await listCustomers();
  const activeCount = customers.filter((c) => c.status === "ACTIVE").length;

  // Average deal value from actual closed revenue where possible.
  const closedRevenue = await scalar(
      "SELECT COALESCE(SUM(mrr_cents), 0) AS v FROM customers WHERE status = 'ACTIVE'",
    );
  const derivedAvg = activeCount > 0 ? Math.round(closedRevenue / activeCount) : null;
  const avgDealCents = business?.avg_deal_cents ?? derivedAvg;

  return {
    business,
    mrrCents: await currentMrrCents(),
    mrrTargetCents: business?.mrr_target_cents ?? null,
    revenueThisMonthCents: await revenueBetween(monthStart, day),
    revenueLastMonthCents,
    expensesThisMonthCents: await expensesBetween(monthStart, day),
    profitThisMonthCents: await revenueBetween(monthStart, day) - await expensesBetween(monthStart, day),
    revenue90Cents: await revenueBetween(addDays(day, -89), day),
    customers,
    customerCount: activeCount,
    pipeline: pipe,
    plan: planToTarget({
      targetMrrCents: business?.mrr_target_cents ?? 0,
      avgDealCents,
      currentCustomers: activeCount,
      conversions: pipe.conversions,
    }),
    nextActions: rankNextActions(await listLeads(), day).slice(0, 5),
    months,
    revenueTrend: metricTrajectory(months.map((m) => m.revenueCents), 5),
    projects: await all<Project>(
          `SELECT * FROM projects WHERE pillar = 'BUSINESS' AND status IN ('ACTIVE','BLOCKED','PLANNED')
        ORDER BY CASE status WHEN 'BLOCKED' THEN 0 WHEN 'ACTIVE' THEN 1 ELSE 2 END, deadline`,
        ),
    avgDealCents,
  };
}

/** Pipeline movements recorded on a given day — the business activity signal. */
export async function pipelineTouches(day: DayString): Promise<number> {
  return await scalar("SELECT COUNT(*) AS v FROM lead_stage_events WHERE date = ?", [day]);
}

export async function conversionSummary() {
  const p = await pipeline();
  const known = p.conversions.filter((c) => c.rate !== null);
  return {
    conversions: p.conversions,
    overall:
      known.length === p.conversions.length && known.length > 0
        ? round(
            known.reduce((t, c) => t * ((c.rate as number) / 100), 1) * 100,
            2,
          )
        : null,
    bottleneck: p.bottleneck,
  };
}
