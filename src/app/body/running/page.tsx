import Link from "next/link";
import { formatDayShort, today } from "@/lib/core/date";
import { distance, duration, km, pace } from "@/lib/core/format";
import { runningOverview } from "@/lib/services/body";
import {
  BarSeries,
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
import { RunForm } from "@/components/training/BodyForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Running" };

export default async function RunningPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const o = await runningOverview(day);

  const recentWeeks = o.weeks.slice(-12);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Body"
        title="Running"
        description="Distance, pace, intervals and consistency. Splits are compared to the target you set, not to anyone else."
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={5}>
            <Kpi
              label="30-day distance"
              value={o.totalDistance30 > 0 ? km(o.totalDistance30) : "—"}
            />
            <Kpi label="30-day time" value={duration(o.totalTime30 || null)} />
            <Kpi label="30-day pace" value={pace(o.avgPace30)} detail="average" />
            <Kpi
              label="Best pace"
              value={o.bestPace ? pace(o.bestPace.pace) : "—"}
              detail={o.bestPace ? `${distance(o.bestPace.run.distance_m)} · ${formatDayShort(o.bestPace.run.date)}` : undefined}
            />
            <Kpi
              label="Longest"
              value={o.longest?.distance_m ? km(o.longest.distance_m) : "—"}
              detail={o.longest ? formatDayShort(o.longest.date) : undefined}
            />
          </KpiGrid>
        </PanelBody>
      </Panel>

      <Section title="Weekly mileage" meta="Last 12 weeks">
        <Panel>
          <PanelBody>
            {recentWeeks.length === 0 ? (
              <EmptyState compact title="No runs logged" description="Log a run to start the mileage record." />
            ) : (
              <BarSeries
                height={72}
                points={recentWeeks.map((w) => ({
                  label: `Week of ${formatDayShort(w.weekStart)}`,
                  value: Math.round(w.distanceM / 100) / 10,
                }))}
                format={(v) => `${v}km`}
              />
            )}
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Log a run">
        <Disclosure label="Log run" defaultOpen={params.quick === "run"}>
          <RunForm date={day} />
        </Disclosure>
      </Section>

      <Section title="History" meta={`${o.runs.length} runs`}>
        {o.runs.length === 0 ? (
          <EmptyState
            title="Nothing logged yet"
            description="Every pace and distance record starts from the first run you record."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th className="text-right">Distance</th>
                    <th className="text-right">Time</th>
                    <th className="text-right">Pace</th>
                    <th className="text-right">HR</th>
                    <th className="text-right">RPE</th>
                  </tr>
                </thead>
                <tbody>
                  {o.runs.slice(0, 40).map((r) => (
                    <tr key={r.id}>
                      <td className="numeral whitespace-nowrap">
                        <Link href={`/body/running/${r.id}`} className="text-ink hover:underline">
                          {formatDayShort(r.date)}
                        </Link>
                      </td>
                      <td>
                        <Badge tone="muted">{r.type}</Badge>
                      </td>
                      <td className="numeral text-right text-ink-dim">{distance(r.distance_m)}</td>
                      <td className="numeral text-right text-ink-dim">{duration(r.duration_sec)}</td>
                      <td className="numeral text-right text-ink">{pace(r.avg_pace_sec)}</td>
                      <td className="numeral text-right text-ink-faint">{r.avg_hr ?? "—"}</td>
                      <td className="numeral text-right text-ink-faint">{r.rpe ?? "—"}</td>
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
