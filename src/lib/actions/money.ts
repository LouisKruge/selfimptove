"use server";

import { refreshPaths } from "./revalidate";
import { get } from "@/lib/db";
import { insert, remove, update } from "@/lib/db/repo";
import { nowIso, today } from "@/lib/core/date";
import { LEAD_STAGES } from "@/lib/types";
import {
  checkbox,
  dayWithDefault,
  fail,
  formObject,
  id,
  ok,
  optionalDay,
  optionalInt,
  optionalNumber,
  optionalText,
  parseWith,
  randToCents,
  requiredRandToCents,
  requiredText,
  z,
  type ActionResult,
} from "./shared";
import { recomputeDayScore } from "@/lib/services/scores";
import { netWorthNow } from "@/lib/services/finance";

function refresh(...paths: string[]) {
  refreshPaths(["/", "/today", "/business", "/finance", ...paths]);
}

const stage = z.enum([...LEAD_STAGES, "LOST"]);

/* -------------------------------------------------------------- BUSINESS */

export async function upsertBusiness(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id: optionalText,
      name: requiredText,
      model: optionalText,
      stage: z
        .enum(["IDEA", "VALIDATE", "BUILD", "LAUNCH", "SCALE", "SOLD", "CLOSED"])
        .default("BUILD"),
      target_customer: optionalText,
      offer: optionalText,
      avg_deal: randToCents,
      mrr_target: randToCents,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const values = {
    name: v.name,
    model: v.model ?? null,
    stage: v.stage,
    target_customer: v.target_customer ?? null,
    offer: v.offer ?? null,
    avg_deal_cents: v.avg_deal ?? null,
    mrr_target_cents: v.mrr_target ?? null,
  };
  if (v.id) update("businesses", v.id, values);
  else insert("businesses", values);
  refresh("/business/strategy");
  return ok();
}

/* ------------------------------------------------------------------ LEADS */

const leadSchema = z.object({
  company: requiredText,
  contact_name: optionalText,
  contact_email: optionalText,
  contact_phone: optionalText,
  source: optionalText,
  stage: stage.default("PROSPECT"),
  potential: randToCents,
  probability: optionalInt,
  next_action: optionalText,
  next_action_date: optionalDay,
  notes: optionalText,
  business_id: optionalText,
});

export async function createLead(form: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseWith(leadSchema, formObject(form));
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if (v.probability !== undefined && (v.probability < 0 || v.probability > 100)) {
    return fail("Probability must be between 0 and 100.");
  }

  const leadId = insert("leads", {
    company: v.company,
    contact_name: v.contact_name ?? null,
    contact_email: v.contact_email ?? null,
    contact_phone: v.contact_phone ?? null,
    source: v.source ?? null,
    stage: v.stage,
    potential_cents: v.potential ?? 0,
    probability: v.probability ?? defaultProbability(v.stage),
    next_action: v.next_action ?? null,
    next_action_date: v.next_action_date ?? null,
    notes: v.notes ?? null,
    business_id: v.business_id ?? null,
  });

  // Stage history is the only source of conversion rates, so it starts here.
  insert("lead_stage_events", {
    lead_id: leadId,
    from_stage: null,
    to_stage: v.stage,
    date: today(),
  });

  recomputeDayScore(today());
  refresh("/business/sales", `/business/sales/${leadId}`);
  return ok({ id: leadId });
}

export async function updateLead(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(leadSchema.partial().extend({ id }), formObject(form));
  if (!parsed.ok) return parsed.result;
  const { id: leadId, potential, stage: nextStage, ...rest } = parsed.value;

  const existing = get<{ stage: string }>("SELECT stage FROM leads WHERE id = ?", [leadId]);
  if (!existing) return fail("Lead not found.");

  update("leads", leadId, {
    ...rest,
    potential_cents: potential,
    stage: nextStage,
  });

  if (nextStage && nextStage !== existing.stage) {
    await recordStageMove(leadId, existing.stage, nextStage);
  }
  refresh("/business/sales", `/business/sales/${leadId}`);
  return ok();
}

