import Link from "next/link";
import { listWorkouts, listExercises } from "@/lib/services/body";
import { all } from "@/lib/db";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  Section,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { QuickStartButton, WorkoutForm } from "@/components/training/WorkoutForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workout Library" };

export default async function LibraryPage() {
  const workouts = await listWorkouts();
  const exerciseCount = (await listExercises()).length;

  // One grouped count rather than a query per workout.
  const exerciseCounts = new Map(
    (
      await all<{ workout_id: string; v: number }>(
        "SELECT workout_id, COUNT(*) AS v FROM workout_exercises GROUP BY workout_id",
      )
    ).map((r) => [r.workout_id, r.v]),
  );

  const grouped = new Map<string, typeof workouts>();
  for (const w of workouts) {
    const list = grouped.get(w.type);
    if (list) list.push(w);
    else grouped.set(w.type, [w]);
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Body · Training"
        title="Workout Library"
        description="Reusable workouts with prescriptions. Scheduling one carries its targets into the session, derived from your own history."
        actions={
          <>
            <Link href="/body/strength" className="btn btn-ghost">
              {exerciseCount} exercises
            </Link>
            <Link href="/body/training" className="btn btn-ghost">
              Training
            </Link>
          </>
        }
      />

      {workouts.length === 0 ? (
        <EmptyState
          title="No workouts yet"
          description="Create the handful you actually rotate through — PUSH, PULL, LEGS, ZONE 2, INTERVALS, HYROX."
        />
      ) : (
        [...grouped.entries()].map(([type, list]) => (
          <Section key={type} title={type} meta={`${list.length} ${list.length === 1 ? "workout" : "workouts"}`}>
            <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
              {list.map((w) => {
                const count = exerciseCounts.get(w.id) ?? 0;
                return (
                  <Panel key={w.id} className="transition-colors hover:border-line-strong">
                    <PanelBody className="flex h-full flex-col gap-4">
                      <div className="flex-1">
                        <Link href={`/body/training/library/${w.id}`} className="group block">
                          <h3 className="text-base font-medium text-ink transition-colors group-hover:text-ink-dim">
                            {w.name}
                          </h3>
                        </Link>
                        {w.focus ? (
                          <p className="mt-1.5 text-xs text-ink-faint">{w.focus}</p>
                        ) : null}
                        {w.description ? (
                          <p className="mt-2.5 text-xs leading-relaxed text-ink-faint">
                            {w.description}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="numeral text-[0.6875rem] text-ink-ghost">
                          {count} {count === 1 ? "exercise" : "exercises"}
                          {w.est_minutes ? ` · ${w.est_minutes}m` : ""}
                        </span>
                        <QuickStartButton workoutId={w.id} />
                      </div>
                    </PanelBody>
                  </Panel>
                );
              })}
            </div>
          </Section>
        ))
      )}

      <Section title="New workout">
        <Disclosure label="Create a workout" defaultOpen={workouts.length === 0}>
          <WorkoutForm />
        </Disclosure>
      </Section>
    </div>
  );
}
