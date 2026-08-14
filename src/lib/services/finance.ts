import "server-only";

import { all, get, scalar } from "@/lib/db";
import { byId } from "@/lib/db/repo";
import { addDays, startOfMonth, today, type DayString } from "@/lib/core/date";
import { debtsAsScheduled, forecastCash, type ForecastResult } from "@/lib/domain/forecast";
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

export async function listAccounts(): Promise<Account[]> {
  return await all<Account>("SELECT * FROM accounts ORDER BY kind, name");
}

export async function cashOnHandCents(): Promise<number> {
  return await scalar(
      "SELECT COALESCE(SUM(balance_cents), 0) AS v FROM accounts WHERE include_in_cash = 1",
    );
}

/* ---------------------------------------------------------------- ledgers */

export async function listPersonalExpenses(limit = 100): Promise<PersonalExpense[]> {
  return await all<PersonalExpense>("SELECT * FROM personal_expenses ORDER BY date DESC LIMIT ?", [limit]);
}

export async function listIncome(limit = 100): Promise<IncomeEntry[]> {
  return await all<IncomeEntry>("SELECT * FROM income_entries ORDER BY date DESC LIMIT ?", [limit]);
}

export async function incomeBetween(from: DayString, to: DayString): Promise<number> {
  return await scalar(
      "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM income_entries WHERE date BETWEEN ? AND ?",
      [from, to],
    );
}

export async function personalExpensesBetween(from: DayString, to: DayString): Promise<number> {
  return await scalar(
      "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM personal_expenses WHERE date BETWEEN ? AND ?",
      [from, to],
    );
}

export async function expensesByCategory(from: DayString, to: DayString) {
  return await all<{ category: string; total: number; count: number }>(
      `SELECT category, SUM(amount_cents) AS total, COUNT(*) AS count
       FROM personal_expenses WHERE date BETWEEN ? AND ?
      GROUP BY category ORDER BY total DESC`,
      [from, to],
    );
}

/* -------------------------------------------------------------- scheduled */

export async function listScheduled(activeOnly = true): Promise<ScheduledCashItem[]> {
  return await all<ScheduledCashItem>(
      `SELECT * FROM scheduled_cash_items ${activeOnly ? "WHERE active = 1" : ""}
      ORDER BY direction DESC, day_of_month, name`,
    );
}

export async function forecast(horizonDays: number, day: DayString = today()): Promise<ForecastResult> {
  const scheduled = await listScheduled(true);
  const debts = await listDebts();
  return forecastCash({
    openingCents: await cashOnHandCents(),
    // Recorded debts are known outflows too, not just whatever was entered by
    // hand as a scheduled item.
    items: [...scheduled, ...debtsAsScheduled(debts, scheduled)],
    from: day,
    horizonDays,
  });
}

export async function forecasts(day: DayString = today()) {
  return {
    week: await forecast(7, day),
    month: await forecast(30, day),
    quarter: await forecast(90, day),
  };
}

/* ------------------------------------------------------------------- debt */

export async function listDebts(includeSettled = false): Promise<Debt[]> {
  return await all<Debt>(
      `SELECT * FROM debts ${includeSettled ? "" : "WHERE status = 'ACTIVE'"} ORDER BY balance_cents DESC`,
    );
}

export async function getDebt(id: string): Promise<Debt | undefined> {
  return await byId<Debt>("debts", id);
}

export async function debtPayments(debtId?: string): Promise<DebtPayment[]> {
  return debtId
    ? await all<DebtPayment>("SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date DESC", [debtId])
    : await all<DebtPayment>("SELECT * FROM debt_payments ORDER BY date DESC LIMIT 100");
}

export async function totalDebtCents(): Promise<number> {
  return await scalar("SELECT COALESCE(SUM(balance_cents), 0) AS v FROM debts WHERE status = 'ACTIVE'");
}

/** Reconstructs the total debt balance as at a past date from payment history. */
export async function debtBalanceAsOf(day: DayString): Promise<number> {
  const paidSince = await scalar(
      "SELECT COALESCE(SUM(amount_cents), 0) AS v FROM debt_payments WHERE date > ?",
      [day],
    );
  return await totalDebtCents() + paidSince;
}

export interface DebtPlan {
  debts: Debt[];
  totalCents: number;
  totalMinPaymentCents: number;
  /** Smallest balance first — the order that produces the earliest clean kill. */
  payoffOrder: Debt[];
  monthsToClearAtMinimum: number | null;
}