export async function moveLeadStage(leadId: string, nextStage: string): Promise<ActionResult> {
  const parsed = parseWith(z.object({ id, stage }), { id: leadId, stage: nextStage });
  if (!parsed.ok) return parsed.result;

  const existing = get<{ stage: string; potential_cents: number; company: string; business_id: string | null }>(
    "SELECT stage, potential_cents, company, business_id FROM leads WHERE id = ?",
    [leadId],
  );
  if (!existing) return fail("Lead not found.");
  if (existing.stage === parsed.value.stage) return ok();

  await recordStageMove(leadId, existing.stage, parsed.value.stage);
  refresh("/business/sales", `/business/sales/${leadId}`);
  return ok();
}

async function recordStageMove(leadId: string, from: string, to: string) {
  const lead = get<{ company: string; potential_cents: number; business_id: string | null }>(
    "SELECT company, potential_cents, business_id FROM leads WHERE id = ?",
    [leadId],
  );

  update("leads", leadId, {
    stage: to,
    probability: defaultProbability(to),
    last_contact_date: today(),
    closed_at: to === "LOST" || to === "RETAINED" ? nowIso() : null,
  });

  insert("lead_stage_events", {
    lead_id: leadId,
    from_stage: from,
    to_stage: to,
    date: today(),
  });

  // Reaching CUSTOMER creates the customer record if it does not exist.
  if (to === "CUSTOMER" && lead) {
    const existing = get<{ id: string }>("SELECT id FROM customers WHERE lead_id = ?", [leadId]);
    if (!existing) {
      insert("customers", {
        lead_id: leadId,
        business_id: lead.business_id,
        name: lead.company,
        status: "ACTIVE",
        mrr_cents: lead.potential_cents,
        started_at: today(),
      });
    }
  }
  recomputeDayScore(today());
}

export async function deleteLead(leadId: string): Promise<ActionResult> {
  remove("leads", leadId);
  refresh("/business/sales");
  return ok();
}

/* -------------------------------------------------------------- CUSTOMERS */

export async function upsertCustomer(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id: optionalText,
      name: requiredText,
      contact_name: optionalText,
      contact_email: optionalText,
      status: z.enum(["ACTIVE", "PAUSED", "CHURNED"]).default("ACTIVE"),
      mrr: randToCents,
      started_at: dayWithDefault,
      notes: optionalText,
      business_id: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const values = {
    name: v.name,
    contact_name: v.contact_name ?? null,
    contact_email: v.contact_email ?? null,
    status: v.status,
    mrr_cents: v.mrr ?? 0,
    started_at: v.started_at,
    churned_at: v.status === "CHURNED" ? nowIso() : null,
    notes: v.notes ?? null,
    business_id: v.business_id ?? null,
  };
  if (v.id) update("customers", v.id, values);
  else insert("customers", values);

  recomputeDayScore(today());
  refresh("/business/revenue");
  return ok();
}

export async function deleteCustomer(customerId: string): Promise<ActionResult> {
  remove("customers", customerId);
  refresh("/business/revenue");
  return ok();
}

/* ---------------------------------------------------------------- REVENUE */

export async function logRevenue(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      date: dayWithDefault,
      amount: requiredRandToCents,
      kind: z.enum(["ONE_OFF", "RECURRING"]).default("ONE_OFF"),
      description: optionalText,
      customer_id: optionalText,
      business_id: optionalText,
      mirror_income: checkbox,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if (v.amount < 0) return fail("Revenue cannot be negative.");

  insert("revenue_entries", {
    date: v.date,
    amount_cents: v.amount,
    kind: v.kind,
    description: v.description ?? null,
    customer_id: v.customer_id ?? null,
    business_id: v.business_id ?? null,
    received: 1,
  });

  // Money earned by the business is money that reaches the person, so the
  // finance ledger stays in step unless the user opts out.
  if (v.mirror_income) {
    insert("income_entries", {
      date: v.date,
      amount_cents: v.amount,
      source: "BUSINESS",
      description: v.description ?? "Business revenue",
      recurring: v.kind === "RECURRING" ? 1 : 0,
    });
  }

  recomputeDayScore(v.date);
  refresh("/business/revenue", "/finance/cash-flow");
  return ok();
}

export async function deleteRevenue(entryId: string): Promise<ActionResult> {
  const row = get<{ date: string }>("SELECT date FROM revenue_entries WHERE id = ?", [entryId]);
  remove("revenue_entries", entryId);
  if (row) recomputeDayScore(row.date);
  refresh("/business/revenue");
  return ok();
}

