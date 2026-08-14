import { formatDayShort, today } from "@/lib/core/date";
import { compositionComparisons, latestMeasurement, listMeasurements } from "@/lib/services/body";
import { metricTrajectory } from "@/lib/domain/trajectory";
import {
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
  cx,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { MeasurementForm } from "@/components/training/BodyForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Measurements" };

export default async function MeasurementsPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const rows = await listMeasurements(200);
  const latest = await latestMeasurement();
  const comparisons = await compositionComparisons(day);

  const weightSeries = [...rows]
    .reverse()
    .map((r) => r.weight_kg)
    .filter((v): v is number => v !== null);
  const weightTrend = metricTrajectory(weightSeries, 0.5);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Body"
        title="Measurements"
        description="A single reading is noise. What matters is the direction across 7, 30, 90 days and a year."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No measurements yet"
          description="Log weight and a few circumferences. Trends need at least four readings before they mean anything."
        />
      ) : (
        <>
          <Panel>
            <PanelBody>
              <div className="flex flex-wrap items-end gap-10">
                <div>
                  <div className="label mb-2">Weight</div>
                  <div className="flex items-baseline gap-3">
                    <span className="numeral text-4xl font-medium leading-none text-ink">
                      {latest?.weight_kg ?? "—"}
                    </span>
                    <span className="text-xs text-ink-faint">kg</span>
                    <TrendGlyph trend={weightTrend.trend} className="text-xl" />
                  </div>
                  <p className="mt-2 text-[0.6875rem] text-ink-faint">{weightTrend.detail}</p>
                </div>
                <Sparkline points={weightSeries} width={220} height={44} />
                <div className="flex gap-8">
                  <Kpi label="Body fat" value={latest?.body_fat_pct ? `${latest.body_fat_pct}%` : "—"} />
                  <Kpi label="Waist" value={latest?.waist_cm ? `${latest.waist_cm}cm` : "—"} />
                  <Kpi label="Readings" value={rows.length} detail={latest ? `latest ${formatDayShort(latest.date)}` : undefined} />
                </div>
              </div>
            </PanelBody>
          </Panel>

          <Section title="Change over time" meta="Compared against the nearest reading at or before each cutoff.">
            <Panel>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Measure</th>
                      <th className="text-right">Current</th>
                      {comparisons[0]?.windows.map((w) => (
                        <th key={w.label} className="text-right">
                          {w.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons
                      .filter((c) => c.current !== null)
                      .map((c) => (
                        <tr key={c.field}>
                          <td className="text-ink">{c.label}</td>
                          <td className="numeral text-right text-ink">
                            {c.current}
                            <span className="text-ink-faint">{c.unit}</span>
                          </td>
                          {c.windows.map((w) => (
                            <td
                              key={w.label}
                              className={cx(
                                "numeral text-right",
                                w.delta === null
                                  ? "text-ink-ghost"
                                  : w.delta > 0
                                    ? "text-ink-dim"
                                    : w.delta < 0
                                      ? "text-ink-dim"
                                      : "text-ink-faint",
                              )}
                            >
                              {w.delta === null ? "—" : `${w.delta > 0 ? "+" : ""}${w.delta}`}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          </Section>
        </>
      )}

      <Section title="Log a measurement">
        <Disclosure label="Log measurement" defaultOpen={params.quick === "weight" || rows.length === 0}>
          <MeasurementForm date={day} latest={latest ?? null} />
        </Disclosure>
      </Section>

      {rows.length > 0 ? (
        <Section title="History" meta={`${rows.length} readings`}>
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Weight</th>
                    <th className="text-right">Body fat</th>
                    <th className="text-right">Waist</th>
                    <th className="text-right">Chest</th>
                    <th className="text-right">Arms</th>
                    <th className="text-right">Thighs</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 40).map((r) => (
                    <tr key={r.id}>
                      <td className="numeral whitespace-nowrap text-ink-faint">
                        {formatDayShort(r.date)}
                      </td>
                      <td className="numeral text-right text-ink">{r.weight_kg ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{r.body_fat_pct ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{r.waist_cm ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{r.chest_cm ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{r.arm_cm ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{r.thigh_cm ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </Section>
      ) : null}
    </div>
  );
}
