import Link from "next/link";
import { formatDayShort, today } from "@/lib/core/date";
import { km, money, num, pct } from "@/lib/core/format";
import {
  averageScores,
  balanceNow,
  overallTrajectory,
  pillarTrajectories,
  scoreHistory,
  scoreSeries,
} from "@/lib/services/scores";
import { PILLAR_NAME } from "@/lib/domain/balance";
import { addDays } from "@/lib/core/date";
import { businessDashboard } from "@/lib/services/business";
import { financeDashboard } from "@/lib/services/finance";
import { bodyDashboard, runningOverview } from "@/lib/services/body";
import { characterDashboard } from "@/lib/services/character";
import { learningStats } from "@/lib/services/growth";
import { activeSeason } from "@/lib/services/core";
import { weightsFromSeason } from "@/lib/domain/scoring";
import {
  AlertCard,
  BarSeries,
  EmptyState,
  Kpi,
  LineChart,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  Section,
  Sparkline,
  TableWrap,
  TrendGlyph,
} from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const day = today();
  const season = await activeSeason(day);
  const weights = weightsFromSeason(season);
  const trajectories = await pillarTrajectories(28, day);
  const overall = await overallTrajectory(28, day);
  const balance = await balanceNow(28, day);
  const history = await scoreHistory(90, day);

  const week = await averageScores(addDays(day, -6), day);
  const month = await averageScores(addDays(day, -29), day);
  const quarter = await averageScores(addDays(day, -89), day);

  const business = await businessDashboard(day);
  const finance = await financeDashboard(day);
  const body = await bodyDashboard(day);
  const running = await runningOverview(day);
  const character = await characterDashboard(day);
  const learning = await learningStats(day);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Growth"
        title="Analytics"
        description="Trends, not snapshots. Every series here is drawn only from days you actually recorded something."
      />

      {history.length < 7 ? (
        <AlertCard
          severity="INFO"
          title="The data is still thin"
          body={`${history.length} scored days recorded. Trends become meaningful somewhere around three weeks of consistent logging.`}
        />
      ) : null}

      <Panel>
        <PanelBody>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="label mb-2">Overall performance</div>
              <div className="flex items-baseline gap-3">
                <span className="numeral text-5xl font-medium leading-none text-ink">
                  {overall.recentAverage === null ? "—" : Math.round(overall.recentAverage)}
                </span>
                <TrendGlyph trend={overall.trend} className="text-2xl" />
              </div>
              <p className="mt-2.5 text-[0.6875rem] text-ink-faint">{overall.detail}</p>
            </div>
            <Sparkline points={(await scoreSeries("overall", 90, day)).map((s) => s.value)} width={320} height={56} />
          </div>
        </PanelBody>
      </Panel>

      <Section title="Trajectory" meta="Direction of each pillar across the last 28 scored days.">
        <Panel>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>Pillar</th>
                  <th className="text-right">Today</th>
                  <th className="text-right">7 day</th>
                  <th className="text-right">30 day</th>
                  <th className="text-right">90 day</th>
                  <th className="text-right">Season weight</th>
                  <th>Trend</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {trajectories.map((t) => {
                  const key = t.pillar.toLowerCase() as keyof typeof week;
                  return (
                    <tr key={t.pillar}>
                      <td className="text-ink">{PILLAR_NAME[t.pillar]}</td>
                      <td className="numeral text-right text-ink">
                        {t.score === null ? "—" : Math.round(t.score)}
                      </td>
                      <td className="numeral text-right text-ink-dim">{week[key] ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{month[key] ?? "—"}</td>
                      <td className="numeral text-right text-ink-dim">{quarter[key] ?? "—"}</td>
                      <td className="numeral text-right text-ink-faint">{weights[t.pillar]}%</td>
                      <td>
                        <TrendGlyph trend={t.trend} />
                      </td>
                      <td className="text-[0.6875rem] text-ink-faint">{t.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      </Section>

      <Section title="Balance" meta="The point is not to maximise one pillar at the cost of the rest.">
        <Panel>
          <PanelBody className="space-y-6">
            {balance.spread === null ? (
              <EmptyState compact title="Not enough measured pillars" description="At least two pillars need scores before balance means anything." />
            ) : (
              <>
                <KpiGrid cols={3}>
                  <Kpi label="Spread" value={balance.spread} detail="strongest minus weakest" />
                  <Kpi
                    label="Strongest"
                    value={balance.strongest ? PILLAR_NAME[balance.strongest.pillar] : "—"}
                    detail={balance.strongest?.score?.toString()}
                  />
                  <Kpi
                    label="Weakest"
                    value={balance.weakest ? PILLAR_NAME[balance.weakest.pillar] : "—"}
                    detail={balance.weakest?.score?.toString()}
                    tone="attention"
                  />
                </KpiGrid>
                <div className="hairline space-y-4 pt-6">
                  {trajectories.map((t) => (
                    <div key={t.pillar} className="flex items-center gap-4">
                      <span className="label w-24 flex-none">{PILLAR_NAME[t.pillar]}</span>
                      <div className="flex-1">
                        <ProgressBar value={t.score} />
                      </div>
                      <span className="numeral w-10 flex-none text-right text-xs text-ink-dim">
                        {t.score === null ? "—" : Math.round(t.score)}
                      </span>
                      <TrendGlyph trend={t.trend} className="w-4 flex-none text-center" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </PanelBody>
        </Panel>

        {balance.findings.length > 0 ? (
          <div className="space-y-px">
            {balance.findings.map((f, i) => (
              <AlertCard key={i} severity={f.severity} title={f.headline} body={f.detail} />
            ))}
          </div>
        ) : null}
      </Section>

      <Section title="Score history" meta="Last 90 days of overall performance.">
        <Panel>
          <PanelBody>
            <LineChart
              height={120}
              showZero={false}
              points={(await scoreSeries("overall", 90, day)).map((s) => ({
                label: formatDayShort(s.date),
                value: s.value,
              }))}
              format={(v) => String(Math.round(v))}
            />
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Pillar detail">
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Body" action={<Link href="/body" className="btn btn-ghost">Open</Link>} />
            <PanelBody>
              <KpiGrid cols={2}>
                <Kpi label="Sessions this week" value={body.sessionsThisWeek} />
                <Kpi label="Weekly distance" value={body.weeklyDistanceM > 0 ? km(body.weeklyDistanceM) : "—"} />
                <Kpi label="Acute load" value={body.load.acute ?? "—"} />
                <Kpi label="30-day distance" value={running.totalDistance30 > 0 ? km(running.totalDistance30) : "—"} />
              </KpiGrid>
              <p className="mt-5 text-xs leading-relaxed text-ink-faint">{body.nutritionTrend.message}</p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Business" action={<Link href="/business" className="btn btn-ghost">Open</Link>} />
            <PanelBody>
              <KpiGrid cols={2}>
                <Kpi label="MRR" value={business.mrrCents > 0 ? money(business.mrrCents) : "—"} />
                <Kpi label="Customers" value={business.customerCount || "—"} />
                <Kpi label="Open leads" value={business.pipeline.totalOpen || "—"} />
                <Kpi label="90-day revenue" value={money(business.revenue90Cents)} />
              </KpiGrid>
              <p className="mt-5 text-xs leading-relaxed text-ink-faint">
                {business.pipeline.bottleneck
                  ? `${business.pipeline.bottleneck.from} → ${business.pipeline.bottleneck.to} is converting at ${business.pipeline.bottleneck.rate}%, the weakest step in the funnel.`
                  : "No single stage stands out as the bottleneck yet."}
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Finance" action={<Link href="/finance" className="btn btn-ghost">Open</Link>} />
            <PanelBody>
              <KpiGrid cols={2}>
                <Kpi label="Net worth" value={money(finance.now.netWorthCents)} />
                <Kpi label="Cash" value={money(finance.now.cashCents)} />
                <Kpi label="Debt" value={finance.debt.totalCents > 0 ? money(finance.debt.totalCents) : "—"} />
                <Kpi label="Savings rate" value={finance.savingsRate === null ? "—" : pct(finance.savingsRate)} />
              </KpiGrid>
              <p className="mt-5 text-xs leading-relaxed text-ink-faint">
                {finance.forecast30.shortfall
                  ? `A shortfall of ${money(finance.forecast30.shortfall.amountCents)} is projected on ${finance.forecast30.shortfall.date}.`
                  : "No shortfall projected in the next 30 days."}
              </p>
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Character & learning" action={<Link href="/character" className="btn btn-ghost">Open</Link>} />
            <PanelBody>
              <KpiGrid cols={2}>
                <Kpi
                  label="Promise rate"
                  value={character.promises30.rate === null ? "—" : pct(character.promises30.rate, 1)}
                />
                <Kpi
                  label="Habit consistency"
                  value={character.portfolio30.average === null ? "—" : pct(character.portfolio30.average)}
                />
                <Kpi label="Learning hours (30d)" value={`${Math.round(learning.minutes30 / 6) / 10}h`} />
                <Kpi
                  label="Application rate"
                  value={learning.applicationRate === null ? "—" : pct(learning.applicationRate)}
                />
              </KpiGrid>
              <p className="mt-5 text-xs leading-relaxed text-ink-faint">
                {character.quality.insight ?? "Not enough rated decision outcomes to draw a conclusion yet."}
              </p>
            </PanelBody>
          </Panel>
        </div>
      </Section>
    </div>
  );
}