export async function logBusinessExpense(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      date: dayWithDefault,
      amount: requiredRandToCents,
      category: optionalText,
      description: optionalText,
      recurring: checkbox,
      business_id: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if (v.amount < 0) return fail("Expenses cannot be negative.");

  insert("business_expenses", {
    date: v.date,
    amount_cents: v.amount,
    category: v.category ?? null,
    description: v.description ?? null,
    recurring: v.recurring ? 1 : 0,
    business_id: v.business_id ?? null,
  });
  refresh("/business/revenue");
  return ok();
}

export async function deleteBusinessExpense(entryId: string): Promise<ActionResult> {
  remove("business_expenses", entryId);
  refresh("/business/revenue");
  return ok();
}

/* --------------------------------------------------------------- ACCOUNTS */

export async function upsertAccount(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id: optionalText,
      name: requiredText,
      kind: z.enum(["CASH", "SAVINGS", "CREDIT", "INVESTMENT"]).default("CASH"),
      balance: randToCents,
      include_in_cash: checkbox,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  const values = {
    name: v.name,
    kind: v.kind,
    balance_cents: v.balance ?? 0,
    include_in_cash: v.include_in_cash ? 1 : 0,
  };
  if (v.id) update("accounts", v.id, values);
  else insert("accounts", values);
  recomputeDayScore(today());
  refresh("/finance/cash-flow", "/finance/net-worth");
  return ok();
}

export async function deleteAccount(accountId: string): Promise<ActionResult> {
  remove("accounts", accountId);
  refresh("/finance/cash-flow");
  return ok();
}

/* ---------------------------------------------------------- CASH MOVEMENT */

export async function logExpense(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      date: dayWithDefault,
      amount: requiredRandToCents,
      category: optionalText,
      description: optionalText,
      essential: checkbox,
      recurring: checkbox,
      account_id: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if (v.amount < 0) return fail("Expenses cannot be negative.");

  insert("personal_expenses", {
    date: v.date,
    amount_cents: v.amount,
    category: v.category ?? "OTHER",
    description: v.description ?? null,
    essential: v.essential ? 1 : 0,
    recurring: v.recurring ? 1 : 0,
  });

  if (v.account_id) {
    const account = get<{ balance_cents: number }>(
      "SELECT balance_cents FROM accounts WHERE id = ?",
      [v.account_id],
    );
    if (account) {
      update("accounts", v.account_id, { balance_cents: account.balance_cents - v.amount });
    }
  }

  recomputeDayScore(v.date);
  refresh("/finance/cash-flow");
  return ok();
}

export async function logIncome(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      date: dayWithDefault,
      amount: requiredRandToCents,
      source: optionalText,
      description: optionalText,
      recurring: checkbox,
      account_id: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if (v.amount < 0) return fail("Income cannot be negative.");

  insert("income_entries", {
    date: v.date,
    amount_cents: v.amount,
    source: v.source ?? "OTHER",
    description: v.description ?? null,
    recurring: v.recurring ? 1 : 0,
  });

  if (v.account_id) {
    const account = get<{ balance_cents: number }>(
      "SELECT balance_cents FROM accounts WHERE id = ?",
      [v.account_id],
    );
    if (account) {
      update("accounts", v.account_id, { balance_cents: account.balance_cents + v.amount });
    }
  }

  recomputeDayScore(v.date);
  refresh("/finance/cash-flow");
  return ok();
}

export async function deleteExpense(entryId: string): Promise<ActionResult> {
  const row = get<{ date: string }>("SELECT date FROM personal_expenses WHERE id = ?", [entryId]);
  remove("personal_expenses", entryId);
  if (row) recomputeDayScore(row.date);
  refresh("/finance/cash-flow");
  return ok();
}

export async function deleteIncome(entryId: string): Promise<ActionResult> {
  const row = get<{ date: string }>("SELECT date FROM income_entries WHERE id = ?", [entryId]);
  remove("income_entries", entryId);
  if (row) recomputeDayScore(row.date);
  refresh("/finance/cash-flow");
  return ok();
}

/* -------------------------------------------------------------- SCHEDULED */

