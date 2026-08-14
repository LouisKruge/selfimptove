import Link from "next/link";
import { formatDayShort, today, weekdayShort } from "@/lib/core/date";
import { km, num, pct } from "@/lib/core/format";
import { bodyDashboard } from "@/lib/services/body";
import { scoreSeries, storedScore } from "@/lib/services/scores";
import { trajectory } from "@/lib/domain/trajectory";
import {
  AlertCard,
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
  Sparkline,
  TrendGlyph,
  cx,
} from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Body" };

export default async function BodyDashboardPage() {
  const day = today();
  const b = await bodyDashboard(day);
  const score = await storedScore(day);
  const series = await scoreSeries("body", 28, day);
  const t = trajectory(series.map((s) => s.value));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Body"
        title="Hybrid Athlete"
        description="Muscular, lean, strong, athletic, conditioned, HYROX capable, mobile, durable. Every number here is something you recorded."
        actions={
          <Link href="/body/training" className="btn btn-primary">
            Training
          </Link>
        }
      />

      {/* ----------------------------------------------------------- SCORE */}
      <Panel>
        <PanelBody>
          <div className="flex flex-wrap items-end gap-10">
            <div>
              <div className="label mb-2">Body score today</div>
              <div className="flex items-baseline gap-3">
                <span className="numeral text-5xl font-medium leading-none text-ink">
                  {score?.body === null || !score ? "—" : Math.round(score.body)}
                </span>
                <TrendGlyph trend={t.trend} className="text-2xl" />
              </div>
              <p className="mt-2.5 text-[0.6875rem] text-ink-faint">{t.detail}</p>
            </div>
            <Sparkline points={series.map((s) => s.value)} width={240} height={48} />
          </div>
        </PanelBody>
      </Panel>

      {/* ---------------------------------------------------------- TODAY */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader
            title="Today"
            action={
              <Link href="/body/training" className="btn btn-ghost">
                Open
              </Link>
            }
          />
          <PanelBody className="space-y-4">
            {b.todaySessions.length === 0 ? (
              <p className="text-xs text-ink-faint">Nothing scheduled.</p>
            ) : (
              b.todaySessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/body/training/${s.id}`}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="truncate text-sm text-ink">{s.name}</span>
                  <Badge tone={s.status === "COMPLETED" ? "positive" : "muted"}>{s.status}</Badge>
                </Link>
              ))
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Readiness"
            action={
              <Link href="/body/recovery" className="btn btn-ghost">
                Open
              </Link>
            }
          />
          <PanelBody>
            <div className="numeral text-3xl font-medium leading-none text-ink">
              {b.readiness.level ?? "—"}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-faint">{b.readiness.message}</p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Nutrition"
            action={
              <Link href="/body/nutrition" className="btn btn-ghost">
                Open
              </Link>
            }
          />
          <PanelBody className="space-y-4">
            {b.nutrition.target ? (
              <>
                <ProgressBar
                  value={b.nutrition.proteinPct}
                  label="Protein"
                  right={`${Math.round(b.nutrition.log?.protein_g ?? 0)} / ${b.nutrition.target.protein_g}g`}
                />
                <ProgressBar
                  value={b.nutrition.caloriePct}
                  label="Calories"
                  right={`${num(b.nutrition.log?.calories ?? 0)} / ${num(b.nutrition.target.calories)}`}
                />
              </>
            ) : (
              <p className="text-xs text-ink-faint">No target set.</p>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* ----------------------------------------------------------- WEEK */}
      <Section
        title="This week"
        meta={`${b.sessionsThisWeek} sessions completed · ${b.weeklyDistanceM > 0 ? km(b.weeklyDistanceM) : "no"} running`}
        action={
          <Link href="/body/training" className="btn btn-ghost">
            Calendar
          </Link>
        }
      >
        <div className="grid grid-cols-7 gap-px bg-line">
          {b.week.map((d) => (
            <Link
              key={d.date}
              href={`/body/training?week=${b.week[0].date}`}
              className={cx(
                "bg-panel p-3 transition-colors hover:bg-raised",
                d.date === day && "border-t-2 border-t-ink",
              )}
            >
              <div className="label">{weekdayShort(d.date)}</div>
              <div className="mt-2.5 space-y-1">
                {d.sessions.length === 0 ? (
                  <span className="text-[0.625rem] text-ink-ghost">
                    {d.isRestDay ? "rest" : "—"}
                  </span>
                ) : (
                  d.sessions.map((s) => (
                    <div key={s.id} className="truncate text-[0.625rem] text-ink-dim">
                      {s.name}
                    </div>
                  ))
                )}
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* ----------------------------------------------------------- LOAD */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Training load" meta="Acute against chronic" />
          <PanelBody className="space-y-5">
            <KpiGrid cols={3}>
              <Kpi label="Acute" value={b.load.acute ?? "—"} />
              <Kpi label="Chronic" value={b.load.chronic ?? "—"} />
              <Kpi
                label="Ratio"
                value={b.load.ratio ?? "—"}
                tone={
                  b.load.status === "SHARP_INCREASE" || b.load.status === "SHARP_DROP"
                    ? "attention"
                    : "default"
                }
              />
            </KpiGrid>
            <p className="text-xs leading-relaxed text-ink-faint">{b.load.message}</p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Volume by muscle group" meta="Working sets this week" />
          <PanelBody>
            {b.volumeByGroup.length === 0 ? (
              <p className="text-xs text-ink-faint">No sets logged this week.</p>
            ) : (
              <div className="space-y-4">
                {b.volumeByGroup.slice(0, 6).map((v) => (
                  <ProgressBar
                    key={v.group}
                    value={Math.min(
                      100,
                      (v.sets / Math.max(...b.volumeByGroup.map((x) => x.sets))) * 100,
                    )}
                    label={v.group}
                    right={`${v.sets} sets`}
                  />
                ))}
              </div>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* -------------------------------------------------------- RECORDS */}
      <Section title="Recent records" action={<Link href="/body/strength" className="btn btn-ghost">Strength</Link>}>
        {b.records.length === 0 ? (
          <EmptyState
            compact
            title="No records yet"
            description="A record is only recorded when it genuinely beats everything logged before it."
          />
        ) : (
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {b.records.map((r) => (
              <Panel key={r.id}>
                <PanelBody className="p-4">
                  <div className="label mb-2">{r.kind}</div>
                  <div className="text-sm text-ink">{r.exerciseName ?? r.station ?? "Record"}</div>
                  <div className="numeral mt-1.5 text-lg text-ink">{r.display}</div>
                  <div className="mt-2 text-[0.6875rem] text-ink-faint">{formatDayShort(r.date)}</div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        )}
      </Section>

      {/* --------------------------------------------------------- BODY COMP */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Composition"
            action={
              <Link href="/body/measurements" className="btn btn-ghost">
                Open
              </Link>
            }
          />
          <PanelBody>
            {b.latestMeasurement ? (
              <KpiGrid cols={4}>
                <Kpi label="Weight" value={b.latestMeasurement.weight_kg ?? "—"} detail="kg" />
                <Kpi label="Body fat" value={b.latestMeasurement.body_fat_pct ?? "—"} detail="%" />
                <Kpi label="Waist" value={b.latestMeasurement.waist_cm ?? "—"} detail="cm" />
                <Kpi label="Chest" value={b.latestMeasurement.chest_cm ?? "—"} detail="cm" />
              </KpiGrid>
            ) : (
              <p className="text-xs text-ink-faint">No measurements recorded.</p>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Nutrition trend"
            action={
              <Link href="/body/nutrition" className="btn btn-ghost">
                Open
              </Link>
            }
          />
          <PanelBody>
            <p className="text-sm leading-relaxed text-ink-dim">{b.nutritionTrend.message}</p>
            <div className="mt-5">
              <KpiGrid cols={3}>
                <Kpi
                  label="Avg calories"
                  value={b.nutritionTrend.avgCalories === null ? "—" : num(b.nutritionTrend.avgCalories)}
                />
                <Kpi
                  label="Avg protein"
                  value={b.nutritionTrend.avgProtein === null ? "—" : `${b.nutritionTrend.avgProtein}g`}
                />
                <Kpi label="Logging" value={pct(b.nutritionTrend.loggingRate)} />
              </KpiGrid>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {b.load.status === "SHARP_INCREASE" || b.load.status === "SHARP_DROP" ? (
        <AlertCard
          severity="ATTENTION"
          title="Workload changed sharply"
          body={`${b.load.message} This is a description of recorded workload, not a medical assessment.`}
          href="/body/training"
        />
      ) : null}
    </div>
  );
}
