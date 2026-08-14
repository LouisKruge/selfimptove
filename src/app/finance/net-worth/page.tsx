import { formatDayShort, today } from "@/lib/core/date";
import { money, moneyCompact } from "@/lib/core/format";
import { listAssets, listNetWorthSnapshots, netWorthNow } from "@/lib/services/finance";
import { deleteAsset } from "@/lib/actions/money";
import { metricTrajectory } from "@/lib/domain/trajectory";
import {
  BarSeries,
  DataRow,
  EmptyState,
  Kpi,
  LineChart,
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
import { DeleteRowButton } from "@/components/business/BusinessForms";
import { AssetForm, SnapshotButton } from "@/components/finance/FinanceForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Net Worth" };

export default async function NetWorthPage() {
  const day = today();
  const now = await netWorthNow();
  const snapshots = await listNetWorthSnapshots(60);
  const assets = await listAssets();
  const ordered = [...snapshots].reverse();
  const trend = metricTrajectory(ordered.map((s) => s.net_worth_cents), 2);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Finance"
        title="Net Worth"
        description="Assets minus liabilities, tracked over time. A snapshot freezes today's balance sheet into the record."
        actions={<SnapshotButton />}
      />

      <Panel>
        <PanelBody>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="label mb-2">Net worth today</div>
              <div className="flex items-baseline gap-3">
                <span
                  className={cx(
                    "numeral text-5xl font-medium leading-none",
                    now.netWorthCents < 0 ? "text-critical" : "text-ink",
                  )}
                >
                  {moneyCompact(now.netWorthCents)}
                </span>
                <TrendGlyph trend={trend.trend} className="text-2xl" />
              </div>
              <p className="mt-2.5 text-[0.6875rem] text-ink-faint">{trend.detail}</p>
            </div>
            <Sparkline points={ordered.map((s) => s.net_worth_cents)} width={260} height={52} />
          </div>
        </PanelBody>
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Assets" meta={money(now.assetsCents)} />
          <PanelBody>
            <DataRow label="Cash" value={money(now.cashCents)} />
            <DataRow label="Investments" value={money(now.investmentsCents)} />
            <DataRow label="Property" value={money(now.propertyCents)} />
            <DataRow label="Business equity" value={money(now.businessCents)} />
            <DataRow label="Other assets" value={money(now.otherAssetsCents)} />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Liabilities" meta={money(now.liabilitiesCents)} />
          <PanelBody>
            <DataRow label="Total debt" value={money(now.liabilitiesCents)} tone={now.liabilitiesCents > 0 ? "attention" : "default"} />
            <div className="mt-6">
              <KpiGrid cols={2}>
                <Kpi label="Assets" value={moneyCompact(now.assetsCents)} />
                <Kpi
                  label="Net worth"
                  value={moneyCompact(now.netWorthCents)}
                  tone={now.netWorthCents < 0 ? "critical" : "default"}
                />
              </KpiGrid>
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Section title="History" meta={`${snapshots.length} snapshots`}>
        {snapshots.length === 0 ? (
          <EmptyState
            title="No snapshots yet"
            description="Take one now, then roughly monthly. The line only means something once there are a few points on it."
          />
        ) : (
          <>
            <Panel>
              <PanelBody>
                <LineChart
                  height={110}
                  points={ordered.map((s) => ({
                    label: formatDayShort(s.date),
                    value: Math.round(s.net_worth_cents / 100),
                  }))}
                  format={(v) => money(v * 100)}
                />
              </PanelBody>
            </Panel>

            <Panel>
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th className="text-right">Cash</th>
                      <th className="text-right">Investments</th>
                      <th className="text-right">Other</th>
                      <th className="text-right">Liabilities</th>
                      <th className="text-right">Net worth</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => (
                      <tr key={s.id}>
                        <td className="numeral whitespace-nowrap text-ink-faint">{formatDayShort(s.date)}</td>
                        <td className="numeral text-right text-ink-dim">{money(s.cash_cents)}</td>
                        <td className="numeral text-right text-ink-dim">{money(s.investments_cents)}</td>
                        <td className="numeral text-right text-ink-dim">
                          {money(s.property_cents + s.business_cents + s.other_assets_cents)}
                        </td>
                        <td className="numeral text-right text-ink-dim">{money(s.liabilities_cents)}</td>
                        <td className="numeral text-right text-ink">{money(s.net_worth_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          </>
        )}
      </Section>

      <Section title="Other assets" meta={`${assets.length} recorded`}>
        <Panel>
          <PanelBody className="space-y-6">
            {assets.length === 0 ? (
              <p className="text-xs text-ink-faint">No property, vehicles or business equity recorded.</p>
            ) : (
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Kind</th>
                      <th className="text-right">Value</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.id}>
                        <td className="text-ink">{a.name}</td>
                        <td className="text-ink-faint">{a.kind.replace("_", " ")}</td>
                        <td className="numeral text-right text-ink">{money(a.value_cents)}</td>
                        <td className="text-right">
                          <DeleteRowButton action={deleteAsset.bind(null, a.id)} confirm={`Remove ${a.name}?`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
            <div className="hairline pt-5">
              <Disclosure label="Add an asset">
                <AssetForm />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>
    </div>
  );
}
