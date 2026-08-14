import Link from "next/link";
import { formatDayShort } from "@/lib/core/date";
import { kg, num } from "@/lib/core/format";
import { listExercises, recentRecords } from "@/lib/services/body";
import { all } from "@/lib/db";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Section,
  TableWrap,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { ExerciseForm } from "@/components/training/WorkoutForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Strength" };

interface Row {
  id: string;
  name: string;
  muscle_group: string | null;
  category: string;
  sessions: number;
  last_date: string | null;
  best_weight: number | null;
  best_reps: number | null;
}

export default async function StrengthPage() {
  const exercises = await listExercises();
  const records = await recentRecords(10);

  // One pass over the set history rather than a query per exercise.
  const stats = await all<Row>(
      `SELECT e.id, e.name, e.muscle_group, e.category,
            COUNT(DISTINCT ws.date) AS sessions,
            MAX(ws.date) AS last_date,
            MAX(ws.weight_kg) AS best_weight,
            MAX(ws.reps) AS best_reps
       FROM exercises e
       LEFT JOIN workout_sets ws ON ws.exercise_id = e.id AND ws.is_warmup = 0
      WHERE e.archived = 0
      GROUP BY e.id
      ORDER BY sessions DESC, e.name`,
    );

  const trained = stats.filter((s) => s.sessions > 0);
  const untrained = stats.filter((s) => s.sessions === 0);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Body"
        title="Strength"
        description="Every exercise keeps its own history: best load, best reps, estimated 1RM, volume trend and every record it has produced."
        actions={
          <Link href="/body/training/library" className="btn btn-ghost">
            Workout library
          </Link>
        }
      />

      {records.length > 0 ? (
        <Section title="Recent records">
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {records.map((r) => (
              <Panel key={r.id}>
                <PanelBody className="p-4">
                  <div className="label mb-2">{r.kind}</div>
                  <div className="text-sm text-ink">{r.exerciseName ?? r.station ?? "Record"}</div>
                  <div className="numeral mt-1.5 text-lg text-ink">{r.display}</div>
                  <div className="mt-2 text-[0.6875rem] text-ink-faint">
                    {formatDayShort(r.date)}
                    {r.previous_value !== null ? ` · previous ${num(r.previous_value, 1)}` : ""}
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Trained" meta={`${trained.length} exercises with logged history`}>
        {trained.length === 0 ? (
          <EmptyState
            title="No strength history yet"
            description="Log a session and each exercise starts building its own record."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Exercise</th>
                    <th>Group</th>
                    <th className="text-right">Sessions</th>
                    <th className="text-right">Best load</th>
                    <th className="text-right">Best reps</th>
                    <th className="text-right">Last</th>
                  </tr>
                </thead>
                <tbody>
                  {trained.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link href={`/body/strength/${s.id}`} className="text-ink hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className="text-ink-faint">{s.muscle_group ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{s.sessions}</td>
                      <td className="numeral text-right text-ink-dim">
                        {s.best_weight ? `${kg(s.best_weight)}kg` : "—"}
                      </td>
                      <td className="numeral text-right text-ink-dim">{s.best_reps ?? "—"}</td>
                      <td className="numeral text-right text-ink-faint">
                        {s.last_date ? formatDayShort(s.last_date) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </Section>

      {untrained.length > 0 ? (
        <Section title="In the catalogue" meta={`${untrained.length} not yet trained`}>
          <Panel>
            <PanelBody>
              <div className="flex flex-wrap gap-2">
                {untrained.map((s) => (
                  <Link
                    key={s.id}
                    href={`/body/strength/${s.id}`}
                    className="border border-line px-2.5 py-1.5 text-xs text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </PanelBody>
          </Panel>
        </Section>
      ) : null}

      <Section title="New exercise">
        <Disclosure label="Add an exercise">
          <ExerciseForm />
        </Disclosure>
      </Section>
    </div>
  );
}