export async function debtPlan(): Promise<DebtPlan> {
  const debts = await listDebts();
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

export async function listInvestments(): Promise<Investment[]> {
  return await all<Investment>("SELECT * FROM investments ORDER BY current_cents DESC");
}

export async function getInvestment(id: string): Promise<Investment | undefined> {
  return await byId<Investment>("investments", id);
}

export async function investmentContributions(investmentId?: string): Promise<InvestmentContribution[]> {
  return investmentId
    ? await all<InvestmentContribution>(
              "SELECT * FROM investment_contributions WHERE investment_id = ? ORDER BY date DESC",
              [investmentId],
            )
    : await all<InvestmentContribution>(
              "SELECT * FROM investment_contributions ORDER BY date DESC LIMIT 100",
            );
}

export interface InvestmentView extends Investment {
  returnCents: number;
  returnPct: number | null;
  allocationPct: number | null;
  contributedCents: number;
}

export async function investmentViews(): Promise<InvestmentView[]> {
  const rows = await listInvestments();
  const total = rows.reduce((t, r) => t + r.current_cents, 0);
  return Promise.all(
    rows.map(async (r) => {
      const contributed = await scalar(
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
    }),
  );
}

/* -------------------------------------------------------------- net worth */

export async function listAssets(): Promise<Asset[]> {
  return await all<Asset>("SELECT * FROM assets ORDER BY value_cents DESC");
}

export async function listNetWorthSnapshots(limit = 60): Promise<NetWorthSnapshot[]> {
  return await all<NetWorthSnapshot>("SELECT * FROM net_worth_snapshots ORDER BY date DESC LIMIT ?", [
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

export async function netWorthNow(): Promise<NetWorthNow> {
  const cash = await cashOnHandCents();
  const investments = await scalar("SELECT COALESCE(SUM(current_cents), 0) AS v FROM investments");
  const property = await scalar(
      "SELECT COALESCE(SUM(value_cents), 0) AS v FROM assets WHERE kind = 'PROPERTY'",
    );
  const business = await scalar(
      "SELECT COALESCE(SUM(value_cents), 0) AS v FROM assets WHERE kind = 'BUSINESS_EQUITY'",
    );
  const other = await scalar(
      "SELECT COALESCE(SUM(value_cents), 0) AS v FROM assets WHERE kind NOT IN ('PROPERTY','BUSINESS_EQUITY')",
    );
  const liabilities = await totalDebtCents();
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

export interface CashMonth {
  month: string;
  incomeCents: number;
  expensesCents: number;
  netCents: number;
}

/**
 * Income and expenses per calendar month, oldest first.
 *
 * Months with nothing recorded are dropped rather than drawn as zero — an
 * empty month means nothing was logged, which is not the same as a month in
 * which nothing was earned or spent.
 */
export async function cashByMonth(months = 6, day: DayString = today()): Promise<CashMonth[]> {
  const from = startOfMonth(addDays(startOfMonth(day), -(months - 1) * 31));

  const income = await all<{ month: string; total: number }>(
    `SELECT substr(date, 1, 7) AS month, SUM(amount_cents) AS total
       FROM income_entries WHERE date >= ? GROUP BY month`,
    [from],
  );
  const spend = await all<{ month: string; total: number }>(
    `SELECT substr(date, 1, 7) AS month, SUM(amount_cents) AS total
       FROM personal_expenses WHERE date >= ? GROUP BY month`,
    [from],
  );

  const keys = [...new Set([...income.map((r) => r.month), ...spend.map((r) => r.month)])].sort();
  return keys.map((month) => {
    const incomeCents = income.find((r) => r.month === month)?.total ?? 0;
    const expensesCents = spend.find((r) => r.month === month)?.total ?? 0;
    return { month, incomeCents, expensesCents, netCents: incomeCents - expensesCents };
  });
}

export interface FinanceDashboard {
  now: NetWorthNow;
  snapshots: NetWorthSnapshot[];
  netWorthTrend: Awaited<ReturnType<typeof metricTrajectory>>;
  forecast30: ForecastResult;
  forecast7: ForecastResult;
  income30Cents: number;
  expenses30Cents: number;
  savingsRate: number | null;
  debt: DebtPlan;
  goals: Array<Goal & { progress: number | null }>;
  categories: Awaited<ReturnType<typeof expensesByCategory>>;
  cashMonths: CashMonth[];
  monthIncomeCents: number;
  monthExpensesCents: number;
}

export async function financeDashboard(day: DayString = today()): Promise<FinanceDashboard> {
  const from30 = addDays(day, -29);
  const income30 = await incomeBetween(from30, day);
  const expenses30 = await personalExpensesBetween(from30, day);
  const snapshots = await listNetWorthSnapshots(60);

  return {
    now: await netWorthNow(),
    snapshots,
    cashMonths: await cashByMonth(6, day),
    netWorthTrend: metricTrajectory(
      [...snapshots].reverse().map((s) => s.net_worth_cents),
      2,
    ),
    forecast30: await forecast(30, day),
    forecast7: await forecast(7, day),
    income30Cents: income30,
    expenses30Cents: expenses30,
    savingsRate: income30 > 0 ? round(((income30 - expenses30) / income30) * 100, 1) : null,
    debt: await debtPlan(),
    goals: (await all<Goal>(
          "SELECT * FROM goals WHERE pillar = 'FINANCE' AND status = 'ACTIVE' ORDER BY sort_order",
        )).map((g) => ({
      ...g,
      progress: progressPct({
        start: g.start_value,
        current: g.current_value,
        target: g.target_value,
        direction: g.direction,
      }),
    })),
    categories: await expensesByCategory(startOfMonth(day), day),
    monthIncomeCents: await incomeBetween(startOfMonth(day), day),
    monthExpensesCents: await personalExpensesBetween(startOfMonth(day), day),
  };
}

export async function emergencyBufferTargetCents(): Promise<number> {
  // One month of the last 90 days' average personal spend, floored sensibly.
  const day = today();
  const spend90 = await personalExpensesBetween(addDays(day, -89), day);
  const monthly = spend90 > 0 ? Math.round(spend90 / 3) : 0;
  return Math.max(monthly, 500_000); // R5,000 floor
}

export async function latestSnapshot(): Promise<NetWorthSnapshot | undefined> {
  return await get<NetWorthSnapshot>("SELECT * FROM net_worth_snapshots ORDER BY date DESC LIMIT 1");
}
