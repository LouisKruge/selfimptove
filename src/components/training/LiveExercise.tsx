"use client";

import { useState, useTransition } from "react";
import type { LiveExercise as LiveExerciseData } from "@/lib/services/body";
import { formatSet } from "@/lib/domain/strength";
import { formatTarget } from "@/lib/domain/progression";
import { deleteSet, logSet, logTargetSet, repeatLastSet } from "@/lib/actions/training";
import { RestTimer } from "./RestTimer";
import { Badge, cx } from "../primitives";

/**
 * LIVE WORKOUT MODE
 *
 * The whole screen answers one question: what am I lifting on this set?
 * Target above, last session beside it, four inputs, one button. Everything
 * else is out of the way until the set is logged.
 */
export function LiveExercisePanel({
  data,
  index,
  active,
  onActivate,
}: {
  data: LiveExerciseData;
  index: number;
  active: boolean;
  onActivate: () => void;
}) {
  const { sessionExercise: sx, exercise, sets, last, progression, restSec } = data;
  const working = sets.filter((s) => !s.is_warmup);
  const done = working.length;
  const total = sx.target_sets;
  const complete = done >= total;

  const [error, setError] = useState<string | null>(null);
  const [lastLoggedId, setLastLoggedId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isLoaded = exercise.modality === "WEIGHT_REPS" || exercise.modality === "WEIGHTED_BODYWEIGHT";
  const isTimed = exercise.modality === "TIME" || exercise.modality === "REPS_TIME";
  const isDistance =
    exercise.modality === "DISTANCE_TIME" || exercise.modality === "WEIGHT_DISTANCE_TIME";

  const perSet = progression.perSetReps;
  const nextSetTarget = perSet && perSet[done] !== undefined ? perSet[done] : null;

  const targetLine = formatTarget({
    weightKg: sx.target_weight_kg,
    repMin: sx.rep_min,
    repMax: sx.rep_max,
    targetSeconds: sx.target_seconds,
    targetDistanceM: sx.target_distance_m,
  });

  async function submit(formData: FormData) {
    setError(null);
    formData.set("session_exercise_id", sx.id);
    const result = await logSet(formData);
    if (!result.ok) setError(result.error);
    else setLastLoggedId(result.data.id);
  }

  return (
    <section
      className={cx(
        "panel transition-colors",
        active ? "border-line-strong" : "",
        complete && !active ? "opacity-60" : "",
      )}
    >
      {/* ------------------------------------------------------------ head */}
      <button
        type="button"
        onClick={onActivate}
        className="flex w-full items-start justify-between gap-4 border-b border-line px-4 py-3.5 text-left sm:px-5"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="numeral text-[0.6875rem] text-ink-ghost">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="truncate text-base font-medium text-ink">{exercise.name}</h3>
            {complete ? <Badge tone="positive">Done</Badge> : null}
          </div>
          <div className="label mt-2">
            Set {complete ? done : done + 1} / {total}
            {exercise.muscle_group ? ` · ${exercise.muscle_group}` : ""}
          </div>
        </div>
        <span className="numeral flex-none text-sm text-ink-dim">{targetLine}</span>
      </button>

      {/* ------------------------------------------------------- target row */}
      <div className="grid gap-px bg-line sm:grid-cols-2">
        <div className="bg-panel px-4 py-3.5 sm:px-5">
          <div className="label mb-2">Today&rsquo;s target</div>
          <div className="numeral text-2xl font-medium leading-none text-ink">
            {nextSetTarget !== null && sx.target_weight_kg !== null && sx.target_weight_kg > 0
              ? `${sx.target_weight_kg}kg × ${nextSetTarget}`
              : nextSetTarget !== null && !isLoaded
                ? `${nextSetTarget} reps`
                : targetLine}
          </div>
          <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-ink-faint">
            {progression.rationale}
          </p>
          {sx.target_source === "MANUAL" ? (
            <div className="mt-2">
              <Badge tone="muted">Manually set</Badge>
            </div>
          ) : null}
        </div>

        <div className="bg-panel px-4 py-3.5 sm:px-5">
          <div className="label mb-2">Last session</div>
          {last ? (
            <>
              <div className="numeral space-y-1 text-sm text-ink-dim">
                {last.sets
                  .filter((s) => !s.is_warmup)
                  .map((s) => (
                    <div key={s.id}>{formatSet(s)}</div>
                  ))}
              </div>
              <p className="mt-2.5 text-[0.6875rem] text-ink-faint">{last.date}</p>
            </>
          ) : (
            <p className="text-sm text-ink-ghost">
              No previous performance. Today establishes the baseline.
            </p>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------- logged sets */}
      {sets.length > 0 ? (
        <div className="border-t border-line px-4 py-3 sm:px-5">
          <div className="label mb-2.5">Logged</div>
          <ul className="flex flex-wrap gap-2">
            {sets.map((s) => (
              <li
                key={s.id}
                className="group flex items-center gap-2 border border-line px-2.5 py-1.5"
              >
                <span className="numeral text-xs text-ink">{formatSet(s)}</span>
                {s.rpe !== null ? (
                  <span className="numeral text-[0.625rem] text-ink-faint">@{s.rpe}</span>
                ) : null}
                {s.is_warmup ? <span className="label">warm</span> : null}
                <button
                  type="button"
                  aria-label="Delete set"
                  disabled={pending}
                  onClick={() => startTransition(() => void deleteSet(s.id))}
                  className="text-ink-ghost transition-colors hover:text-critical"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* -------------------------------------------------------------- entry */}
      {active ? (
        <div className="space-y-4 border-t border-line px-4 py-4 sm:px-5">
          <form action={submit} className="space-y-4">
            <div
              className={cx(
                "grid gap-3",
                isLoaded ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3",
              )}
            >
              {isLoaded ? (
                <NumberField
                  label="Weight (kg)"
                  name="weight_kg"
                  defaultValue={sx.target_weight_kg ?? undefined}
                  step="0.5"
                />
              ) : null}
              {isDistance ? (
                <NumberField
                  label="Distance (m)"
                  name="distance_m"
                  defaultValue={sx.target_distance_m ?? undefined}
                  step="1"
                />
              ) : null}
              {isTimed || isDistance ? (
                <NumberField
                  label="Time (sec)"
                  name="seconds"
                  defaultValue={sx.target_seconds ?? undefined}
                  step="1"
                />
              ) : null}
              {!isTimed || exercise.modality === "REPS_TIME" ? (
                <NumberField
                  label="Reps"
                  name="reps"
                  defaultValue={nextSetTarget ?? sx.rep_max ?? undefined}
                  step="1"
                />
              ) : null}
              <NumberField label="RPE" name="rpe" step="0.5" min="1" max="10" />
              <NumberField label="RIR" name="rir" step="1" min="0" max="10" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" className="btn btn-primary btn-lg flex-1 sm:flex-none">
                Complete set
              </button>
              <label className="flex cursor-pointer items-center gap-2 px-1">
                <input type="checkbox" name="is_warmup" />
                <span className="label">Warm-up</span>
              </label>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending || !last}
                  className="btn"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await repeatLastSet(sx.id);
                      if (!r.ok) setError(r.error);
                      else setLastLoggedId(r.data.id);
                    })
                  }
                >
                  Repeat
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="btn"
                  onClick={() =>
                    startTransition(async () => {
                      const r = await logTargetSet(sx.id);
                      if (!r.ok) setError(r.error);
                      else setLastLoggedId(r.data.id);
                    })
                  }
                >
                  Log target
                </button>
              </div>
            </div>
          </form>

          {error ? (
            <p role="alert" className="border-l border-critical pl-3 text-xs text-critical">
              {error}
            </p>
          ) : null}

          <RestTimer seconds={restSec} runKey={lastLoggedId} />

          {sx.notes ? <p className="text-xs leading-relaxed text-ink-faint">{sx.notes}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  defaultValue?: number;
  step?: string;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      <input
        name={name}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        defaultValue={defaultValue}
        className="!py-3 !text-lg"
      />
    </label>
  );
}