export async function upsertScheduled(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id: optionalText,
      name: requiredText,
      direction: z.enum(["IN", "OUT"]),
      amount: requiredRandToCents,
      cadence: z.enum(["ONCE", "WEEKLY", "MONTHLY"]).default("MONTHLY"),
      day_of_month: optionalInt,
      day_of_week: optionalInt,
      next_date: optionalDay,
      category: optionalText,
      debt_id: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  if (v.cadence === "MONTHLY" && (v.day_of_month === undefined || v.day_of_month < 1 || v.day_of_month > 31)) {
    return fail("Monthly items need a day of the month between 1 and 31.");
  }
  if (v.cadence === "WEEKLY" && (v.day_of_week === undefined || v.day_of_week < 0 || v.day_of_week > 6)) {
    return fail("Weekly items need a day of the week.");
  }
  if (v.cadence === "ONCE" && !v.next_date) return fail("One-off items need a date.");

  const values = {
    name: v.name,
    direction: v.direction,
    amount_cents: v.amount,
    cadence: v.cadence,
    day_of_month: v.cadence === "MONTHLY" ? v.day_of_month : null,
    day_of_week: v.cadence === "WEEKLY" ? v.day_of_week : null,
    next_date: v.next_date ?? null,
    category: v.category ?? null,
    debt_id: v.debt_id ?? null,
    active: 1,
  };
  if (v.id) update("scheduled_cash_items", v.id, values);
  else insert("scheduled_cash_items", values);

  recomputeDayScore(today());
  refresh("/finance/cash-flow");
  return ok();
}

export async function toggleScheduled(itemId: string): Promise<ActionResult> {
  const row = get<{ active: number }>("SELECT active FROM scheduled_cash_items WHERE id = ?", [
    itemId,
  ]);
  if (!row) return fail("Scheduled item not found.");
  update("scheduled_cash_items", itemId, { active: row.active ? 0 : 1 });
  recomputeDayScore(today());
  refresh("/finance/cash-flow");
  return ok();
}

export async function deleteScheduled(itemId: string): Promise<ActionResult> {
  remove("scheduled_cash_items", itemId);
  recomputeDayScore(today());
  refresh("/finance/cash-flow");
  return ok();
}

/* ------------------------------------------------------------------- DEBT */

export async function upsertDebt(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id: optionalText,
      name: requiredText,
      kind: z.enum(["LOAN", "CREDIT_CARD", "VEHICLE", "BOND", "FAMILY", "OTHER"]).default("LOAN"),
      original: randToCents,
      balance: randToCents,
      interest_rate: optionalNumber,
      min_payment: randToCents,
      due_day: optionalInt,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if ((v.balance ?? 0) < 0) return fail("A debt balance cannot be negative.");

  const values = {
    name: v.name,
    kind: v.kind,
    original_cents: v.original ?? v.balance ?? 0,
    balance_cents: v.balance ?? 0,
    interest_rate: v.interest_rate ?? null,
    min_payment_cents: v.min_payment ?? 0,
    due_day: v.due_day ?? null,
    status: (v.balance ?? 0) === 0 ? "SETTLED" : "ACTIVE",
  };
  if (v.id) update("debts", v.id, values);
  else insert("debts", values);

  recomputeDayScore(today());
  refresh("/finance/debt", "/finance/net-worth");
  return ok();
}

