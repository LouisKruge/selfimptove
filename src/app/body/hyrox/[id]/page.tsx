import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay } from "@/lib/core/date";
import { duration } from "@/lib/core/format";
import { allStationProfiles, hyroxDetail } from "@/lib/services/body";
import { STATION_LABEL } from "@/lib/domain/hyrox";
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
  AddStationForm,
  CompleteHyroxButton,
  StationRow,
} from "@/components/training/BodyForms";

export const dynamic = "force-dynamic";

export default async function HyroxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await hyroxDetail(id);
  if (!detail) notFound();

  const { session, stations, analysis } = detail;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`${formatDay(session.date)} · ${session.division}`}
        title={session.kind.replace(/_/g, " ")}
        description={session.notes ?? undefined}
        actions={
          <Link href="/body/hyrox" className="btn btn-ghost">
            HYROX
          </Link>
        }
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={4}>
            <Kpi label="Total" value={duration(analysis.totalSec)} />
            <Kpi label="Running" value={duration(analysis.runSec)} />
            <Kpi label="Stations" value={duration(analysis.stationSec)} />
            <Kpi label="Transitions" value={duration(analysis.transitionSec)} />
          </KpiGrid>

          <div className="hairline mt-6 grid gap-6 pt-6 sm:grid-cols-3">
            <div>
              <div className="label mb-2">Fastest station</div>
              <div className="text-sm text-ink">
                {analysis.fastest ? STATION_LABEL[analysis.fastest.station] : "—"}
              </div>
              <div className="numeral mt-1 text-xs text-ink-faint">
                {duration(analysis.fastest?.sec ?? null)}
              </div>
            </div>
            <div>
              <div className="label mb-2">Slowest station</div>
              <div className="text-sm text-ink">
                {analysis.slowest ? STATION_LABEL[analysis.slowest.station] : "—"}
              </div>
              <div className="numeral mt-1 text-xs text-ink-faint">
                {duration(analysis.slowest?.sec ?? null)}
              </div>
            </div>
            <div>
              <div className="label mb-2">Largest opportunity</div>
              {analysis.opportunity ? (
                <>
                  <div className="text-sm text-ink">
                    {STATION_LABEL[analysis.opportunity.station]}
                  </div>
                  <div className="numeral mt-1 text-xs text-ink-faint">
                    {analysis.opportunity.gapSec}s above your best
                  </div>
                </>
              ) : (
                <p className="text-xs text-ink-faint">
                  No station is above your recorded best.
                </p>
              )}
            </div>
          </div>

          {analysis.runSplitConsistency !== null ? (
            <p className="mt-6 text-xs text-ink-faint">
              Run split consistency {analysis.runSplitConsistency}% across {stations.filter((s) => s.station === "RUN").length} kilometres.
            </p>
          ) : null}
        </PanelBody>
      </Panel>

      <Section title="Stations" meta={`${stations.length} recorded`}>
        {stations.length === 0 ? (
          <EmptyState compact title="No stations" description="Add stations below to record this session." />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Station</th>
                    <th>Time · distance · load · reps · transition</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {stations.map((s) => (
                    <StationRow key={s.id} station={s} />
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </Section>

      <Section title="Finish">
        <Panel>
          <PanelBody className="space-y-6">
            <CompleteHyroxButton hyroxSessionId={session.id} />
            <div className="hairline pt-5">
              <Disclosure label="Add a station">
                <AddStationForm hyroxSessionId={session.id} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>
    </div>
  );
}
