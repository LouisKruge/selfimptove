import Link from "next/link";
import { formatDayShort, today } from "@/lib/core/date";
import { duration } from "@/lib/core/format";
import { hyroxOverview } from "@/lib/services/body";
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
  ProgressBar,
  Section,
  TableWrap,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { HyroxSessionForm } from "@/components/training/BodyForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "HYROX" };

export default async function HyroxPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const o = hyroxOverview();

  const measured = o.profiles.filter((p) => p.samples > 0);
  const worstGap = [...measured]
    .filter((p) => p.gapToBest !== null && p.gapToBest > 0)
    .sort((a, b) => (b.gapToBest ?? 0) - (a.gapToBest ?? 0))[0];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Body"
        title="HYROX"
        description="Eight kilometres of running alternating with eight stations. Every comparison here is to your own recorded times."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Projected race time" meta={o.projection.note} />
          <PanelBody>
            {o.projection.predictedSec === null ? (
              <EmptyState
                compact
                title="Not enough components recorded"
                description={`Missing: ${o.projection.missing.map((m) => STATION_LABEL[m]).join(", ")}. A projection built on guessed splits is worse than none.`}
              />
            ) : (
              <KpiGrid cols={3}>
                <Kpi label="Projected" value={duration(o.projection.predictedSec)} detail="from personal bests" />
                <Kpi label="Running" value={duration(o.projection.runSec)} detail="8 × best 1km" />
                <Kpi label="Stations" value={duration(o.projection.stationSec)} detail="8 best station times" />
              </KpiGrid>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Best simulation" />
          <PanelBody>
            {o.bestSimulation ? (
              <>
                <div className="numeral text-3xl font-medium text-ink">
                  {duration(o.bestSimulation.total_sec)}
                </div>
                <p className="mt-2 text-xs text-ink-faint">
                  {formatDayShort(o.bestSimulation.date)} · {o.bestSimulation.kind.replace("_", " ")}
                </p>
                <Link href={`/body/hyrox/${o.bestSimulation.id}`} className="btn mt-4">
                  Open
                </Link>
              </>
            ) : (
              <p className="text-xs text-ink-faint">
                No full simulation recorded. Run one to convert station times into a race time.
              </p>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Section
        title="Station profile"
        meta={
          worstGap
            ? `Largest opportunity: ${STATION_LABEL[worstGap.station]} is ${worstGap.gapToBest}s off your best.`
            : "Best, latest and average time at every station."
        }
      >
        <Panel>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Station</th>
                  <th className="text-right">Best</th>
                  <th className="text-right">Latest</th>
                  <th className="text-right">Average</th>
                  <th className="text-right">Gap to best</th>
                  <th className="text-right">Attempts</th>
                </tr>
              </thead>
              <tbody>
                {o.profiles.map((p) => (
                  <tr key={p.station}>
                    <td className="text-ink">{STATION_LABEL[p.station]}</td>
                    <td className="numeral text-right text-ink">{duration(p.best)}</td>
                    <td className="numeral text-right text-ink-dim">{duration(p.latest)}</td>
                    <td className="numeral text-right text-ink-faint">{duration(p.average)}</td>
                    <td className="numeral text-right text-ink-faint">
                      {p.gapToBest === null ? "—" : p.gapToBest > 0 ? `+${p.gapToBest}s` : "best"}
                    </td>
                    <td className="numeral text-right text-ink-faint">{p.samples || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      </Section>

      <Section title="New session">
        <Disclosure label="Create a HYROX session" defaultOpen={params.quick === "session"}>
          <HyroxSessionForm date={day} />
        </Disclosure>
      </Section>

      <Section title="Sessions" meta={`${o.sessions.length} recorded`}>
        {o.sessions.length === 0 ? (
          <EmptyState
            title="Nothing logged"
            description="Log station work or scaffold a full race simulation to start building the profile."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Kind</th>
                    <th>Division</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Run</th>
                    <th className="text-right">Stations</th>
                    <th className="text-right">Transitions</th>
                  </tr>
                </thead>
                <tbody>
                  {o.sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="numeral whitespace-nowrap">
                        <Link href={`/body/hyrox/${s.id}`} className="text-ink hover:underline">
                          {formatDayShort(s.date)}
                        </Link>
                      </td>
                      <td>
                        <Badge tone={s.kind === "RACE" ? "default" : "muted"}>
                          {s.kind.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="text-ink-faint">{s.division}</td>
                      <td className="numeral text-right text-ink">{duration(s.total_sec)}</td>
                      <td className="numeral text-right text-ink-dim">{duration(s.run_total_sec)}</td>
                      <td className="numeral text-right text-ink-dim">{duration(s.station_total_sec)}</td>
                      <td className="numeral text-right text-ink-faint">{duration(s.transition_sec)}</td>
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
