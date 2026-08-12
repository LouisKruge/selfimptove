import "server-only";

import { all, get, scalar } from "@/lib/db";
import { byId } from "@/lib/db/repo";
import { addDays, startOfMonth, today, type DayString } from "@/lib/core/date";
import { forecastCash, type ForecastResult } from "@/lib/domain/forecast";
import { metricTrajectory } from "@/lib/domain/trajectory";
import { progressPct, round } from "@/lib/domain/stats";
import type {
  Account,
  Asset,
  Debt,
  DebtPayment,
  Goal,
  IncomeEntry,
  Investment,
  InvestmentContribution,
  NetWorthSnapshot,
  PersonalExpense,
  ScheduledCashItem,
} from "@/lib/types";

/* --------------------------------------------------------------- accounts */

export function listAccounts(): Account[] {
  return all<Account>("SELECT * FROM accounts ORDER BY kind, name");
}

export function cashOnHandCents(): number {
  return scalar(
    "SELECT COALESCE(SUM(balance_cents), 0) AS v FROM accounts WHERE include_in_cash = 1",
  );
}

/* ---------------------------------------------------------------- ledgers */

export function listPersonalExpenses(limit = 100): PersonalExpense[] {
  return all<PersonalExpense>("SELECT * FROM personal_expenses ORDER BY date DESC LIMIT ?", [limit]);
}

export function listIncome(limit = 100): IncomeEntry[] {
  return all<IncomeEntry>("SELECT * FROM income_entries ORDER BY date DESC LIMIT ?", [limit]);
}

export function incomeBetween(from: DayString, to: DayString): number {
  return scalar(
    "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM income_entries WHERE date BETWEEN ? AND ?",
    [from, to],
  );
}

export function personalExpensesBetween(from: DayString, to: DayString): number {
  return scalar(
    "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM personal_expenses WHERE date BETWEEN ? AND ?",
    [from, to],
  );
}

export function expensesByCategory(from: DayString, to: DayString) {
  return all<{ category: string; total: number; count: number }>(
    `SELECT category, SUM(amount_cents) AS total, COUNT(*) AS count
       FROM personal_expenses WHERE date BETWEEN ? AND ?
      GROUP BY category ORDER BY total DESC`,
    [from, to],
  );
}

/* -------------------------------------------------------------- scheduled */

export function listScheduled(activeOnly = true): ScheduledCashItem[] {
  return all<ScheduledCashItem>(
    `SELECT * FROM scheduled_cash_items ${activeOnly ? "WHERE active = 1" : ""}
      ORDER BY direction DESC, day_of_month, name`,
  );
}

export function forecast(horizonDays: number, day: DayString = today()): ForecastResult {
  return forecastCash({
    openingCents: cashOnHandCents(),
    items: listScheduled(true),
    from: day,
    horizonDays,
  });
}

export function forecasts(day: DayString = today()) {
  return {
    week: forecast(7, day),
    month: forecast(30, day),
    quarter: forecast(90, day),
  };
}

/* ------------------------------------------------------------------- debt */

export function listDebts(includeSettled = false): Debt[] {
  return all<Debt>(
    `SELECT * FROM debts ${includeSettled ? "" : "WHERE status = 'ACTIVE'"} ORDER BY balance_cents DESC`,
  );
}

export function getDebt(id: string): Debt | undefined {
  return byId<Debt>("debts", id);
}

export function debtPayments(debtId?: string): DebtPayment[] {
  return debtId
    ? all<DebtPayment>("SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC", [debtId])
    : all<DebtPayment>("SELECT * FROM debt_payments ORDER BY date DESC LIMIT 100");
}

export function totalDebtCents(): number {
  return scalar("SELECT COALESCE(SUM(balance_cents), 0) AS v FROM debts WHERE status = 'ACTIVE'");
}

/** Reconstructs the total debt balance as at a past date from payment history. */
export function debtBalanceAsOf(day: DayString): number {
  const paidSince = scalar(
    "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM debt_payments WHERE date > ?",
    [day],
  );
  return totalDebtCents() + paidSince;
}

export interface DebtPlan {
  debts: Debt[];
  totalCents: number;
  totalMinPaymentCents: number;
  /** Smallest balance first — the order that produces the earliest clean kill. */
  payoffOrder: Debt[];
  monthsToClearAtMinimum: number | null;
}

export function debtPlan(): DebtPlan {
  const debts = listDebts();
  const total = debts.reduce((t, d) => t + d.balance_cents, 0);
  const minPayments = debts.reduce((t, d) => t + d.min_payment_cents, 0);
  return {
    debts,
    totalCents: total,
    totalMinPaymentCents: minPayments,
    payoffOrder: [...debts].sort((a, b) => a.balance_cents - b.balance_cents),
    monthsToClearAtMinimum: minPayments > 0 ? Math.ceil(total / minPayments) : null,
  };
}

/* ------------------------------------------------------------ investments */

export function listInvestments(): Investment[] {
  return all<Investment>("SELECT * FROM investments ORDER BY current_cents DESC");
}

export function getInvestment(id: string): Investment | undefined {
  return byId<Investment>("investments", id);
}

