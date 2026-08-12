"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  abandonDecision,
  addDecisionOption,
  createDecision,
  createHabit,
  decide,
  deleteDecision,
  deleteDecisionOption,
  deleteHabit,
  recordDecisionOutcome,
  updateHabit,
} from "@/lib/actions/self";
import { PILLARS } from "@/lib/types";
import {
  ActionForm,
  CheckboxField,
  FieldRow,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "../forms";
import { Badge, cx } from "../primitives";

/**
 * IMPULSE FIREWALL
 *
 * Creating a decision classifies it and, where warranted, imposes a cooling
 * period the interface will not let you skip.
 */
export function DecisionForm() {
  const router = useRouter();
  const [level, setLevel] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <ActionForm
        action={async (form) => {
          const result = await createDecision(form);
          if (result.ok) {
            setLevel(result.data.level);
            router.push(`/character/decisions/${result.data.id}`);
          }
          return result;
        }}
        className="panel p-4 sm:p-5"
      >
        <TextField label="Decision" name="title" required placeholder="Hire a part-time setter" />
        <TextArea label="Problem" name="problem" rows={2} placeholder="What is actually wrong?" />
        <TextArea label="Objective" name="objective" rows={2} placeholder="What does a good outcome look like?" />

        <FieldRow cols={3}>
          <SelectField
            label="Pillar"
            name="pillar"
            defaultValue="LIFE"
            options={PILLARS.map((p) => ({ value: p, label: p }))}
          />
          <SelectField
            label="Reversibility"
            name="reversibility"
            defaultValue="REVERSIBLE"
            options={[
              { value: "REVERSIBLE", label: "Reversible" },
              { value: "COSTLY", label: "Costly to reverse" },
              { value: "IRREVERSIBLE", label: "Irreversible" },
            ]}
          />
          <TextField label="Amount (R)" name="amount" type="number" step="1" />
        </FieldRow>

        <FieldRow cols={2}>
          <TextField label="Emotional state" name="emotional_state" placeholder="Frustrated, excited, tired…" />
          <SelectField
            label="Emotional intensity"
            name="emotional_intensity"
            includeBlank
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` }))}
            hint="Be honest — this is what the firewall reads."
          />
        </FieldRow>

        <div className="space-y-1">
          <CheckboxField label="Involves borrowing money" name="involves_borrowing" />
          <CheckboxField label="Changes the direction of the business" name="is_business_pivot" />
        </div>

        <div className="flex justify-end">
          <SubmitButton>Classify decision</SubmitButton>
        </div>
      </ActionForm>

      {level ? (
        <p className="text-xs text-ink-faint">
          Classified {level}. {level === "GREEN" ? "No cooling period." : "A cooling period applies."}
        </p>
      ) : null}
    </div>
  );
}

export function DecisionOptionForm({ decisionId }: { decisionId: string }) {
  return (
    <ActionForm action={addDecisionOption} resetOnSuccess>
      <input type="hidden" name="decision_id" value={decisionId} />
      <TextField label="Option" name="label" required placeholder="Hire now at R8,000/month" />
      <FieldRow cols={3}>
        <TextField label="Upside" name="upside" />
        <TextField label="Downside" name="downside" />
        <TextField label="Probability (%)" name="probability" type="number" min="0" max="100" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Add option</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DecisionOptionList({
  options,
}: {
  options: Array<{
    id: string;
    label: string;
    upside: string | null;
    downside: string | null;
    probability: number | null;
    chosen: number;
  }>;
}) {
  const [pending, startTransition] = useTransition();
  if (options.length === 0) {
    return <p className="text-xs text-ink-faint">No options recorded.</p>;
  }
  return (
    <ul className="space-y-px">
      {options.map((o) => (
        <li key={o.id} className="border-b border-line-soft py-3 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cx("text-sm", o.chosen ? "text-ink" : "text-ink-dim")}>{o.label}</span>
                {o.chosen ? <Badge tone="positive">Chosen</Badge> : null}
              </div>
              <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
                {o.upside ? (
                  <p className="text-ink-faint">
                    <span className="label mr-2">Up</span>
                    {o.upside}
                  </p>
                ) : null}
                {o.downside ? (
                  <p className="text-ink-faint">
                    <span className="label mr-2">Down</span>
                    {o.downside}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-none items-center gap-3">
              {o.probability !== null ? (
                <span className="numeral text-xs text-ink-faint">{o.probability}%</span>
              ) : null}
              <button
                type="button"
                disabled={pending}
                aria-label="Delete option"
                onClick={() => startTransition(() => void deleteDecisionOption(o.id))}
                className="text-ink-ghost transition-colors hover:text-critical"
              >
                ×
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DecideForm({
  decisionId,
  options,
  released,
  coolingLabel,
}: {
  decisionId: string;
  options: Array<{ id: string; label: string }>;
  released: boolean;
  coolingLabel: string;
}) {
  if (!released) {
    return (
      <div className="panel-sunken p-4">
        <div className="label mb-2">Cooling period</div>
        <p className="numeral text-2xl font-medium text-ink">{coolingLabel}</p>
        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          This is deliberate. The firewall exists to put distance between the feeling and the
          commitment. Come back when it clears.
        </p>
      </div>
    );
  }

  return (
    <ActionForm action={decide}>
      <input type="hidden" name="id" value={decisionId} />
      <TextField label="Decision" name="decision" required placeholder="What did you decide, and why?" />
      {options.length > 0 ? (
        <SelectField
          label="Chosen option"
          name="option_id"
          includeBlank
          blankLabel="None of the recorded options"
          options={options.map((o) => ({ value: o.id, label: o.label }))}
        />
      ) : null}
      <div className="flex justify-end">
        <SubmitButton>Record decision</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function OutcomeForm({ decisionId }: { decisionId: string }) {
  return (
    <ActionForm action={recordDecisionOutcome}>
      <input type="hidden" name="id" value={decisionId} />
      <TextArea label="Outcome" name="outcome" rows={2} required placeholder="What actually happened?" />
      <FieldRow cols={2}>
        <SelectField
          label="Outcome rating"
          name="outcome_rating"
          includeBlank
          options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n}` }))}
          hint="Rate the outcome, not the feeling at the time."
        />
        <TextField label="Lesson" name="lesson" placeholder="What would you do differently?" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Record outcome</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DecisionActions({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void abandonDecision(decisionId))}
        className="btn btn-ghost"
      >
        Abandon
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Delete this decision and its history?")) return;
          startTransition(async () => {
            await deleteDecision(decisionId);
            router.push("/character/decisions");
          });
        }}
        className="btn btn-ghost"
      >
        Delete
      </button>
    </div>
  );
}

