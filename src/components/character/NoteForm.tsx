"use client";

import { createNote } from "@/lib/actions/self";
import { PILLARS } from "@/lib/types";
import { ActionForm, FieldRow, SelectField, SubmitButton, TextArea, TextField } from "../forms";

export function NoteForm() {
  return (
    <ActionForm action={createNote} resetOnSuccess className="panel p-4 sm:p-5">
      <FieldRow cols={2}>
        <TextField label="Title" name="title" placeholder="Optional" />
        <SelectField
          label="Pillar"
          name="pillar"
          includeBlank
          blankLabel="Unassigned"
          options={PILLARS.map((p) => ({ value: p, label: p }))}
        />
      </FieldRow>
      <TextArea label="Note" name="body" rows={5} required placeholder="What happened, what you noticed, what it means." />
      <div className="flex justify-end">
        <SubmitButton>Save note</SubmitButton>
      </div>
    </ActionForm>
  );
}
