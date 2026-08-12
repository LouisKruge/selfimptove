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

export function primaryBusiness(): Business | undefined {
  return get<Business>("SELECT * FROM businesses ORDER BY created_at LIMIT 1");
}

export function listBusinesses(): Business[] {
  return all<Business>("SELECT * FROM businesses ORDER BY created_at");
}

export function getBusiness(id: string): Business | undefined {
  return byId<Business>("businesses", id);
}

/* ------------------------------------------------------------------ leads */

export function listLeads(filter: { stage?: string } = {}): Lead[] {
  const where = filter.stage ? "WHERE stage = ?" : "";
  return all<Lead>(
    `SELECT * FROM leads ${where}
      ORDER BY CASE stage
        WHEN 'PROPOSAL' THEN 0 WHEN 'MEETING' THEN 1 WHEN 'RESPONDED' THEN 2
        WHEN 'CONTACTED' THEN 3 WHEN 'PROSPECT' THEN 4 WHEN 'CUSTOMER' THEN 5
        WHEN 'RETAINED' THEN 6 ELSE 7 END,
        potential_cents DESC`,
    filter.stage ? [filter.stage] : [],
  );
}

export function getLead(id: string): Lead | undefined {
  return byId<Lead>("leads", id);
}

export function leadEvents(leadId?: string): LeadStageEvent[] {
  return leadId
    ? all<LeadStageEvent>("SELECT * FROM lead_stage_events WHERE lead_id = ? ORDER BY date", [leadId])
    : all<LeadStageEvent>("SELECT * FROM lead_stage_events ORDER BY date");
}

export function pipeline() {
  return analysePipeline(listLeads(), leadEvents());
}

export function nextSalesActions(limit = 5, day: DayString = today()) {
  return rankNextActions(listLeads(), day).slice(0, limit);
}

/* -------------------------------------------------------------- customers */

export function listCustomers(): Customer[] {
  return all<Customer>(
    `SELECT * FROM customers ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PAUSED' THEN 1 ELSE 2 END,
             mrr_cents DESC`,
  );
}

export function activeCustomers(): Customer[] {
  return listCustomers().filter((c) => c.status === "ACTIVE");
}

export function currentMrrCents(): number {
  return scalar("SELECT COALESCE(SUM(mrr_cents), 0) AS v FROM customers WHERE status = 'ACTIVE'");
}

/* ---------------------------------------------------------------- revenue */

export function listRevenue(limit = 100): RevenueEntry[] {
  return all<RevenueEntry>("SELECT * FROM revenue_entries ORDER BY date DESC LIMIT ?", [limit]);
}

export function revenueBetween(from: DayString, to: DayString): number {
  return scalar(
    "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM revenue_entries WHERE date BETWEEN ? AND ?",
    [from, to],
  );
}

export function expensesBetween(from: DayString, to: DayString): number {
  return scalar(
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

export function monthlyRevenue(months = 12, day: DayString = today()): MonthRevenue[] {
  const rows = all<{ month: string; total: number }>(
    `SELECT substr(date, 1, 7) AS month, SUM(amount_cents) AS total
       FROM revenue_entries GROUP BY month ORDER BY month`,
  );
  const exp = new Map(
    all<{ month: string; total: number }>(
      `SELECT substr(date, 1, 7) AS month, SUM(amount_cents) AS total
         FROM business_expenses GROUP BY month`,
    ).map((r) => [r.month, r.total]),
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

export function listBusinessExpenses(limit = 60): BusinessExpense[] {
  return all<BusinessExpense>("SELECT * FROM business_expenses ORDER BY date DESC LIMIT ?", [limit]);
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
  pipeline: ReturnType<typeof analysePipeline>;
  plan: ReturnType<typeof planToTarget>;
  nextActions: ReturnType<typeof rankNextActions>;
  months: MonthRevenue[];
  revenueTrend: ReturnType<typeof metricTrajectory>;
  projects: Project[];
  avgDealCents: number | null;
}

export function businessDashboard(day: DayString = today()): BusinessDashboard {
  const business = primaryBusiness();
  const monthStart = startOfMonth(day);
  const months = monthlyRevenue(12, day);

  const lastMonthKey = months.length >= 2 ? months[months.length - 2].month : null;
  const revenueLastMonthCents = lastMonthKey
    ? (months.find((m) => m.month === lastMonthKey)?.revenueCents ?? 0)
    : 0;

  const pipe = pipeline();
  const customers = listCustomers();
  const activeCount = customers.filter((c) => c.status === "ACTIVE").length;

  // Average deal value from actual closed revenue where possible.
  const closedRevenue = scalar(
    "SELECT COALESCE(SUM(mrr_cents), 0) AS v FROM customers WHERE status = 'ACTIVE'",
  );
  const derivedAvg = activeCount > 0 ? Math.round(closedRevenue / activeCount) : null;
  const avgDealCents = business?.avg_deal_cents ?? derivedAvg;

  return {
    business,
    mrrCents: currentMrrCents(),
    mrrTargetCents: business?.mrr_target_cents ?? null,
    revenueThisMonthCents: revenueBetween(monthStart, day),
    revenueLastMonthCents,
    expensesThisMonthCents: expensesBetween(monthStart, day),
    profitThisMonthCents: revenueBetween(monthStart, day) - expensesBetween(monthStart, day),
    revenue90Cents: revenueBetween(addDays(day, -89), day),
    customers,
    customerCount: activeCount,
    pipeline: pipe,
    plan: planToTarget({
      targetMrrCents: business?.mrr_target_cents ?? 0,
      avgDealCents,
      currentCustomers: activeCount,
      conversions: pipe.conversions,
    }),
    nextActions: rankNextActions(listLeads(), day).slice(0, 5),
    months,
    revenueTrend: metricTrajectory(months.map((m) => m.revenueCents), 5),
    projects: all<Project>(
      `SELECT * FROM projects WHERE pillar = 'BUSINESS' AND status IN ('ACTIVE','BLOCKED','PLANNED')
        ORDER BY CASE status WHEN 'BLOCKED' THEN 0 WHEN 'ACTIVE' THEN 1 ELSE 2 END, deadline`,
    ),
    avgDealCents,
  };
}

/** Pipeline movements recorded on a given day — the business activity signal. */
export function pipelineTouches(day: DayString): number {
  return scalar("SELECT COUNT(*) AS v FROM lead_stage_events WHERE date = ?", [day]);
}

export function conversionSummary() {
  const p = pipeline();
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
