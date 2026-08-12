import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, formatDayShort } from "@/lib/core/date";
import { kg, num } from "@/lib/core/format";
import { exerciseHistory } from "@/lib/services/body";
import { formatSet } from "@/lib/domain/strength";
import { metricTrajectory } from "@/lib/domain/trajectory";
import {
  Badge,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Section,
  Sparkline,
  TableWrap,
  TrendGlyph,
} from "@/components/primitives";

export const dynamic = "force-dynamic";

export default async function ExerciseHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const history = exerciseHistory(id);
  if (!history) notFound();

  const { exercise } = history;
  const volumeTrend = metricTrajectory(history.volumeSeries.map((p) => p.volume), 3);
  const strengthTrend = metricTrajectory(history.e1rmSeries.map((p) => p.value), 1);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`${exercise.category}${exercise.muscle_group ? ` · ${exercise.muscle_group}` : ""}`}
        title={exercise.name}
        description={exercise.notes ?? undefined}
        actions={
          <>
            <Badge tone="muted">{exercise.progression_rule.replace(/_/g, " ")}</Badge>
            <Link href="/body/strength" className="btn btn-ghost">
              Strength
            </Link>
          </>
        }
      />

      {history.totalSessions === 0 ? (
        <EmptyState
          title="No history yet"
          description="Nothing has been logged for this exercise. The first session becomes the baseline — COMMAND will not invent a starting target."
        />
      ) : (
        <>
          <Panel>
            <PanelBody>
              <KpiGrid cols={5}>
                <Kpi
                  label="Best load"
                  value={history.bestWeightKg ? `${kg(history.bestWeightKg)}kg` : "—"}
                />
                <Kpi label="Best reps" value={history.bestReps ?? "—"} />
                <Kpi
                  label="Best volume"
                  value={history.bestVolumeKg ? `${num(history.bestVolumeKg)}kg` : "—"}
                  detail="single session"
                />
                <Kpi
                  label="Estimated 1RM"
                  value={history.bestE1RM ? `${kg(history.bestE1RM)}kg` : "—"}
                  detail="Epley, ≤12 reps"
                />
                <Kpi
                  label="Frequency"
                  value={history.frequencyPerWeek ? `${history.frequencyPerWeek}×` : "—"}
                  detail="per week"
                />
              </KpiGrid>

              <div className="hairline mt-6 grid gap-6 pt-6 sm:grid-cols-3">
                <div>
                  <div className="label mb-2.5">Volume trend</div>
                  <div className="flex items-center gap-3">
                    <Sparkline points={history.volumeSeries.map((p) => p.volume)} width={140} />
                    <TrendGlyph trend={volumeTrend.trend} />
                  </div>
                  <p className="mt-2 text-[0.6875rem] text-ink-faint">{volumeTrend.detail}</p>
                </div>
                <div>
                  <div className="label mb-2.5">Estimated 1RM trend</div>
                  <div className="flex items-center gap-3">
                    <Sparkline points={history.e1rmSeries.map((p) => p.value)} width={140} />
                    <TrendGlyph trend={strengthTrend.trend} />
                  </div>
                  <p className="mt-2 text-[0.6875rem] text-ink-faint">{strengthTrend.detail}</p>
                </div>
                <div>
                  <div className="label mb-2.5">Effort</div>
                  <div className="numeral text-2xl text-ink">{history.avgRpe ?? "—"}</div>
                  <p className="mt-2 text-[0.6875rem] text-ink-faint">
                    Average RPE across {history.totalSets} working sets.
                  </p>
                </div>
              </div>
            </PanelBody>
          </Panel>

          {history.records.length > 0 ? (
            <Section title="Personal records" meta={`${history.records.length} recorded`}>
              <Panel>
                <TableWrap>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Kind</th>
                        <th>Record</th>
                        <th className="text-right">Previous</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.records.map((r) => (
                        <tr key={r.id}>
                          <td className="numeral whitespace-nowrap text-ink-faint">
                            {formatDayShort(r.date)}
                          </td>
                          <td>
                            <Badge tone="muted">{r.kind}</Badge>
                          </td>
                          <td className="text-ink">{r.display}</td>
                          <td className="numeral text-right text-ink-faint">
                            {r.previous_value === null ? "—" : num(r.previous_value, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableWrap>
              </Panel>
            </Section>
          ) : null}

          <Section title="Session history" meta={`${history.sessions.length} sessions`}>
            <Panel>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sets</th>
                      <th className="text-right">Top load</th>
                      <th className="text-right">Reps</th>
                      <th className="text-right">Volume</th>
                      <th className="text-right">e1RM</th>
                      <th className="text-right">RPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.sessions.map((s) => (
                      <tr key={s.sessionId}>
                        <td className="numeral whitespace-nowrap text-ink-faint">
                          {formatDay(s.date)}
                        </td>
                        <td className="numeral text-ink-dim">
                          {s.sets.map((set) => formatSet(set)).join("  ·  ")}
                        </td>
                        <td className="numeral text-right text-ink">
                          {s.summary.topWeightKg ? `${kg(s.summary.topWeightKg)}kg` : "—"}
                        </td>
                        <td className="numeral text-right text-ink-dim">{s.summary.totalReps}</td>
                        <td className="numeral text-right text-ink-dim">
                          {num(s.summary.volumeKg)}kg
                        </td>
                        <td className="numeral text-right text-ink-dim">
                          {s.summary.bestE1RM ? `${kg(s.summary.bestE1RM)}kg` : "—"}
                        </td>
                        <td className="numeral text-right text-ink-faint">
                          {s.summary.avgRpe ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          </Section>
        </>
      )}

      <Section title="Progression settings">
        <Panel>
          <PanelBody>
            <KpiGrid cols={3}>
              <Kpi label="Rule" value={exercise.progression_rule.replace(/_/g, " ")} />
              <Kpi label="Increment" value={`${kg(exercise.increment_kg)}kg`} />
              <Kpi label="Default rest" value={`${exercise.default_rest_sec}s`} />
            </KpiGrid>
            <p className="mt-5 text-xs leading-relaxed text-ink-faint">
              Double progression holds the load until every working set reaches the top of the rep
              range, then adds one increment and drops back to the bottom. Targets are
              recommendations — you can overwrite any of them in the session.
            </p>
          </PanelBody>
        </Panel>
      </Section>
    </div>
  );
}
