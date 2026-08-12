"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addSessionExercise,
  completeSession,
  deleteSession,
  recomputeSessionTargets,
  scheduleSession,
  setSessionStatus,
  startSession,
} from "@/lib/actions/training";
import type { DetectedRecord } from "@/lib/services/records";
import { ActionForm, FieldRow, SelectField, SubmitButton, TextField } from "../forms";
import { Badge, cx } from "../primitives";

export function StartSessionButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void startSession(sessionId))}
      className="btn btn-primary btn-lg"
    >
      Start session
    </button>
  );
}

export function SessionStatusButton({
  sessionId,
  status,
  label,
  variant = "default",
}: {
  sessionId: string;
  status: string;
  label: string;
  variant?: "default" | "ghost";
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void setSessionStatus(sessionId, status))}
      className={cx("btn", variant === "ghost" && "btn-ghost")}
    >
      {label}
    </button>
  );
}

export function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this session and every set logged in it?")) return;
        startTransition(async () => {
          await deleteSession(sessionId);
          router.push("/body/training");
        });
      }}
      className="btn btn-ghost"
    >
      Delete
    </button>
  );
}

export function RecomputeTargetsButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      title="Re-derive every target from your logged history"
      onClick={() => startTransition(() => void recomputeSessionTargets(sessionId))}
      className="btn btn-ghost"
    >
      Recompute targets
    </button>
  );
}

/** Finishing a session is where personal records are detected and shown. */
export function CompleteSessionForm({ sessionId }: { sessionId: string }) {
  const [records, setRecords] = useState<DetectedRecord[] | null>(null);

  return (
    <div className="space-y-5">
      <ActionForm
        action={async (form) => {
          form.set("id", sessionId);
          const result = await completeSession(form);
          if (result.ok) setRecords(result.data.records);
          return result;
        }}
      >
        <FieldRow cols={3}>
          <TextField label="Duration (min)" name="duration_min" type="number" min="1" />
          <TextField label="Session RPE" name="session_rpe" type="number" step="0.5" min="1" max="10" />
          <TextField label="Notes" name="notes" placeholder="How did it actually go?" />
        </FieldRow>
        <div className="flex justify-end">
          <SubmitButton size="lg">Complete session</SubmitButton>
        </div>
      </ActionForm>

      {records ? (
        records.length > 0 ? (
          <div className="enter panel-sunken p-4">
            <div className="label mb-3">New personal {records.length === 1 ? "record" : "records"}</div>
            <ul className="space-y-2">
              {records.map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-ink">{r.display}</span>
                  <span className="numeral text-[0.6875rem] text-ink-faint">
                    previous {r.previous ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">Session recorded. No records broken today.</p>
        )
      ) : null}
    </div>
  );
}

export function ScheduleSessionForm({
  workouts,
  date,
}: {
  workouts: Array<{ value: string; label: string }>;
  date: string;
}) {
  const router = useRouter();
  return (
    <ActionForm
      action={async (form) => {
        const result = await scheduleSession(form);
        if (result.ok) router.push(`/body/training/${result.data.id}`);
        return result;
      }}
      className="panel p-4 sm:p-5"
    >
      <FieldRow cols={3}>
        <SelectField
          label="Workout"
          name="workout_id"
          includeBlank
          blankLabel="Blank session"
          options={workouts}
          hint="Targets are computed from your history when the session is created."
        />
        <TextField label="Date" name="date" type="date" defaultValue={date} />
        <TextField label="Name" name="name" placeholder="Only needed for a blank session" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton>Schedule</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function AddSessionExerciseForm({
  sessionId,
  exercises,
}: {
  sessionId: string;
  exercises: Array<{ value: string; label: string }>;
}) {
  return (
    <ActionForm action={addSessionExercise} resetOnSuccess>
      <input type="hidden" name="session_id" value={sessionId} />
      <FieldRow cols={4}>
        <SelectField label="Exercise" name="exercise_id" options={exercises} required />
        <TextField label="Sets" name="target_sets" type="number" min="1" defaultValue={3} />
        <TextField label="Rep min" name="rep_min" type="number" min="1" />
        <TextField label="Rep max" name="rep_max" type="number" min="1" />
      </FieldRow>
      <FieldRow cols={3}>
        <TextField label="Weight (kg)" name="target_weight_kg" type="number" step="0.5" />
        <TextField label="Rest (sec)" name="rest_sec" type="number" min="0" />
        <TextField label="Notes" name="notes" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Add exercise</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SessionStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      tone={
        status === "COMPLETED"
          ? "positive"
          : status === "SKIPPED"
            ? "critical"
            : status === "IN_PROGRESS"
              ? "attention"
              : "muted"
      }
    >
      {status.replace("_", " ")}
    </Badge>
  );
}
