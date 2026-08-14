"use client";

import { useTransition } from "react";
import {
  logContribution,
  logDebtPayment,
  logExpense,
  logIncome,
  snapshotNetWorth,
  toggleScheduled,
  upsertAccount,
  upsertAsset,
  upsertDebt,
  upsertInvestment,
  upsertScheduled,
} from "@/lib/actions/money";
import {
  ActionForm,
  CheckboxField,
  FieldRow,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "../forms";
import { cx } from "../primitives";

const WEEKDAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

export function ExpenseForm({
  date,
  accounts,
}: {
  date: string;
  accounts: Array<{ value: string; label: string }>;
}) {
  return (
    <ActionForm action={logExpense} resetOnSuccess className="panel p-4 sm:p-5">
      <FieldRow cols={4}>
        <TextField label="Date" name="date" type="date" defaultValue={date} />
        <TextField label="Amount (R)" name="amount" type="number" step="0.01" required inputMode="decimal" />
        <TextField label="Category" name="category" placeholder="Food" />
        <SelectField label="Account" name="account_id" includeBlank blankLabel="No account" options={accounts} />
      </FieldRow>
      <TextField label="Description" name="description" />
      <FieldRow cols={2}>
        <CheckboxField label="Essential" name="essential" defaultChecked />
        <CheckboxField label="Recurring" name="recurring" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton>Log expense</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function IncomeForm({
  date,
  accounts,
}: {
  date: string;
  accounts: Array<{ value: string; label: string }>;
}) {
  return (
    <ActionForm action={logIncome} resetOnSuccess className="panel p-4 sm:p-5">
      <FieldRow cols={4}>
        <TextField label="Date" name="date" type="date" defaultValue={date} />
        <TextField label="Amount (R)" name="amount" type="number" step="0.01" required />
        <SelectField
          label="Source"
          name="source"
          defaultValue="BUSINESS"
          options={["BUSINESS", "SALARY", "OTHER"].map((v) => ({ value: v, label: v }))}
        />
        <SelectField label="Account" name="account_id" includeBlank blankLabel="No account" options={accounts} />
      </FieldRow>
      <TextField label="Description" name="description" />
      <CheckboxField label="Recurring" name="recurring" />
      <div className="flex justify-end">
        <SubmitButton>Log income</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AccountForm() {
  return (
    <ActionForm action={upsertAccount} resetOnSuccess>
      <FieldRow cols={3}>
        <TextField label="Account" name="name" required placeholder="Cheque account" />
        <SelectField
          label="Kind"
          name="kind"
          defaultValue="CASH"
          options={["CASH", "SAVINGS", "CREDIT", "INVESTMENT"].map((v) => ({ value: v, label: v }))}
        />
        <TextField label="Balance (R)" name="balance" type="number" step="0.01" />
      </FieldRow>
      <CheckboxField
        label="Include in available cash"
        name="include_in_cash"
        defaultChecked
        hint="Only included accounts feed the cash-flow forecast."
      />
      <div className="flex justify-end">
        <SubmitButton variant="default">Save account</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ScheduledForm({ debts }: { debts: Array<{ value: string; label: string }> }) {
  return (
    <ActionForm action={upsertScheduled} resetOnSuccess>
      <FieldRow cols={3}>
        <TextField label="Name" name="name" required placeholder="Rent" />
        <SelectField
          label="Direction"
          name="direction"
          defaultValue="OUT"
          options={[
            { value: "OUT", label: "Money out" },
            { value: "IN", label: "Money in" },
          ]}
        />
        <TextField label="Amount (R)" name="amount" type="number" step="0.01" required />
      </FieldRow>
      <FieldRow cols={4}>
        <SelectField
          label="Cadence"
          name="cadence"
          defaultValue="MONTHLY"
          options={[
            { value: "MONTHLY", label: "Monthly" },
            { value: "WEEKLY", label: "Weekly" },
            { value: "ONCE", label: "One-off" },
          ]}
        />
        <TextField
          label="Day of month"
          name="day_of_month"
          type="number"
          min="1"
          max="31"
          hint="Monthly items. Use 31 for the last day — short months clamp back."
        />
        <SelectField label="Day of week" name="day_of_week" includeBlank options={WEEKDAYS} hint="Weekly items" />
        <TextField label="Date" name="next_date" type="date" hint="One-off items" />
      </FieldRow>
      <FieldRow cols={2}>
        <TextField label="Category" name="category" placeholder="Housing" />
        <SelectField label="Linked debt" name="debt_id" includeBlank options={debts} />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Save scheduled item</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ScheduledToggle({ itemId, active }: { itemId: string; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void toggleScheduled(itemId))}
      className={cx(
        "border px-2 py-1 text-[0.5625rem] uppercase tracking-[0.12em] transition-colors",
        active ? "border-line-strong text-ink" : "border-line text-ink-ghost",
      )}
    >
      {active ? "Active" : "Paused"}
    </button>
  );
}

export function DebtForm() {
  return (
    <ActionForm action={upsertDebt} resetOnSuccess>
      <FieldRow cols={3}>
        <TextField label="Debt" name="name" required placeholder="Credit card" />
        <SelectField
          label="Kind"
          name="kind"
          defaultValue="LOAN"
          options={["LOAN", "CREDIT_CARD", "VEHICLE", "BOND", "FAMILY", "OTHER"].map((v) => ({
            value: v,
            label: v.replace("_", " "),
          }))}
        />
        <TextField label="Balance (R)" name="balance" type="number" step="0.01" required />
      </FieldRow>
      <FieldRow cols={4}>
        <TextField label="Original (R)" name="original" type="number" step="0.01" />
        <TextField label="Interest rate (%)" name="interest_rate" type="number" step="0.01" />
        <TextField label="Minimum payment (R)" name="min_payment" type="number" step="0.01" />
        <TextField label="Due day" name="due_day" type="number" min="1" max="31" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Save debt</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DebtPaymentForm({
  debtId,
  date,
  minPaymentCents,
}: {
  debtId: string;
  date: string;
  minPaymentCents: number;
}) {
  return (
    <ActionForm action={logDebtPayment} resetOnSuccess>
      <input type="hidden" name="debt_id" value={debtId} />
      <div className="flex items-end gap-2">
        <TextField
          label="Payment (R)"
          name="amount"
          type="number"
          step="0.01"
          defaultValue={minPaymentCents > 0 ? Math.round(minPaymentCents / 100) : undefined}
          className="flex-1"
        />
        <TextField label="Date" name="date" type="date" defaultValue={date} className="flex-1" />
        <SubmitButton variant="default">Pay</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function InvestmentForm({ date }: { date: string }) {
  return (
    <ActionForm action={upsertInvestment} resetOnSuccess>
      <FieldRow cols={3}>
        <TextField label="Investment" name="name" required placeholder="Global equity ETF" />
        <SelectField
          label="Asset class"
          name="asset_class"
          defaultValue="ETF"
          options={["EQUITY", "ETF", "BOND", "PROPERTY", "CASH", "BUSINESS", "CRYPTO", "OTHER"].map(
            (v) => ({ value: v, label: v }),
          )}
        />
        <TextField label="Opened" name="opened_at" type="date" defaultValue={date} />
      </FieldRow>
      <FieldRow cols={2}>
        <TextField label="Cost basis (R)" name="cost_basis" type="number" step="0.01" />
        <TextField label="Current value (R)" name="current_value" type="number" step="0.01" />
      </FieldRow>
      <TextArea label="Objective" name="objective" rows={2} placeholder="Why this is held, and for how long." />
      <div className="flex justify-end">
        <SubmitButton variant="default">Save investment</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ContributionForm({ investmentId, date }: { investmentId: string; date: string }) {
  return (
    <ActionForm action={logContribution} resetOnSuccess>
      <input type="hidden" name="investment_id" value={investmentId} />
      <div className="flex items-end gap-2">
        <TextField label="Contribution (R)" name="amount" type="number" step="0.01" className="flex-1" />
        <TextField label="Date" name="date" type="date" defaultValue={date} className="flex-1" />
        <SubmitButton variant="default">Add</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AssetForm() {
  return (
    <ActionForm action={upsertAsset} resetOnSuccess>
      <FieldRow cols={3}>
        <TextField label="Asset" name="name" required placeholder="Vehicle" />
        <SelectField
          label="Kind"
          name="kind"
          defaultValue="OTHER"
          options={["PROPERTY", "VEHICLE", "BUSINESS_EQUITY", "OTHER"].map((v) => ({
            value: v,
            label: v.replace("_", " "),
          }))}
        />
        <TextField label="Value (R)" name="value" type="number" step="0.01" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Save asset</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SnapshotButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void snapshotNetWorth())}
      className="btn btn-primary"
    >
      Snapshot today
    </button>
  );
}
