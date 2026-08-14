import Link from "next/link";
import { addDays, formatDayShort, startOfWeek, today, weekdayShort } from "@/lib/core/date";
import { duration, km, num } from "@/lib/core/format";
import {
  listWorkouts,
  recentSessions,
  trainingLoad,
  trainingWeek,
  weeklyVolumeByGroup,
  activeSession,
} from "@/lib/services/body";
import { scalar } from "@/lib/db";
import {
  AlertCard,
  Badge,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  Section,
  TableWrap,
  cx,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { ScheduleSessionForm, SessionStatusBadge } from "@/components/training/SessionControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Training" };

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string; week?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const anchor =
    params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : startOfWeek(day);

  const week = await trainingWeek(anchor);
  const load = await trainingLoad(day);
  const volume = await weeklyVolumeByGroup(anchor);
  const workouts = await listWorkouts();
  const sessions = await recentSessions(15);
  const live = await activeSession();

  const weekDistance = await scalar(
      "SELECT COALESCE(SUM(distance_m), 0) AS v FROM runs WHERE date BETWEEN ? AND ?",
      [week[0].date, week[week.length - 1].date],
    );
  const completed = week.reduce(
    (t, d) => t + d.sessions.filter((s) => s.status === "COMPLETED").length,
    0,
  );
  const weekLoad = week.reduce((t, d) => t + (d.loadUnits ?? 0), 0);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Body"
        title="Training"
        description="The calendar plans it, the session executes it, the history decides the next target."
        actions={
          <Link href="/body/training/library" className="btn btn-ghost">
            Workout library
          </Link>
        }
      />

      {live ? (
        <AlertCard
          severity="ATTENTION"
          title={`${live.name} is in progress`}
          body="Pick up where you left off — targets and rest timers are ready."
          href={`/body/training/${live.id}`}
        />
      ) : null}

      {/* -------------------------------------------------------- CALENDAR */}
      <Section
        title="Week"
        meta={`${formatDayShort(week[0].date)} → ${formatDayShort(week[week.length - 1].date)}`}
        action={
          <div className="flex items-center gap-2">
            <Link href={`/body/training?week=${addDays(anchor, -7)}`} className="btn btn-ghost">
              ←
            </Link>
            <Link href={`/body/training?week=${startOfWeek(day)}`} className="btn btn-ghost">
              This week
            </Link>
            <Link href={`/body/training?week=${addDays(anchor, 7)}`} className="btn btn-ghost">
              →
            </Link>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4 lg:grid-cols-7">
          {week.map((d) => (
            <div
              key={d.date}
              className={cx(
                "min-h-[9rem] bg-panel p-3",
                d.date === day && "border-t-2 border-t-ink",
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className="label">{weekdayShort(d.date)}</span>
                <span className="numeral text-[0.6875rem] text-ink-ghost">
                  {d.date.slice(8, 10)}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {d.sessions.length === 0 ? (
                  <p className="text-[0.6875rem] text-ink-ghost">
                    {d.isRestDay ? "Recovery" : "—"}
                  </p>
                ) : (
                  d.sessions.map((s) => (
                    <Link key={s.id} href={`/body/training/${s.id}`} className="block">
                      <div className="truncate text-xs text-ink">{s.name}</div>
                      <div className="mt-1 flex items-center gap-1.5">
                        <SessionStatusBadge status={s.status} />
                      </div>
                      {s.duration_min ? (
                        <div className="numeral mt-1 text-[0.625rem] text-ink-ghost">
                          {s.duration_min}m
                          {s.session_rpe ? ` · RPE ${s.session_rpe}` : ""}
                        </div>
                      ) : null}
                    </Link>
                  ))
                )}
              </div>

              {d.loadUnits !== null ? (
                <div className="numeral mt-3 text-[0.625rem] text-ink-ghost">
                  load {d.loadUnits}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ LOAD */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Training load"
            meta="Acute (7 day) against chronic (4 week). Descriptive only — not a medical assessment."
          />
          <PanelBody className="space-y-6">
            <KpiGrid cols={4}>
              <Kpi label="Acute" value={load.acute ?? "—"} detail="last 7 days" />
              <Kpi label="Chronic" value={load.chronic ?? "—"} detail="weekly average" />
              <Kpi
                label="Ratio"
                value={load.ratio ?? "—"}
                tone={
                  load.status === "SHARP_INCREASE" || load.status === "SHARP_DROP"
                    ? "attention"
                    : "default"
                }
              />
              <Kpi
                label="Week on week"
                value={load.weekOverWeekPct === null ? "—" : `${load.weekOverWeekPct > 0 ? "+" : ""}${load.weekOverWeekPct}%`}
              />
            </KpiGrid>
            <p className="text-sm leading-relaxed text-ink-dim">{load.message}</p>

            <div className="hairline pt-5">
              <KpiGrid cols={3}>
                <Kpi label="Sessions this week" value={completed} />
                <Kpi label="Week load" value={weekLoad || "—"} />
                <Kpi label="Run distance" value={weekDistance > 0 ? km(weekDistance) : "—"} />
              </KpiGrid>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Volume by muscle group" meta="Working sets this week" />
          <PanelBody>
            {volume.length === 0 ? (
              <p className="text-xs text-ink-faint">No sets logged this week.</p>
            ) : (
              <div className="space-y-4">
                {volume.map((v) => (
                  <div key={v.group}>
                    <ProgressBar
                      value={Math.min(100, (v.sets / Math.max(...volume.map((x) => x.sets))) * 100)}
                      label={v.group}
                      right={`${v.sets} sets · ${num(v.volumeKg)}kg`}
                    />
                  </div>
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* -------------------------------------------------------- SCHEDULE */}
      <Section title="Schedule a session">
        <Disclosure label="Schedule" defaultOpen={params.quick === "schedule" || params.quick === "start"}>
          <ScheduleSessionForm
            date={day}
            workouts={workouts.map((w) => ({ value: w.id, label: `${w.name} · ${w.type}` }))}
          />
        </Disclosure>
      </Section>

      {/* --------------------------------------------------------- HISTORY */}
      <Section title="Recent sessions" meta={`${sessions.length} most recent`}>
        {sessions.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            description="Schedule a session from the library — targets are computed the moment it is created."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Session</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="text-right">Duration</th>
                    <th className="text-right">RPE</th>
                    <th className="text-right">Load</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="numeral whitespace-nowrap text-ink-faint">
                        {formatDayShort(s.date)}
                      </td>
                      <td>
                        <Link href={`/body/training/${s.id}`} className="text-ink hover:underline">
                          {s.name}
                        </Link>
                      </td>
                      <td className="text-ink-faint">{s.type}</td>
                      <td>
                        <SessionStatusBadge status={s.status} />
                      </td>
                      <td className="numeral text-right text-ink-dim">
                        {s.duration_min ? `${s.duration_min}m` : "—"}
                      </td>
                      <td className="numeral text-right text-ink-dim">{s.session_rpe ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">
                        {s.duration_min && s.session_rpe
                          ? Math.round(s.duration_min * s.session_rpe)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </Section>
    </div>
  );
}