/* ----------------------------------------------------------------- HABITS */

export function HabitForm() {
  return (
    <ActionForm action={createHabit} resetOnSuccess className="panel p-4 sm:p-5">
      <FieldRow cols={3}>
        <TextField label="Habit" name="name" required placeholder="Deep work block" />
        <SelectField
          label="Pillar"
          name="pillar"
          defaultValue="CHARACTER"
          options={PILLARS.map((p) => ({ value: p, label: p }))}
        />
        <TextField
          label="Target per week"
          name="target_per_week"
          type="number"
          min="1"
          max="7"
          defaultValue={5}
        />
      </FieldRow>
      <TextField label="Description" name="description" placeholder="What counts as done?" />
      <div className="flex justify-end">
        <SubmitButton>Add habit</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function HabitRowControls({
  habit,
}: {
  habit: { id: string; name: string; target_per_week: number; active: number };
}) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <form
        action={async (fd) => {
          await updateHabit(fd);
        }}
        className="flex items-center gap-1.5"
      >
        <input type="hidden" name="id" value={habit.id} />
        <input
          name="target_per_week"
          type="number"
          min="1"
          max="7"
          defaultValue={habit.target_per_week}
          className="!w-16 !py-1.5"
          aria-label="Target per week"
        />
        <button type="submit" className="btn btn-ghost">
          Save
        </button>
      </form>
      <button
        type="button"
        disabled={pending}
        aria-label="Retire habit"
        onClick={() => {
          if (!window.confirm(`Retire "${habit.name}"? Its history is kept.`)) return;
          startTransition(() => void deleteHabit(habit.id));
        }}
        className="text-ink-ghost transition-colors hover:text-critical"
      >
        ×
      </button>
    </div>
  );
}
