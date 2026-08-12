"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addHyroxStation,
  addRunInterval,
  buildIntervalSet,
  completeHyroxSession,
  createHyroxSession,
  deleteHyroxStation,
  deleteMeal,
  deleteRun,
  deleteRunInterval,
  logMeal,
  logMealPreset,
  logMeasurement,
  logRecovery,
  logRun,
  logWater,
  setNutritionTarget,
  updateHyroxStation,
  updateRunInterval,
} from "@/lib/actions/body";
import { HYROX_STATIONS } from "@/lib/types";
import { STATION_LABEL } from "@/lib/domain/hyrox";
import type { DetectedRecord } from "@/lib/services/records";
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

/* -------------------------------------------------------------------- RUN */

export function RunForm({ date }: { date: string }) {
  const router = useRouter();
  const [records, setRecords] = useState<DetectedRecord[] | null>(null);

  return (
    <div className="space-y-4">
      <ActionForm
        action={async (form) => {
          const result = await logRun(form);
          if (result.ok) {
            setRecords(result.data.records);
            router.push(`/body/running/${result.data.id}`);
          }
          return result;
        }}
        className="panel p-4 sm:p-5"
      >
        <FieldRow cols={3}>
          <TextField label="Date" name="date" type="date" defaultValue={date} />
          <SelectField
            label="Type"
            name="type"
            defaultValue="EASY"
            options={["EASY", "ZONE2", "TEMPO", "INTERVALS", "LONG", "RACE", "RECOVERY"].map((v) => ({
              value: v,
              label: v,
            }))}
          />
          <TextField label="RPE" name="rpe" type="number" step="0.5" min="1" max="10" />
        </FieldRow>
        <FieldRow cols={3}>
          <TextField label="Distance (km)" name="distance_km" type="number" step="0.01" inputMode="decimal" />
          <TextField label="Time" name="duration" placeholder="42:30 or 1:12:00" />
          <TextField label="Elevation (m)" name="elevation_m" type="number" step="1" />
        </FieldRow>
        <FieldRow cols={4}>
          <TextField label="Avg HR" name="avg_hr" type="number" min="30" max="230" />
          <TextField label="Max HR" name="max_hr" type="number" min="30" max="230" />
          <TextField label="Target distance (km)" name="target_distance_km" type="number" step="0.01" />
          <TextField label="Target pace" name="target_pace" placeholder="4:30" />
        </FieldRow>
        <TextField label="Notes" name="notes" />
        <div className="flex justify-end">
          <SubmitButton>Log run</SubmitButton>
        </div>
      </ActionForm>

      {records && records.length > 0 ? (
        <div className="enter panel-sunken p-4">
          <div className="label mb-2">New records</div>
          <ul className="space-y-1.5">
            {records.map((r, i) => (
              <li key={i} className="text-sm text-ink">
                {r.display}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function IntervalSetForm({ runId }: { runId: string }) {
  return (
    <ActionForm action={buildIntervalSet} resetOnSuccess>
      <input type="hidden" name="run_id" value={runId} />
      <FieldRow cols={4}>
        <TextField label="Reps" name="reps" type="number" min="1" max="40" defaultValue={6} />
        <TextField label="Distance (m)" name="distance_m" type="number" min="1" defaultValue={800} />
        <TextField label="Target pace" name="target_pace" placeholder="4:30" />
        <TextField label="Recovery (sec)" name="recovery_sec" type="number" min="0" defaultValue={90} />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Build interval set</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function IntervalRow({
  interval,
}: {
  interval: {
    id: string;
    interval_index: number;
    distance_m: number | null;
    duration_sec: number | null;
    pace_sec: number | null;
    target_pace_sec: number | null;
    recovery_sec: number | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const onTarget =
    interval.pace_sec !== null &&
    interval.target_pace_sec !== null &&
    interval.pace_sec <= interval.target_pace_sec;

  return (
    <tr>
      <td className="numeral text-ink-faint">{interval.interval_index}</td>
      <td className="numeral text-ink-dim">{interval.distance_m ?? "—"}m</td>
      <td>
        <form
          action={async (fd) => {
            await updateRunInterval(fd);
          }}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="id" value={interval.id} />
          <input
            name="duration"
            placeholder="mm:ss"
            defaultValue={interval.duration_sec ?? ""}
            className="!w-24 !py-1.5"
          />
          <button type="submit" className="btn btn-ghost">
            Save
          </button>
        </form>
      </td>
      <td className={cx("numeral", onTarget ? "text-positive" : "text-ink-dim")}>
        {interval.pace_sec
          ? `${Math.floor(interval.pace_sec / 60)}:${String(interval.pace_sec % 60).padStart(2, "0")}`
          : "—"}
      </td>
      <td className="numeral text-ink-faint">
        {interval.target_pace_sec
          ? `${Math.floor(interval.target_pace_sec / 60)}:${String(interval.target_pace_sec % 60).padStart(2, "0")}`
          : "—"}
      </td>
      <td className="numeral text-ink-faint">{interval.recovery_sec ?? "—"}s</td>
      <td className="text-right">
        <button
          type="button"
          disabled={pending}
          aria-label="Delete interval"
          onClick={() => startTransition(() => void deleteRunInterval(interval.id))}
          className="text-ink-ghost transition-colors hover:text-critical"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

export function SingleIntervalForm({ runId }: { runId: string }) {
  return (
    <ActionForm action={addRunInterval} resetOnSuccess>
      <input type="hidden" name="run_id" value={runId} />
      <FieldRow cols={4}>
        <TextField label="Distance (m)" name="distance_m" type="number" min="1" />
        <TextField label="Time" name="duration" placeholder="3:32" />
        <TextField label="Target pace" name="target_pace" placeholder="4:30" />
        <TextField label="Recovery (sec)" name="recovery_sec" type="number" min="0" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Add interval</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteRunButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this run and its intervals?")) return;
        startTransition(async () => {
          await deleteRun(runId);
          router.push("/body/running");
        });
      }}
      className="btn btn-ghost"
    >
      Delete
    </button>
  );
}

/* ------------------------------------------------------------------ HYROX */

export function HyroxSessionForm({ date }: { date: string }) {
  const router = useRouter();
  return (
    <ActionForm
      action={async (form) => {
        const result = await createHyroxSession(form);
        if (result.ok) router.push(`/body/hyrox/${result.data.id}`);
        return result;
      }}
      className="panel p-4 sm:p-5"
    >
      <FieldRow cols={3}>
        <TextField label="Date" name="date" type="date" defaultValue={date} />
        <SelectField
          label="Kind"
          name="kind"
          defaultValue="STATION_WORK"
          options={[
            { value: "STATION_WORK", label: "Station work" },
            { value: "PARTIAL_SIM", label: "Partial simulation" },
            { value: "FULL_SIM", label: "Full simulation" },
            { value: "RACE", label: "Race" },
          ]}
        />
        <SelectField
          label="Division"
          name="division"
          defaultValue="OPEN"
          options={["OPEN", "PRO", "DOUBLES"].map((v) => ({ value: v, label: v }))}
        />
      </FieldRow>
      <CheckboxField
        label="Scaffold the full race sequence"
        name="scaffold"
        hint="8 × 1km runs alternating with all eight stations, pre-filled with standard distances and loads."
      />
      <TextArea label="Notes" name="notes" rows={2} />
      <div className="flex justify-end">
        <SubmitButton>Create session</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function StationRow({
  station,
}: {
  station: {
    id: string;
    station: string;
    sequence: number;
    duration_sec: number | null;
    distance_m: number | null;
    weight_kg: number | null;
    reps: number | null;
    transition_sec: number | null;
  };
  best?: number | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <tr>
      <td className="numeral text-ink-faint">{station.sequence}</td>
      <td className="whitespace-nowrap text-ink">
        {STATION_LABEL[station.station as keyof typeof STATION_LABEL] ?? station.station}
      </td>
      <td>
        <form
          action={async (fd) => {
            await updateHyroxStation(fd);
          }}
          className="flex flex-wrap items-center gap-1.5"
        >
          <input type="hidden" name="id" value={station.id} />
          <input
            name="duration"
            placeholder="mm:ss"
            defaultValue={station.duration_sec ?? ""}
            className="!w-20 !py-1.5"
            aria-label="Duration"
          />
          <input
            name="distance_m"
            type="number"
            placeholder="m"
            defaultValue={station.distance_m ?? ""}
            className="!w-16 !py-1.5"
            aria-label="Distance"
          />
          <input
            name="weight_kg"
            type="number"
            step="0.5"
            placeholder="kg"
            defaultValue={station.weight_kg ?? ""}
            className="!w-16 !py-1.5"
            aria-label="Weight"
          />
          <input
            name="reps"
            type="number"
            placeholder="reps"
            defaultValue={station.reps ?? ""}
            className="!w-16 !py-1.5"
            aria-label="Reps"
          />
          <input
            name="transition_sec"
            type="number"
            placeholder="trans"
            defaultValue={station.transition_sec ?? ""}
            className="!w-16 !py-1.5"
            aria-label="Transition seconds"
          />
          <button type="submit" className="btn btn-ghost">
            Save
          </button>
        </form>
      </td>
      <td className="text-right">
        <button
          type="button"
          disabled={pending}
          aria-label="Delete station"
          onClick={() => startTransition(() => void deleteHyroxStation(station.id))}
          className="text-ink-ghost transition-colors hover:text-critical"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

export function AddStationForm({ hyroxSessionId }: { hyroxSessionId: string }) {
  return (
    <ActionForm action={addHyroxStation} resetOnSuccess>
      <input type="hidden" name="hyrox_session_id" value={hyroxSessionId} />
      <FieldRow cols={3}>
        <SelectField
          label="Station"
          name="station"
          options={HYROX_STATIONS.map((s) => ({ value: s, label: STATION_LABEL[s] }))}
        />
        <TextField label="Time" name="duration" placeholder="3:45" />
        <TextField label="Transition (sec)" name="transition_sec" type="number" min="0" />
      </FieldRow>
      <FieldRow cols={4}>
        <TextField label="Distance (m)" name="distance_m" type="number" step="1" />
        <TextField label="Weight (kg)" name="weight_kg" type="number" step="0.5" />
        <TextField label="Reps" name="reps" type="number" min="0" />
        <TextField label="RPE" name="rpe" type="number" step="0.5" min="1" max="10" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Add station</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function CompleteHyroxButton({ hyroxSessionId }: { hyroxSessionId: string }) {
  const [pending, startTransition] = useTransition();
  const [records, setRecords] = useState<DetectedRecord[] | null>(null);
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await completeHyroxSession(hyroxSessionId);
            if (r.ok) setRecords(r.data.records);
          })
        }
        className="btn btn-primary"
      >
        Recalculate & check records
      </button>
      {records ? (
        records.length > 0 ? (
          <div className="enter panel-sunken p-4">
            <div className="label mb-2">New station records</div>
            <ul className="space-y-1.5">
              {records.map((r, i) => (
                <li key={i} className="text-sm text-ink">
                  {r.display}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">Totals recalculated. No station records broken.</p>
        )
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- NUTRITION */

export function MealForm({ date }: { date: string }) {
  return (
    <ActionForm action={logMeal} resetOnSuccess className="panel p-4 sm:p-5">
      <FieldRow cols={3}>
        <TextField label="Meal" name="name" required placeholder="Chicken, rice & veg" />
        <SelectField
          label="Slot"
          name="slot"
          defaultValue="MEAL"
          options={["BREAKFAST", "LUNCH", "DINNER", "SNACK", "MEAL", "SHAKE"].map((v) => ({
            value: v,
            label: v,
          }))}
        />
        <TextField label="Date" name="date" type="date" defaultValue={date} />
      </FieldRow>
      <FieldRow cols={4}>
        <TextField label="Calories" name="calories" type="number" min="0" inputMode="numeric" />
        <TextField label="Protein (g)" name="protein_g" type="number" step="0.1" min="0" />
        <TextField label="Carbs (g)" name="carbs_g" type="number" step="0.1" min="0" />
        <TextField label="Fat (g)" name="fat_g" type="number" step="0.1" min="0" />
      </FieldRow>
      <FieldRow cols={2}>
        <TextField label="Fibre (g)" name="fiber_g" type="number" step="0.1" min="0" />
        <CheckboxField label="Save as a preset" name="save_preset" hint="Two taps next time." />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton>Log meal</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PresetButtons({
  presets,
  date,
}: {
  presets: Array<{ id: string; name: string; calories: number; protein_g: number }>;
  date: string;
}) {
  const [pending, startTransition] = useTransition();
  if (presets.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void logMealPreset(p.id, date))}
          className="border border-line px-3 py-2 text-left transition-colors hover:border-line-strong disabled:opacity-50"
        >
          <span className="block text-xs text-ink">{p.name}</span>
          <span className="numeral mt-1 block text-[0.625rem] text-ink-faint">
            {p.calories} kcal · {p.protein_g}g P
          </span>
        </button>
      ))}
    </div>
  );
}

export function DeleteMealButton({ mealId }: { mealId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Delete meal"
      onClick={() => startTransition(() => void deleteMeal(mealId))}
      className="text-ink-ghost transition-colors hover:text-critical"
    >
      ×
    </button>
  );
}

export function WaterForm({ date }: { date: string }) {
  return (
    <ActionForm action={logWater} resetOnSuccess>
      <input type="hidden" name="date" value={date} />
      <div className="flex items-end gap-2">
        <TextField label="Add water (ml)" name="water_ml" type="number" min="0" defaultValue={500} className="flex-1" />
        <SubmitButton variant="default">Add</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function NutritionTargetForm({
  date,
  target,
}: {
  date: string;
  target: {
    goal: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number | null;
    water_ml: number | null;
    weight_trend_kg_per_week: number | null;
  } | null;
}) {
  return (
    <ActionForm action={setNutritionTarget} className="panel p-4 sm:p-5">
      <FieldRow cols={3}>
        <TextField label="Effective from" name="effective_from" type="date" defaultValue={date} />
        <SelectField
          label="Goal"
          name="goal"
          defaultValue={target?.goal ?? "HYBRID"}
          options={[
            { value: "MUSCLE_GAIN", label: "Muscle gain" },
            { value: "MAINTENANCE", label: "Maintenance" },
            { value: "FAT_LOSS", label: "Fat loss" },
            { value: "HYBRID", label: "Hybrid performance" },
          ]}
        />
        <TextField
          label="Intended trend (kg/week)"
          name="weight_trend_kg_per_week"
          type="number"
          step="0.05"
          defaultValue={target?.weight_trend_kg_per_week}
          hint="e.g. 0.2 for a lean gain, −0.5 for fat loss"
        />
      </FieldRow>
      <FieldRow cols={4}>
        <TextField label="Calories" name="calories" type="number" min="1" defaultValue={target?.calories} required />
        <TextField label="Protein (g)" name="protein_g" type="number" min="1" defaultValue={target?.protein_g} required />
        <TextField label="Carbs (g)" name="carbs_g" type="number" min="0" defaultValue={target?.carbs_g} />
        <TextField label="Fat (g)" name="fat_g" type="number" min="0" defaultValue={target?.fat_g} />
      </FieldRow>
      <FieldRow cols={2}>
        <TextField label="Fibre (g)" name="fiber_g" type="number" min="0" defaultValue={target?.fiber_g} />
        <TextField label="Water (ml)" name="water_ml" type="number" min="0" defaultValue={target?.water_ml} />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton>Save targets</SubmitButton>
      </div>
    </ActionForm>
  );
}

/* ----------------------------------------------------------- MEASUREMENTS */

type MeasurementFields = Partial<
  Record<
    | "weight_kg"
    | "body_fat_pct"
    | "waist_cm"
    | "chest_cm"
    | "shoulder_cm"
    | "arm_cm"
    | "thigh_cm"
    | "hip_cm"
    | "neck_cm",
    number | null
  >
>;

export function MeasurementForm({
  date,
  latest,
}: {
  date: string;
  latest: MeasurementFields | null;
}) {
  return (
    <ActionForm action={logMeasurement} className="panel p-4 sm:p-5">
      <FieldRow cols={3}>
        <TextField label="Date" name="date" type="date" defaultValue={date} />
        <TextField
          label="Weight (kg)"
          name="weight_kg"
          type="number"
          step="0.1"
          inputMode="decimal"
          defaultValue={latest?.weight_kg}
        />
        <TextField
          label="Body fat (%)"
          name="body_fat_pct"
          type="number"
          step="0.1"
          defaultValue={latest?.body_fat_pct}
        />
      </FieldRow>
      <FieldRow cols={4}>
        <TextField label="Waist (cm)" name="waist_cm" type="number" step="0.1" defaultValue={latest?.waist_cm} />
        <TextField label="Chest (cm)" name="chest_cm" type="number" step="0.1" defaultValue={latest?.chest_cm} />
        <TextField label="Shoulders (cm)" name="shoulder_cm" type="number" step="0.1" defaultValue={latest?.shoulder_cm} />
        <TextField label="Arms (cm)" name="arm_cm" type="number" step="0.1" defaultValue={latest?.arm_cm} />
      </FieldRow>
      <FieldRow cols={3}>
        <TextField label="Thighs (cm)" name="thigh_cm" type="number" step="0.1" defaultValue={latest?.thigh_cm} />
        <TextField label="Hips (cm)" name="hip_cm" type="number" step="0.1" defaultValue={latest?.hip_cm} />
        <TextField label="Neck (cm)" name="neck_cm" type="number" step="0.1" defaultValue={latest?.neck_cm} />
      </FieldRow>
      <TextField label="Progress photo note" name="photo_note" placeholder="Where the photo is stored, and how you looked" />
      <div className="flex justify-end">
        <SubmitButton>Save measurement</SubmitButton>
      </div>
    </ActionForm>
  );
}

/* --------------------------------------------------------------- RECOVERY */

export function RecoveryForm({
  date,
  existing,
}: {
  date: string;
  existing: {
    sleep_hours: number | null;
    sleep_quality: number | null;
    energy: number | null;
    stress: number | null;
    soreness: number | null;
    motivation: number | null;
    resting_hr: number | null;
    is_rest_day: number;
    notes: string | null;
  } | null;
}) {
  const scale = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));
  return (
    <ActionForm action={logRecovery} className="panel p-4 sm:p-5">
      <FieldRow cols={3}>
        <TextField label="Date" name="date" type="date" defaultValue={date} />
        <TextField
          label="Sleep (hours)"
          name="sleep_hours"
          type="number"
          step="0.1"
          min="0"
          max="24"
          defaultValue={existing?.sleep_hours}
        />
        <TextField
          label="Resting HR"
          name="resting_hr"
          type="number"
          min="25"
          max="150"
          defaultValue={existing?.resting_hr}
        />
      </FieldRow>
      <FieldRow cols={4}>
        <SelectField label="Sleep quality" name="sleep_quality" includeBlank options={scale} defaultValue={existing?.sleep_quality?.toString()} />
        <SelectField label="Energy" name="energy" includeBlank options={scale} defaultValue={existing?.energy?.toString()} />
        <SelectField label="Stress" name="stress" includeBlank options={scale} defaultValue={existing?.stress?.toString()} />
        <SelectField label="Soreness" name="soreness" includeBlank options={scale} defaultValue={existing?.soreness?.toString()} />
      </FieldRow>
      <FieldRow cols={2}>
        <SelectField label="Motivation" name="motivation" includeBlank options={scale} defaultValue={existing?.motivation?.toString()} />
        <CheckboxField
          label="Planned rest day"
          name="is_rest_day"
          defaultChecked={existing?.is_rest_day === 1}
          hint="A respected rest day counts as executed training."
        />
      </FieldRow>
      <TextArea label="Notes" name="notes" rows={2} defaultValue={existing?.notes} />
      <div className="flex justify-end">
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}
