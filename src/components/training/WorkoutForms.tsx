"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addWorkoutExercise,
  createExercise,
  createWorkout,
  deleteWorkout,
  moveWorkoutExercise,
  quickStartWorkout,
  removeWorkoutExercise,
  updateWorkout,
} from "@/lib/actions/training";
import type { Exercise, WorkoutExercise } from "@/lib/types";
import { formatTarget } from "@/lib/domain/progression";
import { ActionForm, FieldRow, SelectField, SubmitButton, TextArea, TextField } from "../forms";
import { Badge } from "../primitives";

const TYPES = ["STRENGTH", "RUN", "CONDITIONING", "HYROX", "RECOVERY", "MOBILITY"].map((v) => ({
  value: v,
  label: v,
}));

export function WorkoutForm() {
  const router = useRouter();
  return (
    <ActionForm
      action={async (form) => {
        const result = await createWorkout(form);
        if (result.ok) router.push(`/body/training/library/${result.data.id}`);
        return result;
      }}
      className="panel p-4 sm:p-5"
    >
      <FieldRow cols={3}>
        <TextField label="Name" name="name" required placeholder="PUSH A" />
        <SelectField label="Type" name="type" defaultValue="STRENGTH" options={TYPES} />
        <TextField label="Estimated minutes" name="est_minutes" type="number" min="1" />
      </FieldRow>
      <TextField label="Focus" name="focus" placeholder="Chest · Shoulders · Triceps" />
      <TextArea label="Description" name="description" rows={2} />
      <div className="flex justify-end">
        <SubmitButton>Create workout</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function WorkoutEditForm({
  workout,
}: {
  workout: { id: string; name: string; type: string; focus: string | null; description: string | null; est_minutes: number | null };
}) {
  return (
    <ActionForm action={updateWorkout} className="panel p-4 sm:p-5">
      <input type="hidden" name="id" value={workout.id} />
      <FieldRow cols={3}>
        <TextField label="Name" name="name" defaultValue={workout.name} required />
        <SelectField label="Type" name="type" defaultValue={workout.type} options={TYPES} />
        <TextField
          label="Estimated minutes"
          name="est_minutes"
          type="number"
          min="1"
          defaultValue={workout.est_minutes}
        />
      </FieldRow>
      <TextField label="Focus" name="focus" defaultValue={workout.focus} />
      <TextArea label="Description" name="description" rows={2} defaultValue={workout.description} />
      <div className="flex justify-end">
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PrescriptionList({
  rows,
}: {
  rows: Array<WorkoutExercise & { exercise: Exercise }>;
}) {
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return (
      <p className="text-xs text-ink-faint">
        No exercises yet. A workout without prescriptions cannot produce a target.
      </p>
    );
  }

  return (
    <ol className="space-y-px">
      {rows.map((row, i) => (
        <li
          key={row.id}
          className="flex flex-wrap items-center gap-3 border-b border-line-soft py-3 last:border-b-0"
        >
          <span className="numeral w-6 flex-none text-[0.6875rem] text-ink-ghost">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-ink">{row.exercise.name}</div>
            <div className="numeral mt-1 text-[0.6875rem] text-ink-faint">
              {row.target_sets} ×{" "}
              {formatTarget({
                weightKg: row.target_weight_kg,
                repMin: row.rep_min,
                repMax: row.rep_max,
                targetSeconds: row.target_seconds,
                targetDistanceM: row.target_distance_m,
              })}
              {row.rest_sec ? ` · rest ${row.rest_sec}s` : ""}
              {row.target_rir_min !== null && row.target_rir_max !== null
                ? ` · RIR ${row.target_rir_min}–${row.target_rir_max}`
                : ""}
            </div>
          </div>
          <Badge tone="muted">{row.exercise.progression_rule.replace(/_/g, " ")}</Badge>
          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              disabled={pending || i === 0}
              aria-label="Move up"
              onClick={() => startTransition(() => void moveWorkoutExercise(row.id, "up"))}
              className="btn btn-ghost"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={pending || i === rows.length - 1}
              aria-label="Move down"
              onClick={() => startTransition(() => void moveWorkoutExercise(row.id, "down"))}
              className="btn btn-ghost"
            >
              ↓
            </button>
            <button
              type="button"
              disabled={pending}
              aria-label="Remove exercise"
              onClick={() => startTransition(() => void removeWorkoutExercise(row.id))}
              className="btn btn-ghost"
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PrescriptionForm({
  workoutId,
  exercises,
}: {
  workoutId: string;
  exercises: Array<{ value: string; label: string }>;
}) {
  return (
    <ActionForm action={addWorkoutExercise} resetOnSuccess>
      <input type="hidden" name="workout_id" value={workoutId} />
      <FieldRow cols={4}>
        <SelectField label="Exercise" name="exercise_id" options={exercises} required />
        <TextField label="Sets" name="target_sets" type="number" min="1" defaultValue={3} />
        <TextField label="Rep min" name="rep_min" type="number" min="1" />
        <TextField label="Rep max" name="rep_max" type="number" min="1" />
      </FieldRow>
      <FieldRow cols={4}>
        <TextField label="Weight (kg)" name="target_weight_kg" type="number" step="0.5" hint="Leave blank to derive from history" />
        <TextField label="Rest (sec)" name="rest_sec" type="number" min="0" />
        <TextField label="RIR min" name="target_rir_min" type="number" min="0" max="10" />
        <TextField label="RIR max" name="target_rir_max" type="number" min="0" max="10" />
      </FieldRow>
      <FieldRow cols={4}>
        <TextField label="Time (sec)" name="target_seconds" placeholder="60 or 1:00" />
        <TextField label="Distance (m)" name="target_distance_m" type="number" step="1" />
        <TextField label="Pace (per km)" name="target_pace_sec" placeholder="4:30" />
        <TextField label="Tempo" name="tempo" placeholder="3-1-1-0" />
      </FieldRow>
      <TextField label="Notes" name="notes" />
      <div className="flex justify-end">
        <SubmitButton variant="default">Add to workout</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ExerciseForm() {
  return (
    <ActionForm action={createExercise} resetOnSuccess className="panel p-4 sm:p-5">
      <FieldRow cols={3}>
        <TextField label="Name" name="name" required placeholder="Barbell Bench Press" />
        <SelectField
          label="Category"
          name="category"
          defaultValue="STRENGTH"
          options={["STRENGTH", "CONDITIONING", "RUN", "HYROX", "MOBILITY"].map((v) => ({
            value: v,
            label: v,
          }))}
        />
        <TextField label="Muscle group" name="muscle_group" placeholder="CHEST" />
      </FieldRow>
      <FieldRow cols={3}>
        <SelectField
          label="Measured as"
          name="modality"
          defaultValue="WEIGHT_REPS"
          options={[
            { value: "WEIGHT_REPS", label: "Weight × reps" },
            { value: "BODYWEIGHT_REPS", label: "Bodyweight reps" },
            { value: "WEIGHTED_BODYWEIGHT", label: "Weighted bodyweight" },
            { value: "TIME", label: "Time" },
            { value: "DISTANCE_TIME", label: "Distance & time" },
            { value: "WEIGHT_DISTANCE_TIME", label: "Weight, distance & time" },
            { value: "REPS_TIME", label: "Reps & time" },
          ]}
        />
        <SelectField
          label="Progression"
          name="progression_rule"
          defaultValue="DOUBLE_PROGRESSION"
          options={[
            { value: "DOUBLE_PROGRESSION", label: "Double progression" },
            { value: "LINEAR", label: "Linear" },
            { value: "NONE", label: "None" },
          ]}
        />
        <TextField label="Increment (kg)" name="increment_kg" type="number" step="0.5" defaultValue={2.5} />
      </FieldRow>
      <FieldRow cols={2}>
        <TextField label="Default rest (sec)" name="default_rest_sec" type="number" min="0" />
        <label className="flex cursor-pointer items-center gap-2.5 self-end pb-2">
          <input type="checkbox" name="is_compound" />
          <span className="text-xs text-ink">Compound movement</span>
        </label>
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton>Add exercise</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function QuickStartButton({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await quickStartWorkout(workoutId);
          if (result.ok) router.push(`/body/training/${result.data.id}`);
        })
      }
      className="btn btn-primary"
    >
      Start now
    </button>
  );
}

export function DeleteWorkoutButton({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this workout template? Logged sessions are not affected.")) return;
        startTransition(async () => {
          await deleteWorkout(workoutId);
          router.push("/body/training/library");
        });
      }}
      className="btn btn-ghost"
    >
      Delete
    </button>
  );
}