export function investmentContributions(investmentId?: string): InvestmentContribution[] {
  return investmentId
    ? all<InvestmentContribution>(
        "SELECT * FROM investment_contributions WHERE investment_id = ? ORDER BY date DESC",
        [investmentId],
      )
    : all<InvestmentContribution>(
        "SELECT * FROM investment_contributions ORDER BY date DESC LIMIT 100",
      );
}

export interface InvestmentView extends Investment {
  returnCents: number;
  returnPct: number | null;
  allocationPct: number | null;
  contributedCents: number;
}

export function investmentViews(): InvestmentView[] {
  const rows = listInvestments();
  const total = rows.reduce((t, r) => t + r.current_cents, 0);
  return rows.map((r) => {
    const contributed = scalar(
      "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM investment_contributions WHERE investment_id = ?",
      [r.id],
    );
    return {
      ...r,
      returnCents: r.current_cents - r.cost_basis_cents,
      returnPct:
        r.cost_basis_cents > 0
          ? round(((r.current_cents - r.cost_basis_cents) / r.cost_basis_cents) * 100, 2)
          : null,
      allocationPct: total > 0 ? round((r.current_cents / total) * 100, 1) : null,
      contributedCents: contributed,
    };
  });
}

/* -------------------------------------------------------------- net worth */

export function listAssets(): Asset[] {
  return all<Asset>("SELECT * FROM assets ORDER BY value_cents DESC");
}

export function listNetWorthSnapshots(limit = 60): NetWorthSnapshot[] {
  return all<NetWorthSnapshot>("SELECT * FROM net_worth_snapshots ORDER BY date DESC LIMIT ?", [
    limit,
  ]);
}

export interface NetWorthNow {
  cashCents: number;
  investmentsCents: number;
  propertyCents: number;
  businessCents: number;
  otherAssetsCents: number;
  assetsCents: number;
  liabilitiesCents: number;
  netWorthCents: number;
}

export function netWorthNow(): NetWorthNow {
  const cash = cashOnHandCents();
  const investments = scalar("SELECT COALESCE(SUM(current_cents), 0) AS v FROM investments");
  const property = scalar(
    "SELECT COALESCE(SUM(value_cents), 0) AS v FROM assets WHERE kind = 'PROPERTY'",
  );
  const business = scalar(
    "SELECT COALESCE(SUM(value_cents), 0) AS v FROM assets WHERE kind = 'BUSINESS_EQUITY'",
  );
  const other = scalar(
    "SELECT COALESCE(SUM(value_cents), 0) AS v FROM assets WHERE kind NOT IN ('PROPERTY','BUSINESS_EQUITY')",
  );
  const liabilities = totalDebtCents();
  const assets = cash + investments + property + business + other;
  return {
    cashCents: cash,
    investmentsCents: investments,
    propertyCents: property,
    businessCents: business,
    otherAssetsCents: other,
    assetsCents: assets,
    liabilitiesCents: liabilities,
    netWorthCents: assets - liabilities,
  };
}

/* ------------------------------------------------------------- dashboard */

export interface FinanceDashboard {
  now: NetWorthNow;
  snapshots: NetWorthSnapshot[];
  netWorthTrend: ReturnType<typeof metricTrajectory>;
  forecast30: ForecastResult;
  forecast7: ForecastResult;
  income30Cents: number;
  expenses30Cents: number;
  savingsRate: number | null;
  debt: DebtPlan;
  goals: Array<Goal & { progress: number | null }>;
  categories: ReturnType<typeof expensesByCategory>;
  monthIncomeCents: number;
  monthExpensesCents: number;
}

export function financeDashboard(day: DayString = today()): FinanceDashboard {
  const from30 = addDays(day, -29);
  const income30 = incomeBetween(from30, day);
  const expenses30 = personalExpensesBetween(from30, day);
  const snapshots = listNetWorthSnapshots(60);

  return {
    now: netWorthNow(),
    snapshots,
    netWorthTrend: metricTrajectory(
      [...snapshots].reverse().map((s) => s.net_worth_cents),
      2,
    ),
    forecast30: forecast(30, day),
    forecast7: forecast(7, day),
    income30Cents: income30,
    expenses30Cents: expenses30,
    savingsRate: income30 > 0 ? round(((income30 - expenses30) / income30) * 100, 1) : null,
    debt: debtPlan(),
    goals: all<Goal>(
      "SELECT * FROM goals WHERE pillar = 'FINANCE' AND status = 'ACTIVE' ORDER BY sort_order",
    ).map((g) => ({
      ...g,
      progress: progressPct({
        start: g.start_value,
        current: g.current_value,
        target: g.target_value,
        direction: g.direction,
      }),
    })),
    categories: expensesByCategory(startOfMonth(day), day),
    monthIncomeCents: incomeBetween(startOfMonth(day), day),
    monthExpensesCents: personalExpensesBetween(startOfMonth(day), day),
  };
}

export function emergencyBufferTargetCents(): number {
  // One month of the last 90 days' average personal spend, floored sensibly.
  const day = today();
  const spend90 = personalExpensesBetween(addDays(day, -89), day);
  const monthly = spend90 > 0 ? Math.round(spend90 / 3) : 0;
  return Math.max(monthly, 500_000); // R5,000 floor
}

export function latestSnapshot(): NetWorthSnapshot | undefined {
  return get<NetWorthSnapshot>("SELECT * FROM net_worth_snapshots ORDER BY date DESC LIMIT 1");
}
