import Link from "next/link";
import { formatDayShort, today } from "@/lib/core/date";
import { money, moneyCompact, pct } from "@/lib/core/format";
import { financeDashboard } from "@/lib/services/finance";
import { scoreSeries, storedScore } from "@/lib/services/scores";
import { trajectory } from "@/lib/domain/trajectory";
import {
  AlertCard,
  BarSeries,
  CompositionBar,
  EmptyState,
  Kpi,
  LineChart,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PairedBars,
  PanelHeader,
  ProgressBar,
  Section,
  Sparkline,
  TrendGlyph,
  cx,
} from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Finance" };

export default async function FinanceDashboardPage() {
  const day = today();
  const f = await financeDashboard(day);
  const score = await storedScore(day);
  const series = await scoreSeries("finance", 28, day);
  const t = trajectory(series.map((s) => s.value));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Finance"
        title="Control"
        description="Cash, debt, assets and the direction all three are moving. Financial pressure is what makes patient decisions impossible."
        actions={<Link href="/finance/cash-flow" className="btn btn-primary">Cash flow</Link>}
      />

      {f.forecast30.shortfall ? (
        <AlertCard
          severity="CRITICAL"
          title="Projected cash shortfall"
          body={`Balance is projected to fall ${money(f.forecast30.shortfall.amountCents)} short on ${f.forecast30.shortfall.date}, based on scheduled money in and out.`}
          href="/finance/cash-flow"
        />
      ) : null}

      <Panel>
        <PanelBody>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="label mb-2">Finance score today</div>
              <div className="flex items-baseline gap-3">
                <span className="numeral text-5xl font-medium leading-none text-ink">
                  {score?.finance === null || !score ? "—" : Math.round(score.finance)}
                </span>
                <TrendGlyph trend={t.trend} className="text-2xl" />
              </div>
              <p className="mt-2.5 text-[0.6875rem] text-ink-faint">{t.detail}</p>
            </div>
            <Sparkline points={series.map((s) => s.value)} width={240} height={48} />
          </div>
        </PanelBody>
      </Panel>

      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        <Panel>
          <PanelBody>
            <div className="label">Net worth</div>
            <div className={cx("numeral mt-3 text-3xl font-medium leading-none", f.now.netWorthCents < 0 ? "text-critical" : "text-ink")}>
              {moneyCompact(f.now.netWorthCents)}
            </div>
            <div className="mt-3 text-[0.6875rem] text-ink-faint">
              {moneyCompact(f.now.assetsCents)} assets · {moneyCompact(f.now.liabilitiesCents)} liabilities
            </div>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <div className="label">Cash</div>
            <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
              {moneyCompact(f.now.cashCents)}
            </div>
            <div className="mt-3 text-[0.6875rem] text-ink-faint">
              30-day low {moneyCompact(f.forecast30.lowestCents)}
            </div>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <div className="label">Debt</div>
            <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
              {f.debt.totalCents > 0 ? moneyCompact(f.debt.totalCents) : "—"}
            </div>
            <div className="mt-3 text-[0.6875rem] text-ink-faint">
              {f.debt.monthsToClearAtMinimum
                ? `${f.debt.monthsToClearAtMinimum} months at minimum payments`
                : "No minimum payments recorded"}
            </div>
          </PanelBody>
        </Panel>
        <Panel>
          <PanelBody>
            <div className="label">Savings rate</div>
            <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
              {f.savingsRate === null ? "—" : pct(f.savingsRate)}
            </div>
            <div className="mt-3 text-[0.6875rem] text-ink-faint">
              {money(f.income30Cents)} in · {money(f.expenses30Cents)} out · 30 days
            </div>
          </PanelBody>
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="30-day forecast"
            meta="From scheduled money in and out only — nothing is extrapolated."
            action={<Link href="/finance/cash-flow" className="btn btn-ghost">Open</Link>}
          />
          <PanelBody className="space-y-5">
            <LineChart
              height={84}
              points={f.forecast30.days.map((d) => ({
                label: formatDayShort(d.date),
                value: Math.round(d.balanceCents / 100),
              }))}
              format={(v) => money(v * 100)}
            />
            <KpiGrid cols={3}>
              <Kpi label="Opening" value={money(f.forecast30.openingCents)} />
              <Kpi
                label="Lowest"
                value={money(f.forecast30.lowestCents)}
                tone={f.forecast30.lowestCents < 0 ? "critical" : "default"}
                detail={f.forecast30.lowestDate ?? undefined}
              />
              <Kpi label="Closing" value={money(f.forecast30.closingCents)} />
            </KpiGrid>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Financial goals"
            action={<Link href="/goals" className="btn btn-ghost">All goals</Link>}
          />
          <PanelBody className="space-y-5">
            {f.goals.length === 0 ? (
              <EmptyState compact title="No financial goals" description="Emergency fund, debt reduction, savings rate, net worth." />
            ) : (
              f.goals.map((g) => (
                <div key={g.id}>
                  <ProgressBar
                    value={g.progress}
                    label={g.title}
                    right={
                      g.target_value === null
                        ? "no target"
                        : `${g.current_value ?? 0} / ${g.target_value}${g.unit === "ZAR" ? "" : ` ${g.unit ?? ""}`}`
                    }
                  />
                </div>
              ))
            )}
          </PanelBody>
        </Panel>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Where the money went" meta="This month, by category">
          <Panel>
            <PanelBody>
              <CompositionBar
                format={money}
                emptyLabel="No expenses recorded"
                segments={f.categories.map((c) => ({ label: c.category, value: c.total }))}
              />
            </PanelBody>
          </Panel>
        </Section>

        <Section title="In against out" meta="Last six months">
          <Panel>
            <PanelBody>
              {f.cashMonths.length === 0 ? (
                <EmptyState
                  compact
                  title="Nothing recorded"
                  description="Log income and expenses and the shape of each month appears here."
                />
              ) : (
                <>
                  <PairedBars
                    points={f.cashMonths.map((m) => ({
                      label: m.month,
                      a: m.incomeCents,
                      b: m.expensesCents,
                    }))}
                    format={money}
                    labels={["In", "Out"]}
                  />
                  <div className="hairline mt-6 pt-5">
                    <KpiGrid cols={3}>
                      <Kpi label="In" value={money(f.income30Cents)} detail="30 days" />
                      <Kpi label="Out" value={money(f.expenses30Cents)} detail="30 days" />
                      <Kpi
                        label="Surplus"
                        value={money(f.income30Cents - f.expenses30Cents)}
                        tone={f.income30Cents - f.expenses30Cents < 0 ? "critical" : "positive"}
                        detail="30 days"
                      />
                    </KpiGrid>
                  </div>
                </>
              )}
            </PanelBody>
          </Panel>
        </Section>
      </div>
    </div>
  );
}
