"use client";

import { createPromise } from "@/lib/actions/self";
import { ActionForm, FieldRow, SelectField, SubmitButton, TextField } from "../forms";
import { PILLARS } from "@/lib/types";

/** A commitment becomes measurable the moment it is written down. */
export function PromiseForm({ date }: { date: string }) {
  return (
    <ActionForm action={createPromise} resetOnSuccess>
      <TextField
        label="Promise"
        name="text"
        required
        placeholder="Train at 18:00"
        hint="Specific enough that you cannot argue about whether you kept it."
      />
      <FieldRow cols={3}>
        <SelectField
          label="Pillar"
          name="pillar"
          defaultValue="CHARACTER"
          options={PILLARS.map((p) => ({ value: p, label: p }))}
        />
        <TextField label="Date" name="date" type="date" defaultValue={date} />
        <TextField label="By" name="due_time" placeholder="18:00" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Commit</SubmitButton>
      </div>
    </ActionForm>
  );
}
