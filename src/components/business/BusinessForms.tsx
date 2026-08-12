"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createLead,
  deleteLead,
  logBusinessExpense,
  logRevenue,
  moveLeadStage,
  updateLead,
  upsertBusiness,
  upsertCustomer,
} from "@/lib/actions/money";
import { createProject, setProjectStatus } from "@/lib/actions/plan";
import { LEAD_STAGES } from "@/lib/types";
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

const STAGE_OPTIONS = [...LEAD_STAGES, "LOST"].map((s) => ({ value: s, label: s.replace("_", " ") }));

export function LeadForm({ businessId }: { businessId?: string }) {
  const router = useRouter();
  return (
    <ActionForm
      action={async (form) => {
        const result = await createLead(form);
        if (result.ok) router.push(`/business/sales/${result.data.id}`);
        return result;
      }}
      className="panel p-4 sm:p-5"
    >
      {businessId ? <input type="hidden" name="business_id" value={businessId} /> : null}
      <FieldRow cols={3}>
        <TextField label="Company" name="company" required placeholder="Meridian Plumbing" />
        <TextField label="Contact" name="contact_name" />
        <TextField label="Source" name="source" placeholder="Cold email" />
      </FieldRow>
      <FieldRow cols={3}>
        <TextField label="Email" name="contact_email" type="email" />
        <TextField label="Phone" name="contact_phone" />
        <SelectField label="Stage" name="stage" defaultValue="PROSPECT" options={STAGE_OPTIONS} />
      </FieldRow>
      <FieldRow cols={3}>
        <TextField label="Potential value (R)" name="potential" type="number" step="1" inputMode="numeric" />
        <TextField label="Next action" name="next_action" placeholder="Send the first email" />
        <TextField label="Next action date" name="next_action_date" type="date" />
      </FieldRow>
      <TextArea label="Notes" name="notes" rows={2} />
      <div className="flex justify-end">
        <SubmitButton>Add lead</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function LeadEditForm({
  lead,
}: {
  lead: {
    id: string;
    company: string;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    source: string | null;
    stage: string;
    potential_cents: number;
    probability: number;
    next_action: string | null;
    next_action_date: string | null;
    notes: string | null;
  };
}) {
  return (
    <ActionForm action={updateLead} className="panel p-4 sm:p-5">
      <input type="hidden" name="id" value={lead.id} />
      <FieldRow cols={3}>
        <TextField label="Company" name="company" defaultValue={lead.company} required />
        <TextField label="Contact" name="contact_name" defaultValue={lead.contact_name} />
        <TextField label="Source" name="source" defaultValue={lead.source} />
      </FieldRow>
      <FieldRow cols={3}>
        <TextField label="Email" name="contact_email" type="email" defaultValue={lead.contact_email} />
        <TextField label="Phone" name="contact_phone" defaultValue={lead.contact_phone} />
        <TextField
          label="Potential value (R)"
          name="potential"
          type="number"
          defaultValue={Math.round(lead.potential_cents / 100)}
        />
      </FieldRow>
      <FieldRow cols={3}>
        <TextField
          label="Probability (%)"
          name="probability"
          type="number"
          min="0"
          max="100"
          defaultValue={lead.probability}
        />
        <TextField label="Next action" name="next_action" defaultValue={lead.next_action} />
        <TextField
          label="Next action date"
          name="next_action_date"
          type="date"
          defaultValue={lead.next_action_date}
        />
      </FieldRow>
      <TextArea label="Notes" name="notes" rows={3} defaultValue={lead.notes} />
      <div className="flex justify-end">
        <SubmitButton>Save lead</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Moving a stage writes an immutable event — the only source of conversion rates. */
export function StageMover({ leadId, stage }: { leadId: string; stage: string }) {
  const [pending, startTransition] = useTransition();
  const currentIndex = LEAD_STAGES.indexOf(stage as (typeof LEAD_STAGES)[number]);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {LEAD_STAGES.map((s, i) => (
        <button
          key={s}
          type="button"
          disabled={pending || s === stage}
          onClick={() => startTransition(() => void moveLeadStage(leadId, s))}
          className={cx(
            "border px-2 py-1 text-[0.5625rem] uppercase tracking-[0.1em] transition-colors",
            s === stage
              ? "border-ink bg-ink text-inverse"
              : i <= currentIndex
                ? "border-line-strong text-ink-dim"
                : "border-line text-ink-ghost hover:border-line-strong hover:text-ink-dim",
          )}
        >
          {s.replace("_", " ")}
        </button>
      ))}
      <button
        type="button"
        disabled={pending || stage === "LOST"}
        onClick={() => startTransition(() => void moveLeadStage(leadId, "LOST"))}
        className={cx(
          "border px-2 py-1 text-[0.5625rem] uppercase tracking-[0.1em] transition-colors",
          stage === "LOST"
            ? "border-critical text-critical"
            : "border-line text-ink-ghost hover:border-critical hover:text-critical",
        )}
      >
        Lost
      </button>
    </div>
  );
}

export function DeleteLeadButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this lead and its stage history? Conversion rates will change."))
          return;
        startTransition(async () => {
          await deleteLead(leadId);
          router.push("/business/sales");
        });
      }}
      className="btn btn-ghost"
    >
      Delete
    </button>
  );
}