export async function logDebtPayment(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({ debt_id: id, date: dayWithDefault, amount: requiredRandToCents }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if (v.amount <= 0) return fail("A payment must be greater than zero.");

  const debt = get<{ balance_cents: number }>("SELECT balance_cents FROM debts WHERE id = ?", [
    v.debt_id,
  ]);
  if (!debt) return fail("Debt not found.");

  const balanceAfter = Math.max(0, debt.balance_cents - v.amount);
  insert("debt_payments", {
    debt_id: v.debt_id,
    date: v.date,
    amount_cents: v.amount,
    balance_after: balanceAfter,
  });
  update("debts", v.debt_id, {
    balance_cents: balanceAfter,
    status: balanceAfter === 0 ? "SETTLED" : "ACTIVE",
    settled_at: balanceAfter === 0 ? nowIso() : null,
  });

  recomputeDayScore(v.date);
  refresh("/finance/debt", "/finance/net-worth");
  return ok();
}

export async function deleteDebt(debtId: string): Promise<ActionResult> {
  remove("debts", debtId);
  recomputeDayScore(today());
  refresh("/finance/debt");
  return ok();
}

/* ------------------------------------------------------------ INVESTMENTS */

export async function upsertInvestment(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id: optionalText,
      name: requiredText,
      asset_class: z
        .enum(["EQUITY", "ETF", "BOND", "PROPERTY", "CASH", "BUSINESS", "CRYPTO", "OTHER"])
        .default("ETF"),
      objective: optionalText,
      opened_at: dayWithDefault,
      cost_basis: randToCents,
      current_value: randToCents,
      notes: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;

  const values = {
    name: v.name,
    asset_class: v.asset_class,
    objective: v.objective ?? null,
    opened_at: v.opened_at,
    cost_basis_cents: v.cost_basis ?? 0,
    current_cents: v.current_value ?? v.cost_basis ?? 0,
    notes: v.notes ?? null,
  };
  if (v.id) update("investments", v.id, values);
  else insert("investments", values);

  refresh("/finance/investments", "/finance/net-worth");
  return ok();
}

export async function logContribution(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      investment_id: id,
      date: dayWithDefault,
      amount: requiredRandToCents,
      note: optionalText,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  if (v.amount <= 0) return fail("A contribution must be greater than zero.");

  const investment = get<{ cost_basis_cents: number; current_cents: number }>(
    "SELECT cost_basis_cents, current_cents FROM investments WHERE id = ?",
    [v.investment_id],
  );
  if (!investment) return fail("Investment not found.");

  insert("investment_contributions", {
    investment_id: v.investment_id,
    date: v.date,
    amount_cents: v.amount,
    note: v.note ?? null,
  });
  update("investments", v.investment_id, {
    cost_basis_cents: investment.cost_basis_cents + v.amount,
    current_cents: investment.current_cents + v.amount,
  });

  refresh("/finance/investments", "/finance/net-worth");
  return ok();
}

export async function deleteInvestment(investmentId: string): Promise<ActionResult> {
  remove("investments", investmentId);
  refresh("/finance/investments");
  return ok();
}

/* ----------------------------------------------------------------- ASSETS */

export async function upsertAsset(form: FormData): Promise<ActionResult> {
  const parsed = parseWith(
    z.object({
      id: optionalText,
      name: requiredText,
      kind: z.enum(["PROPERTY", "VEHICLE", "BUSINESS_EQUITY", "OTHER"]).default("OTHER"),
      value: randToCents,
    }),
    formObject(form),
  );
  if (!parsed.ok) return parsed.result;
  const v = parsed.value;
  const values = { name: v.name, kind: v.kind, value_cents: v.value ?? 0 };
  if (v.id) update("assets", v.id, values);
  else insert("assets", values);
  refresh("/finance/net-worth");
  return ok();
}

export async function deleteAsset(assetId: string): Promise<ActionResult> {
  remove("assets", assetId);
  refresh("/finance/net-worth");
  return ok();
}

/** Freezes today's balance sheet into the net-worth history. */
export async function snapshotNetWorth(): Promise<ActionResult> {
  const day = today();
  const now = netWorthNow();
  const values = {
    date: day,
    cash_cents: now.cashCents,
    investments_cents: now.investmentsCents,
    property_cents: now.propertyCents,
    business_cents: now.businessCents,
    other_assets_cents: now.otherAssetsCents,
    liabilities_cents: now.liabilitiesCents,
    net_worth_cents: now.netWorthCents,
  };
  const existing = get<{ id: string }>("SELECT id FROM net_worth_snapshots WHERE date = ?", [day]);
  if (existing) update("net_worth_snapshots", existing.id, values);
  else insert("net_worth_snapshots", values);
  refresh("/finance/net-worth");
  return ok();
}

/* ------------------------------------------------------------------ utils */

function defaultProbability(leadStage: string): number {
  switch (leadStage) {
    case "PROSPECT":
      return 5;
    case "CONTACTED":
      return 10;
    case "RESPONDED":
      return 25;
    case "MEETING":
      return 40;
    case "PROPOSAL":
      return 60;
    case "CUSTOMER":
      return 100;
    case "RETAINED":
      return 100;
    default:
      return 0;
  }
}
