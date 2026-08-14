"use client";

import { useState } from "react";
import { ActionButton, ActionForm, CheckboxField, SubmitButton, TextArea, TextField } from "@/components/forms";
import {
  blockTask,
  deleteTaskNote,
  logTaskWork,
  recordTaskResult,
  setTaskStatus,
  updateTaskPlan,
} from "@/lib/actions/plan";
import type { Task } from "@/lib/types";

/**
 * The record of what actually happened.
 *
 * Two separate things, deliberately kept apart: the running work log — findings
 * as they arrive — and the single outcome that closes the task. Notes are what
 * you learned on the way; the result is what came of it.
 */

export function LogWorkForm({ taskId }: { taskId: string }) {
  return (
    <ActionForm action={logTaskWork} resetOnSuccess>
      <input type="hidden" name="task_id" value={taskId} />
      <TextField
        label="Heading"
        name="title"
        placeholder="Optional — e.g. “Interview 3: Meridian”"
      />
      <TextArea
        label="What did you do, and what did you find?"
        name="body"
        rows={5}
        required
        placeholder="Findings, decisions, numbers, blockers, who said what."
      />
      <SubmitButton>Add to log</SubmitButton>
    </ActionForm>
  );
}

export function DeleteNoteButton({ noteId, taskId }: { noteId: string; taskId: string }) {
  return (
    <ActionButton
      action={() => deleteTaskNote(noteId, taskId)}
      variant="ghost"
      confirm="Delete this log entry?"
    >
      Delete
    </ActionButton>
  );
}

export function ResultForm({ task }: { task: Task }) {
  const done = task.status === "COMPLETE";
  return (
    <ActionForm action={recordTaskResult}>
      <input type="hidden" name="task_id" value={task.id} />
      <TextArea
        label="What actually happened"
        name="result"
        rows={5}
        defaultValue={task.result}
        placeholder="The outcome in your own words. What was produced, decided or learned."
        hint="This is the counterpart to the expected outcome above."
      />
      <TextField
        label="Actual time (minutes)"
        name="actual_minutes"
        type="number"
        min="0"
        inputMode="numeric"
        defaultValue={task.actual_minutes}
        hint={task.estimated_minutes ? `Estimated ${task.estimated_minutes}m` : undefined}
      />
      {!done ? (
        <CheckboxField
          label="Mark this task complete"
          name="complete"
          hint="A task is finished when its outcome is written down."
        />
      ) : null}
      <SubmitButton>{done ? "Save the record" : "Save"}</SubmitButton>
    </ActionForm>
  );
}

export function BlockForm({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  if (task.status === "BLOCKED") {
    return (
      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-critical">
          Blocked — {task.blocked_reason ?? "no reason recorded"}
        </p>
        <ActionButton action={() => setTaskStatus(task.id, "IN_PROGRESS")}>Unblock</ActionButton>
      </div>
    );
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>
        Mark blocked
      </button>
    );
  }
  return (
    <ActionForm action={blockTask} onSuccess={() => setOpen(false)}>
      <input type="hidden" name="task_id" value={task.id} />
      <TextField label="What is blocking it?" name="blocked_reason" required autoFocus />
      <div className="flex items-center gap-2">
        <SubmitButton>Save</SubmitButton>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </ActionForm>
  );
}

export function StatusButtons({ task }: { task: Task }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {task.status !== "IN_PROGRESS" && task.status !== "COMPLETE" ? (
        <ActionButton action={() => setTaskStatus(task.id, "IN_PROGRESS")}>Start</ActionButton>
      ) : null}
      {task.status === "COMPLETE" ? (
        <ActionButton action={() => setTaskStatus(task.id, "IN_PROGRESS")} variant="ghost">
          Reopen
        </ActionButton>
      ) : null}
      {task.status !== "CANCELLED" ? (
        <ActionButton
          action={() => setTaskStatus(task.id, "CANCELLED")}
          variant="ghost"
          confirm="Cancel this task?"
        >
          Cancel
        </ActionButton>
      ) : null}
    </div>
  );
}

export function PlanForm({ task }: { task: Task }) {
  return (
    <ActionForm action={updateTaskPlan}>
      <input type="hidden" name="task_id" value={task.id} />
      <TextArea
        label="Expected outcome"
        name="expected_outcome"
        rows={3}
        defaultValue={task.expected_outcome}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Scheduled"
          name="scheduled_date"
          type="date"
          defaultValue={task.scheduled_date}
        />
        <TextField label="Deadline" name="deadline" type="date" defaultValue={task.deadline} />
        <TextField
          label="Estimate (minutes)"
          name="estimated_minutes"
          type="number"
          min="0"
          inputMode="numeric"
          defaultValue={task.estimated_minutes}
        />
        <label className="block">
          <span className="label mb-2 block">Priority</span>
          <select name="priority" defaultValue={task.priority}>
            <option value="MUST_WIN">Must win</option>
            <option value="SUPPORT">Support</option>
            <option value="BACKLOG">Backlog</option>
          </select>
        </label>
      </div>
      <SubmitButton>Save the plan</SubmitButton>
    </ActionForm>
  );
}
