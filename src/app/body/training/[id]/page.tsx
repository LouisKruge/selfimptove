import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCommandDate, formatDay } from "@/lib/core/date";
import { duration, kg, num } from "@/lib/core/format";
import { listExercises, sessionDetail } from "@/lib/services/body";
import { sessionLoad } from "@/lib/domain/load";
import {
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
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { LiveSession } from "@/components/training/LiveSession";
import {
  AddSessionExerciseForm,
  CompleteSessionForm,
  DeleteSessionButton,
  RecomputeTargetsButton,
  SessionStatusBadge,
  SessionStatusButton,
  StartSessionButton,
} from "@/components/training/SessionControls";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await sessionDetail(id);
  if (!detail) notFound();

  const { session, exercises } = detail;
  const exerciseOptions = (await listExercises()).map((e) => ({ value: e.id, label: e.name }));
  const load = sessionLoad(session.duration_min, session.session_rpe);
  const isLive = session.status === "IN_PROGRESS";
  const isDone = session.status === "COMPLETED" || session.status === "MODIFIED";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${formatCommandDate(session.date)} · ${session.type}`}
        title={session.name}
        description={
          isLive
            ? "Live. Log each set as you finish it — the rest timer starts automatically."
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SessionStatusBadge status={session.status} />
            <Link href="/body/training" className="btn btn-ghost">
              Training
            </Link>
          </div>
        }
      />

      {/* --------------------------------------------------------- SUMMARY */}
      <Panel>
        <PanelBody>
          <KpiGrid cols={5}>
            <Kpi
              label="Sets logged"
              value={`${detail.completedSets}/${detail.totalSets}`}
              detail="working sets"
            />
            <Kpi label="Volume" value={detail.volumeKg > 0 ? `${num(detail.volumeKg)}kg` : "—"} />
            <Kpi
              label="Duration"
              value={session.duration_min ? `${session.duration_min}m` : "—"}
            />
            <Kpi label="Session RPE" value={session.session_rpe ?? "—"} />
            <Kpi label="Load" value={load ?? "—"} detail="minutes × RPE" />
          </KpiGrid>
          <div className="mt-6">
            <ProgressBar
              value={detail.totalSets > 0 ? (detail.completedSets / detail.totalSets) * 100 : null}
              label="Session progress"
              right={`${detail.completedSets} of ${detail.totalSets}`}
            />
          </div>
        </PanelBody>
      </Panel>

      {/* ---------------------------------------------------------- ACTIONS */}
      <div className="flex flex-wrap items-center gap-2">
        {session.status === "PLANNED" ? <StartSessionButton sessionId={session.id} /> : null}
        {session.status === "PLANNED" ? (
          <SessionStatusButton sessionId={session.id} status="SKIPPED" label="Skip" variant="ghost" />
        ) : null}
        {isDone ? (
          <SessionStatusButton
            sessionId={session.id}
            status="IN_PROGRESS"
            label="Reopen"
            variant="ghost"
          />
        ) : null}
        <RecomputeTargetsButton sessionId={session.id} />
        <DeleteSessionButton sessionId={session.id} />
      </div>

      {/* -------------------------------------------------------- EXERCISES */}
      {exercises.length === 0 ? (
        <EmptyState
          title="No exercises in this session"
          description="Add exercises below, or schedule from the workout library so targets arrive with the session."
        />
      ) : (
        <LiveSession detail={detail} />
      )}

      {/* -------------------------------------------------------------- RUN */}
      {detail.run ? (
        <Section title="Run">
          <Panel>
            <PanelBody>
              <KpiGrid cols={4}>
                <Kpi
                  label="Distance"
                  value={detail.run.run.distance_m ? `${(detail.run.run.distance_m / 1000).toFixed(2)}km` : "—"}
                />
                <Kpi label="Time" value={duration(detail.run.run.duration_sec)} />
                <Kpi
                  label="Pace"
                  value={
                    detail.run.run.avg_pace_sec
                      ? `${Math.floor(detail.run.run.avg_pace_sec / 60)}:${String(detail.run.run.avg_pace_sec % 60).padStart(2, "0")}/km`
                      : "—"
                  }
                />
                <Kpi label="Intervals" value={detail.run.intervals.length || "—"} />
              </KpiGrid>
              <div className="mt-5">
                <Link href={`/body/running/${detail.run.run.id}`} className="btn">
                  Open run
                </Link>
              </div>
            </PanelBody>
          </Panel>
        </Section>
      ) : null}

      {/* ------------------------------------------------------------ HYROX */}
      {detail.hyrox ? (
        <Section title="HYROX">
          <Panel>
            <PanelBody>
              <KpiGrid cols={3}>
                <Kpi label="Total" value={duration(detail.hyrox.session.total_sec)} />
                <Kpi label="Run" value={duration(detail.hyrox.session.run_total_sec)} />
                <Kpi label="Stations" value={duration(detail.hyrox.session.station_total_sec)} />
              </KpiGrid>
              <div className="mt-5">
                <Link href={`/body/hyrox/${detail.hyrox.session.id}`} className="btn">
                  Open session
                </Link>
              </div>
            </PanelBody>
          </Panel>
        </Section>
      ) : null}

      {/* ---------------------------------------------------------- FINISH */}
      {!isDone ? (
        <Section title="Finish">
          <Panel>
            <PanelBody>
              <CompleteSessionForm sessionId={session.id} />
            </PanelBody>
          </Panel>
        </Section>
      ) : session.notes ? (
        <Panel>
          <PanelHeader title="Notes" meta={formatDay(session.date)} />
          <PanelBody>
            <p className="text-sm leading-relaxed text-ink-dim">{session.notes}</p>
          </PanelBody>
        </Panel>
      ) : null}

      <Section title="Adjust">
        <Disclosure label="Add an exercise">
          <Panel>
            <PanelBody>
              <AddSessionExerciseForm sessionId={session.id} exercises={exerciseOptions} />
            </PanelBody>
          </Panel>
        </Disclosure>
      </Section>
    </div>
  );
}
