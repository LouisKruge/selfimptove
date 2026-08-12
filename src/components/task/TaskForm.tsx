"use client";

import { createTask } from "@/lib/actions/plan";
import {
  ActionForm,
  FieldRow,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "../forms";
import { PILLARS } from "@/lib/types";

export interface LinkOption {
  value: string;
  label: string;
}

/**
 * Tasks in COMMAND are outcomes, not activities — the form asks for the result
 * and for what the work is attached to, because unlinked work cannot pay off.
 */
export function TaskForm({
  date,
  projects,
  missions,
  goals,
  defaultPriority = "SUPPORT",
}: {
  date: string;
  projects: LinkOption[];
  missions: LinkOption[];
  goals: LinkOption[];
  defaultPriority?: "MUST_WIN" | "SUPPORT" | "BACKLOG";
}) {
  return (
    <ActionForm action={createTask} resetOnSuccess className="panel p-4 sm:p-5">
      <TextField
        label="Outcome"
        name="title"
        required
        placeholder="Complete the landing-page hero section"
        hint="Name the finished thing, not the activity. “Work on website” is not a task."
      />

      <FieldRow cols={3}>
        <SelectField
          label="Priority"
          name="priority"
          defaultValue={defaultPriority}
          options={[
            { value: "MUST_WIN", label: "Must win" },
            { value: "SUPPORT", label: "Support" },
            { value: "BACKLOG", label: "Backlog" },
          ]}
        />
        <SelectField
          label="Pillar"
          name="pillar"
          defaultValue="BUSINESS"
          options={PILLARS.map((p) => ({ value: p, label: p }))}
        />
        <TextField label="Scheduled" name="scheduled_date" type="date" defaultValue={date} />
      </FieldRow>

      <FieldRow cols={3}>
        <SelectField
          label="Project"
          name="project_id"
          includeBlank
          blankLabel="Not linked"
          options={projects}
        />
        <SelectField
          label="Mission"
          name="mission_id"
          includeBlank
          blankLabel="Not linked"
          options={missions}
        />
        <SelectField
          label="Goal"
          name="goal_id"
          includeBlank
          blankLabel="Not linked"
          options={goals}
        />
      </FieldRow>

      <FieldRow cols={2}>
        <TextField label="Deadline" name="deadline" type="date" />
        <TextField
          label="Estimate (minutes)"
          name="estimated_minutes"
          type="number"
          min="0"
          inputMode="numeric"
        />
      </FieldRow>

      <TextArea
        label="Expected outcome"
        name="expected_outcome"
        rows={2}
        placeholder="What is true when this is done?"
      />

      <div className="flex justify-end pt-1">
        <SubmitButton>Add task</SubmitButton>
      </div>
    </ActionForm>
  );
}
