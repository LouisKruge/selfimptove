"use client";

import { createGoal, updateGoal } from "@/lib/actions/plan";
import { PILLARS } from "@/lib/types";
import { ActionForm, FieldRow, SelectField, SubmitButton, TextArea, TextField } from "../forms";

const HORIZONS = [
  { value: "VISION", label: "Life vision" },
  { value: "THREE_YEAR", label: "3 year" },
  { value: "ONE_YEAR", label: "1 year" },
  { value: "QUARTER", label: "90 day" },
  { value: "MONTH", label: "Month" },
  { value: "WEEK", label: "Week" },
];

export function GoalForm({
  parents,
  defaultHorizon = "ONE_YEAR",
}: {
  parents: Array<{ value: string; label: string }>;
  defaultHorizon?: string;
}) {
  return (
    <ActionForm action={createGoal} resetOnSuccess className="panel p-4 sm:p-5">
      <TextField
        label="Goal"
        name="title"
        required
        placeholder="R150,000 monthly business income"
        hint="State the destination, not the activity."
      />
      <TextArea label="Why" name="why" rows={2} placeholder="What does reaching this actually buy you?" />

      <FieldRow cols={3}>
        <SelectField label="Horizon" name="horizon" defaultValue={defaultHorizon} options={HORIZONS} />
        <SelectField
          label="Pillar"
          name="pillar"
          defaultValue="BUSINESS"
          options={PILLARS.map((p) => ({ value: p, label: p }))}
        />
        <SelectField
          label="Parent goal"
          name="parent_id"
          includeBlank
          blankLabel="Top level"
          options={parents}
        />
      </FieldRow>

      <FieldRow cols={4}>
        <TextField label="KPI" name="kpi" placeholder="Monthly income" />
        <TextField label="Unit" name="unit" placeholder="ZAR" />
        <TextField label="Current" name="current_value" type="number" step="any" />
        <TextField label="Target" name="target_value" type="number" step="any" />
      </FieldRow>

      <FieldRow cols={3}>
        <SelectField
          label="Direction"
          name="direction"
          defaultValue="UP"
          options={[
            { value: "UP", label: "Higher is better" },
            { value: "DOWN", label: "Lower is better" },
          ]}
        />
        <TextField label="Deadline" name="deadline" type="date" />
        <TextField label="Next action" name="next_action" placeholder="The immediate next step" />
      </FieldRow>

      <div className="flex justify-end">
        <SubmitButton>Add goal</SubmitButton>
      </div>
    </ActionForm>
  );
}

/** Inline update of the measured value — the only number a goal needs regularly. */
export function GoalValueForm({
  goalId,
  current,
  unit,
}: {
  goalId: string;
  current: number | null;
  unit: string | null;
}) {
  return (
    <ActionForm action={updateGoal}>
      <input type="hidden" name="id" value={goalId} />
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="label mb-1.5 block">Current value{unit ? ` (${unit})` : ""}</span>
          <input name="current_value" type="number" step="any" defaultValue={current ?? ""} />
        </label>
        <SubmitButton variant="default">Update</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function GoalEditForm({
  goal,
  parents,
}: {
  goal: {
    id: string;
    title: string;
    why: string | null;
    horizon: string;
    pillar: string;
    kpi: string | null;
    unit: string | null;
    current_value: number | null;
    target_value: number | null;
    direction: string;
    deadline: string | null;
    next_action: string | null;
    status: string;
  };
  parents: Array<{ value: string; label: string }>;
}) {
  return (
    <ActionForm action={updateGoal} className="panel p-4 sm:p-5">
      <input type="hidden" name="id" value={goal.id} />
      <TextField label="Goal" name="title" defaultValue={goal.title} required />
      <TextArea label="Why" name="why" rows={2} defaultValue={goal.why} />
      <FieldRow cols={3}>
        <SelectField label="Horizon" name="horizon" defaultValue={goal.horizon} options={HORIZONS} />
        <SelectField
          label="Pillar"
          name="pillar"
          defaultValue={goal.pillar}
          options={PILLARS.map((p) => ({ value: p, label: p }))}
        />
        <SelectField
          label="Parent goal"
          name="parent_id"
          includeBlank
          blankLabel="Top level"
          options={parents.filter((p) => p.value !== goal.id)}
        />
      </FieldRow>
      <FieldRow cols={4}>
        <TextField label="KPI" name="kpi" defaultValue={goal.kpi} />
        <TextField label="Unit" name="unit" defaultValue={goal.unit} />
        <TextField label="Current" name="current_value" type="number" step="any" defaultValue={goal.current_value} />
        <TextField label="Target" name="target_value" type="number" step="any" defaultValue={goal.target_value} />
      </FieldRow>
      <FieldRow cols={3}>
        <SelectField
          label="Direction"
          name="direction"
          defaultValue={goal.direction}
          options={[
            { value: "UP", label: "Higher is better" },
            { value: "DOWN", label: "Lower is better" },
          ]}
        />
        <TextField label="Deadline" name="deadline" type="date" defaultValue={goal.deadline} />
        <SelectField
          label="Status"
          name="status"
          defaultValue={goal.status}
          options={["ACTIVE", "ACHIEVED", "MISSED", "PAUSED", "ARCHIVED"].map((v) => ({
            value: v,
            label: v,
          }))}
        />
      </FieldRow>
      <TextField label="Next action" name="next_action" defaultValue={goal.next_action} />
      <div className="flex justify-end">
        <SubmitButton>Save goal</SubmitButton>
      </div>
    </ActionForm>
  );
}
