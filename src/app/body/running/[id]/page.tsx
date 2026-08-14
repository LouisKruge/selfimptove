import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay } from "@/lib/core/date";
import { distance, duration, pace } from "@/lib/core/format";
import { runDetail } from "@/lib/services/body";
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
  TableWrap,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import {
  DeleteRunButton,
  IntervalRow,
  IntervalSetForm,
  SingleIntervalForm,
} from "@/components/training/BodyForms";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await runDetail(id);
  if (!detail) notFound();

  const { run, intervals, analysis } = detail;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`${formatDay(run.date)} · ${run.type}`}
        title={`${distance(run.distance_m)} in ${duration(run.duration_sec)}`}
        description={run.notes ?? undefined}
        actions={
          <>
            <DeleteRunButton runId={run.id} />
            <Link href="/body/running" className="btn btn-ghost">
              Running
            </Link>
          </>
        }
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={5}>
            <Kpi label="Distance" value={distance(run.distance_m)} />
            <Kpi label="Time" value={duration(run.duration_sec)} />
            <Kpi
              label="Pace"
              value={pace(run.avg_pace_sec)}
              detail={run.target_pace_sec ? `target ${pace(run.target_pace_sec)}` : undefined}
            />
            <Kpi label="Avg HR" value={run.avg_hr ?? "—"} detail={run.max_hr ? `max ${run.max_hr}` : undefined} />
            <Kpi label="Elevation" value={run.elevation_m ? `${run.elevation_m}m` : "—"} />
          </KpiGrid>
        </PanelBody>
      </Panel>

      <Section title="Intervals" meta={analysis.verdict}>
        {intervals.length === 0 ? (
          <EmptyState
            compact
            title="No intervals"
            description="Build an interval set below — for example 6 × 800m at 4:30/km with 90 seconds recovery."
          />
        ) : (
          <>
            <Panel>
              <PanelBody>
                <KpiGrid cols={5}>
                  <Kpi label="Completed" value={`${analysis.count}/${intervals.length}`} />
                  <Kpi label="Average" value={pace(analysis.averagePaceSec)} />
                  <Kpi
                    label="Best"
                    value={pace(analysis.bestPaceSec)}
                    detail={analysis.bestIndex ? `interval ${analysis.bestIndex}` : undefined}
                  />
                  <Kpi
                    label="Worst"
                    value={pace(analysis.worstPaceSec)}
                    detail={analysis.worstIndex ? `interval ${analysis.worstIndex}` : undefined}
                  />
                  <Kpi
                    label="Consistency"
                    value={analysis.consistency === null ? "—" : `${analysis.consistency}%`}
                    detail="split variance"
                  />
                </KpiGrid>
              </PanelBody>
            </Panel>

            <Panel>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Distance</th>
                      <th>Time</th>
                      <th>Pace</th>
                      <th>Target</th>
                      <th>Recovery</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {intervals.map((i) => (
                      <IntervalRow key={i.id} interval={i} />
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          </>
        )}
      </Section>

      <Section title="Add intervals">
        <Panel>
          <PanelBody className="space-y-6">
            <IntervalSetForm runId={run.id} />
            <div className="hairline pt-5">
              <Disclosure label="Add a single interval">
                <SingleIntervalForm runId={run.id} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>
    </div>
  );
}