export function RevenueForm({
  date,
  customers,
  businessId,
}: {
  date: string;
  customers: Array<{ value: string; label: string }>;
  businessId?: string;
}) {
  return (
    <ActionForm action={logRevenue} resetOnSuccess className="panel p-4 sm:p-5">
      {businessId ? <input type="hidden" name="business_id" value={businessId} /> : null}
      <FieldRow cols={4}>
        <TextField label="Date" name="date" type="date" defaultValue={date} />
        <TextField label="Amount (R)" name="amount" type="number" step="1" required inputMode="numeric" />
        <SelectField
          label="Kind"
          name="kind"
          defaultValue="ONE_OFF"
          options={[
            { value: "ONE_OFF", label: "One-off" },
            { value: "RECURRING", label: "Recurring" },
          ]}
        />
        <SelectField label="Customer" name="customer_id" includeBlank options={customers} />
      </FieldRow>
      <TextField label="Description" name="description" placeholder="Retainer · March" />
      <CheckboxField
        label="Also record as personal income"
        name="mirror_income"
        defaultChecked
        hint="Keeps the finance ledger in step with money the business actually brought in."
      />
      <div className="flex justify-end">
        <SubmitButton>Log revenue</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function BusinessExpenseForm({ date, businessId }: { date: string; businessId?: string }) {
  return (
    <ActionForm action={logBusinessExpense} resetOnSuccess>
      {businessId ? <input type="hidden" name="business_id" value={businessId} /> : null}
      <FieldRow cols={4}>
        <TextField label="Date" name="date" type="date" defaultValue={date} />
        <TextField label="Amount (R)" name="amount" type="number" step="1" required />
        <TextField label="Category" name="category" placeholder="Tooling" />
        <TextField label="Description" name="description" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Log expense</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CustomerForm({ date, businessId }: { date: string; businessId?: string }) {
  return (
    <ActionForm action={upsertCustomer} resetOnSuccess>
      {businessId ? <input type="hidden" name="business_id" value={businessId} /> : null}
      <FieldRow cols={4}>
        <TextField label="Customer" name="name" required />
        <TextField label="MRR (R)" name="mrr" type="number" step="1" />
        <TextField label="Started" name="started_at" type="date" defaultValue={date} />
        <SelectField
          label="Status"
          name="status"
          defaultValue="ACTIVE"
          options={["ACTIVE", "PAUSED", "CHURNED"].map((v) => ({ value: v, label: v }))}
        />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Save customer</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function BusinessProfileForm({
  business,
}: {
  business: {
    id: string;
    name: string;
    model: string | null;
    stage: string;
    target_customer: string | null;
    offer: string | null;
    avg_deal_cents: number | null;
    mrr_target_cents: number | null;
  } | null;
}) {
  return (
    <ActionForm action={upsertBusiness} className="panel p-4 sm:p-5">
      {business ? <input type="hidden" name="id" value={business.id} /> : null}
      <FieldRow cols={3}>
        <TextField label="Business" name="name" defaultValue={business?.name} required />
        <SelectField
          label="Stage"
          name="stage"
          defaultValue={business?.stage ?? "BUILD"}
          options={["IDEA", "VALIDATE", "BUILD", "LAUNCH", "SCALE", "SOLD", "CLOSED"].map((v) => ({
            value: v,
            label: v,
          }))}
        />
        <TextField label="Model" name="model" defaultValue={business?.model} placeholder="Productised service" />
      </FieldRow>
      <TextArea
        label="Target customer"
        name="target_customer"
        rows={2}
        defaultValue={business?.target_customer}
        placeholder="Who exactly, with what problem, at what size?"
      />
      <TextArea
        label="Offer"
        name="offer"
        rows={2}
        defaultValue={business?.offer}
        placeholder="What they get, what it costs, why now."
      />
      <FieldRow cols={2}>
        <TextField
          label="Average deal value (R)"
          name="avg_deal"
          type="number"
          step="1"
          defaultValue={business?.avg_deal_cents ? Math.round(business.avg_deal_cents / 100) : undefined}
          hint="Used to back-solve how many customers the target needs."
        />
        <TextField
          label="MRR target (R)"
          name="mrr_target"
          type="number"
          step="1"
          defaultValue={business?.mrr_target_cents ? Math.round(business.mrr_target_cents / 100) : undefined}
        />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton>Save business</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ProjectForm({
  missions,
  goals,
}: {
  missions: Array<{ value: string; label: string }>;
  goals: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  return (
    <ActionForm
      action={async (form) => {
        const result = await createProject(form);
        if (result.ok) router.push(`/business/projects/${result.data.id}`);
        return result;
      }}
      className="panel p-4 sm:p-5"
    >
      <TextField label="Project" name="title" required placeholder="Launch MVP" />
      <TextArea label="Objective" name="objective" rows={2} />
      <TextArea label="Expected outcome" name="expected_outcome" rows={2} />
      <FieldRow cols={3}>
        <TextField label="Revenue impact (R)" name="revenue_impact" type="number" step="1" />
        <TextField label="Cost (R)" name="cost" type="number" step="1" />
        <TextField label="Deadline" name="deadline" type="date" />
      </FieldRow>
      <FieldRow cols={3}>
        <SelectField label="Mission" name="mission_id" includeBlank blankLabel="Not linked" options={missions} />
        <SelectField label="Goal" name="goal_id" includeBlank blankLabel="Not linked" options={goals} />
        <TextField label="Next action" name="next_action" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton>Create project</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ProjectStatusButtons({ projectId, status }: { projectId: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const options = ["PLANNED", "ACTIVE", "BLOCKED", "COMPLETE", "CANCELLED"];
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending || s === status}
          onClick={() => startTransition(() => void setProjectStatus(projectId, s))}
          className={cx(
            "border px-2 py-1 text-[0.5625rem] uppercase tracking-[0.1em] transition-colors",
            s === status
              ? "border-ink bg-ink text-inverse"
              : "border-line text-ink-ghost hover:border-line-strong hover:text-ink-dim",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

export function DeleteRowButton({
  action,
  label = "Delete",
  confirm,
}: {
  action: () => Promise<{ ok: boolean; error?: string }>;
  label?: string;
  confirm?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={label}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(() => void action());
      }}
      className="text-ink-ghost transition-colors hover:text-critical"
    >
      ×
    </button>
  );
}

