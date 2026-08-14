import Link from "next/link";
import { formatDayShort, today } from "@/lib/core/date";
import { money, moneyCompact, num, pct } from "@/lib/core/format";
import { businessDashboard } from "@/lib/services/business";
import { scoreSeries, storedScore } from "@/lib/services/scores";
import { trajectory } from "@/lib/domain/trajectory";
import {
  AlertCard,
  Badge,
  BarSeries,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  Section,
  Sparkline,
  TrendGlyph,
} from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business" };

export default async function BusinessDashboardPage() {
  const day = today();
  const b = await businessDashboard(day);
  const score = await storedScore(day);
  const series = await scoreSeries("business", 28, day);
  const t = trajectory(series.map((s) => s.value));

  const mrrProgress =
    b.mrrTargetCents && b.mrrTargetCents > 0 ? (b.mrrCents / b.mrrTargetCents) * 100 : null;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Business"
        title={b.business?.name ?? "Business"}
        description={b.business?.offer ?? "Build scalable revenue and valuable assets."}
        actions={
          <>
            <Link href="/business/sales" className="btn btn-primary">Pipeline</Link>
            <Link href="/business/strategy" className="btn btn-ghost">Strategy</Link>
          </>
        }
      />

      <Panel>
        <PanelBody>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="label mb-2">Business score today</div>
              <div className="flex items-baseline gap-3">
                <span className="numeral text-5xl font-medium leading-none text-ink">
                  {score?.business === null || !score ? "—" : Math.round(score.business)}
                </span>
                <TrendGlyph trend={t.trend} className="text-2xl" />
              </div>
              <p className="mt-2.5 text-[0.6875rem] text-ink-faint">{t.detail}</p>
            </div>
            <Sparkline points={series.map((s) => s.value)} width={240} height={48} />
          </div>
        </PanelBody>
      </Panel>

      <Section title="Revenue">
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
          <Panel>
            <PanelBody>
              <div className="label">MRR</div>
              <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
                {b.mrrCents > 0 ? moneyCompact(b.mrrCents) : "—"}
              </div>
              {b.mrrTargetCents ? (
                <div className="mt-4">
                  <ProgressBar
                    value={mrrProgress}
                    right={`target ${moneyCompact(b.mrrTargetCents)}`}
                  />
                </div>
              ) : null}
            </PanelBody>
          </Panel>
          <Panel>
            <PanelBody>
              <div className="label">This month</div>
              <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
                {money(b.revenueThisMonthCents)}
              </div>
              <div className="mt-3 text-[0.6875rem] text-ink-faint">
                Last month {money(b.revenueLastMonthCents)}
              </div>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelBody>
              <div className="label">Profit this month</div>
              <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
                {money(b.profitThisMonthCents)}
              </div>
              <div className="mt-3 text-[0.6875rem] text-ink-faint">
                {money(b.expensesThisMonthCents)} expenses
              </div>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelBody>
              <div className="label">Customers</div>
              <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
                {b.customerCount || "—"}
              </div>
              <div className="mt-3 text-[0.6875rem] text-ink-faint">
                {b.avgDealCents ? `${money(b.avgDealCents)} average` : "No average deal value set"}
              </div>
            </PanelBody>
          </Panel>
        </div>
      </Section>

      <Section title="Revenue by month" meta={b.revenueTrend.detail}>
        <Panel>
          <PanelBody>
            <BarSeries
              height={80}
              points={b.months.map((m) => ({ label: m.month, value: Math.round(m.revenueCents / 100) }))}
              format={(v) => money(v * 100)}
            />
          </PanelBody>
        </Panel>
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Pipeline"
            meta={`${b.pipeline.totalOpen} open · ${money(b.pipeline.weightedValueCents)} weighted`}
            action={<Link href="/business/sales" className="btn btn-ghost">Open</Link>}
          />
          <PanelBody className="space-y-4">
            {b.pipeline.stages.map((s) => (
              <div key={s.stage} className="flex items-center gap-4">
                <span className="label w-24 flex-none">{s.stage.replace("_", " ")}</span>
                <div className="flex-1">
                  <ProgressBar
                    value={
                      b.pipeline.stages[0].everReached > 0
                        ? (s.everReached / b.pipeline.stages[0].everReached) * 100
                        : null
                    }
                  />
                </div>
                <span className="numeral w-8 flex-none text-right text-xs text-ink-dim">
                  {s.current}
                </span>
              </div>
            ))}
            {b.pipeline.bottleneck ? (
              <p className="hairline pt-4 text-xs leading-relaxed text-ink-faint">
                {b.pipeline.bottleneck.from} → {b.pipeline.bottleneck.to} converts at{" "}
                {b.pipeline.bottleneck.rate}% across {b.pipeline.bottleneck.reached} leads. That is
                the bottleneck.
              </p>
            ) : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Highest-value next actions" meta="Expected value weighted by urgency" />
          <PanelBody>
            {b.nextActions.length === 0 ? (
              <EmptyState compact title="No open leads" description="Revenue cannot arrive from an empty pipeline." />
            ) : (
              <ul className="space-y-4">
                {b.nextActions.map((a) => (
                  <li key={a.id} className="border-b border-line-soft pb-4 last:border-b-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link href={`/business/sales/${a.id}`} className="text-sm text-ink hover:underline">
                        {a.company}
                      </Link>
                      <span className="numeral text-xs text-ink-dim">{money(a.expectedCents)}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-ink-faint">
                      {a.next_action ? `${a.next_action} · ${a.reason}` : a.reason}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Section title="Working backward from the target" meta={b.plan.note}>
        <Panel>
          <PanelBody>
            {b.plan.customersRequired === null ? (
              <EmptyState
                compact
                title="Cannot back-solve yet"
                description="Set an average deal value and an MRR target on the business."
                action={<Link href="/business/strategy" className="btn">Strategy</Link>}
              />
            ) : (
              <>
                <KpiGrid cols={3}>
                  <Kpi label="Target MRR" value={money(b.plan.targetMrrCents)} />
                  <Kpi label="Customers required" value={b.plan.customersRequired} />
                  <Kpi label="Gap" value={b.plan.customerGap ?? "—"} detail={`${b.plan.currentCustomers} today`} />
                </KpiGrid>

                <div className="hairline mt-6 space-y-3 pt-6">
                  {[...b.plan.steps].reverse().map((s) => (
                    <div key={s.stage} className="flex items-center gap-4">
                      <span className="label w-24 flex-none">{s.stage.replace("_", " ")}</span>
                      <span className="numeral flex-1 text-sm text-ink">
                        {s.required === null ? "—" : num(s.required)}
                      </span>
                      <span className="numeral w-28 flex-none text-right text-[0.6875rem] text-ink-faint">
                        {s.rateOut === null ? "rate unknown" : `${s.rateOut}% converts`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Projects" action={<Link href="/business/projects" className="btn btn-ghost">All projects</Link>}>
        {b.projects.length === 0 ? (
          <EmptyState compact title="No active projects" description="Projects are how a mission actually gets built." />
        ) : (
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {b.projects.slice(0, 6).map((p) => (
              <Link key={p.id} href={`/business/projects/${p.id}`} className="panel p-4 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-ink">{p.title}</span>
                  <Badge tone={p.status === "BLOCKED" ? "critical" : "muted"}>{p.status}</Badge>
                </div>
                {p.next_action ? (
                  <p className="mt-2.5 text-xs leading-relaxed text-ink-faint">
                    <span className="label mr-2">Next</span>
                    {p.next_action}
                  </p>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
