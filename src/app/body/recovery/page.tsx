import { formatDayShort, today } from "@/lib/core/date";
import { listRecovery, readinessFor, recoveryFor, trainingLoad } from "@/lib/services/body";
import {
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
import { RecoveryForm } from "@/components/training/BodyForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Recovery" };

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const readiness = await readinessFor(day);
  const load = await trainingLoad(day);
  const logs = await listRecovery(45);
  const existing = await recoveryFor(day);

  const sleepLogs = logs.filter((l) => l.sleep_hours !== null);
  const avgSleep =
    sleepLogs.length > 0
      ? Math.round((sleepLogs.reduce((t, l) => t + (l.sleep_hours ?? 0), 0) / sleepLogs.length) * 10) / 10
      : null;
  const restDays = logs.filter((l) => l.is_rest_day === 1).length;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Body"
        title="Recovery"
        description="A readiness reading built only from what you logged. It summarises your own inputs — it is not a diagnosis and never names a condition."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader title="Readiness" meta="Sleep, energy, stress, soreness and recent session load" />
          <PanelBody className="space-y-6">
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <div className="numeral text-5xl font-medium leading-none text-ink">
                  {readiness.level ?? "—"}
                </div>
                <p className="mt-3 text-xs text-ink-faint">
                  {readiness.index === null ? "Not enough inputs" : `Index ${readiness.index}/100`}
                </p>
              </div>
              <p className="max-w-md flex-1 text-sm leading-relaxed text-ink-dim">
                {readiness.message}
              </p>
            </div>

            {readiness.drivers.length > 0 ? (
              <div className="hairline space-y-4 pt-5">
                {readiness.drivers.map((d) => (
                  <ProgressBar
                    key={d.label}
                    value={d.value}
                    label={d.label}
                    right={d.note}
                  />
                ))}
              </div>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Context" />
          <PanelBody>
            <KpiGrid cols={2}>
              <Kpi label="Avg sleep" value={avgSleep ? `${avgSleep}h` : "—"} detail="last 45 days" />
              <Kpi label="Rest days" value={restDays} detail="logged" />
              <Kpi label="Acute load" value={load.acute ?? "—"} />
              <Kpi label="Chronic load" value={load.chronic ?? "—"} />
            </KpiGrid>
            <p className="mt-5 text-xs leading-relaxed text-ink-faint">{load.message}</p>
          </PanelBody>
        </Panel>
      </div>

      <Section title="Log today">
        <Disclosure label="Log recovery" defaultOpen={params.quick === "recovery" || !existing}>
          <RecoveryForm date={day} existing={existing ?? null} />
        </Disclosure>
      </Section>

      <Section title="History" meta={`${logs.length} days logged`}>
        {logs.length === 0 ? (
          <EmptyState
            title="Nothing logged"
            description="Sleep and how you feel are the cheapest inputs in the system. Log them and readiness starts working."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Sleep</th>
                    <th className="text-right">Quality</th>
                    <th className="text-right">Energy</th>
                    <th className="text-right">Stress</th>
                    <th className="text-right">Soreness</th>
                    <th className="text-right">Resting HR</th>
                    <th>Rest day</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="numeral whitespace-nowrap text-ink-faint">
                        {formatDayShort(l.date)}
                      </td>
                      <td className="numeral text-right text-ink">{l.sleep_hours ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{l.sleep_quality ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{l.energy ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{l.stress ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{l.soreness ?? "—"}</td>
                      <td className="numeral text-right text-ink-faint">{l.resting_hr ?? "—"}</td>
                      <td className="text-ink-faint">{l.is_rest_day ? "Yes" : "—"}</td>
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
