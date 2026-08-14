import Link from "next/link";
import { formatDayShort, today } from "@/lib/core/date";
import { money, num, pct } from "@/lib/core/format";
import { learningStats, listLearningItems, skillViews } from "@/lib/services/growth";
import { scoreSeries, storedScore } from "@/lib/services/scores";
import { trajectory } from "@/lib/domain/trajectory";
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
  Sparkline,
  TableWrap,
  TrendGlyph,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { ApplyForm, DeleteLearningButton, LearningForm, SkillForm } from "@/components/growth/GrowthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Learning" };

export default async function LearningPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const skills = await skillViews();
  const stats = await learningStats(day);
  const items = await listLearningItems(60);
  const score = await storedScore(day);
  const series = await scoreSeries("learning", 28, day);
  const t = trajectory(series.map((s) => s.value));

  const unapplied = items.filter((i) => i.applied === 0 && i.kind !== "APPLICATION");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Growth"
        title="Learning"
        description="Measured by capability, not consumption. Hours only count once something changed because of them."
      />

      <Panel>
        <PanelBody>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="label mb-2">Learning score today</div>
              <div className="flex items-baseline gap-3">
                <span className="numeral text-5xl font-medium leading-none text-ink">
                  {score?.learning === null || !score ? "—" : Math.round(score.learning)}
                </span>
                <TrendGlyph trend={t.trend} className="text-2xl" />
              </div>
              <p className="mt-2.5 text-[0.6875rem] text-ink-faint">{t.detail}</p>
            </div>
            <Sparkline points={series.map((s) => s.value)} width={240} height={48} />
          </div>
          <div className="hairline mt-6 pt-6">
            <KpiGrid cols={5}>
              <Kpi label="Active days" value={`${stats.activeDays7}/7`} />
              <Kpi label="Hours this week" value={`${Math.round(stats.minutes7 / 6) / 10}h`} />
              <Kpi label="Hours (30 days)" value={`${Math.round(stats.minutes30 / 6) / 10}h`} />
              <Kpi
                label="Application rate"
                value={stats.applicationRate === null ? "—" : pct(stats.applicationRate)}
                detail={`${stats.applied30} of ${stats.total30}`}
              />
              <Kpi
                label="Revenue attributed"
                value={stats.revenueAttributedCents > 0 ? money(stats.revenueAttributedCents) : "—"}
              />
            </KpiGrid>
          </div>
        </PanelBody>
      </Panel>

      <Section title="Skills" meta={`${skills.length} tracked`}>
        {skills.length === 0 ? (
          <EmptyState
            title="No skills defined"
            description="Name the handful that directly increase earning power for the current mission."
          />
        ) : (
          <div className="space-y-px">
            {skills.map((s) => (
              <Panel key={s.id}>
                <PanelBody>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <Link href={`/learning/${s.id}`} className="group block">
                        <h3 className="text-base font-medium text-ink transition-colors group-hover:text-ink-dim">
                          {s.name}
                        </h3>
                      </Link>
                      {s.why ? (
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">{s.why}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.6875rem] text-ink-faint">
                        <span>{s.hours}h logged</span>
                        <span>{s.applications} applications</span>
                        <span>{s.items} entries</span>
                        {s.revenueCents > 0 ? <span>{money(s.revenueCents)} attributed</span> : null}
                        {s.lastActivity ? <span>last {formatDayShort(s.lastActivity)}</span> : null}
                      </div>
                    </div>
                    <div className="w-full lg:w-72 lg:flex-none">
                      <ProgressBar
                        value={s.progress}
                        label="Level"
                        right={`${s.current_level} → ${s.target_level}`}
                      />
                      <p className="mt-2 text-[0.6875rem] text-ink-faint">
                        {s.gap === 0 ? "At target." : `${s.gap} levels to go.`}
                      </p>
                    </div>
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        )}
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Log learning">
          <Disclosure label="Log learning" defaultOpen={params.quick === "learning"}>
            <LearningForm date={day} skills={skills.map((s) => ({ value: s.id, label: s.name }))} />
          </Disclosure>
        </Section>
        <Section title="Add a skill">
          <Disclosure label="Add skill" defaultOpen={skills.length === 0}>
            <SkillForm />
          </Disclosure>
        </Section>
      </div>

      {unapplied.length > 0 ? (
        <Section
          title="Studied but not applied"
          meta={`${unapplied.length} items · this is where consumption hides`}
        >
          <Panel>
            <PanelBody className="space-y-5">
              {unapplied.slice(0, 6).map((i) => (
                <div key={i.id} className="border-b border-line-soft pb-5 last:border-b-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink">{i.title}</span>
                    <span className="numeral text-[0.6875rem] text-ink-faint">
                      {formatDayShort(i.date)} · {i.minutes}m
                    </span>
                  </div>
                  {i.how_i_will_apply ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                      <span className="label mr-2">Plan</span>
                      {i.how_i_will_apply}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <ApplyForm itemId={i.id} />
                  </div>
                </div>
              ))}
            </PanelBody>
          </Panel>
        </Section>
      ) : null}

      <Section title="History" meta={`${items.length} entries`}>
        {items.length === 0 ? (
          <EmptyState
            title="Nothing logged"
            description="What I learned · why it matters · how I will apply it · result. All four, or it does not count."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>What</th>
                    <th>Kind</th>
                    <th className="text-right">Minutes</th>
                    <th>Applied</th>
                    <th className="text-right">Revenue</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td className="numeral whitespace-nowrap text-ink-faint">{formatDayShort(i.date)}</td>
                      <td className="text-ink">{i.title}</td>
                      <td>
                        <Badge tone="muted">{i.kind}</Badge>
                      </td>
                      <td className="numeral text-right text-ink-dim">{i.minutes}</td>
                      <td>
                        {i.applied ? <Badge tone="positive">Yes</Badge> : <span className="text-ink-ghost">—</span>}
                      </td>
                      <td className="numeral text-right text-ink-dim">
                        {i.revenue_cents ? money(i.revenue_cents) : "—"}
                      </td>
                      <td className="text-right">
                        <DeleteLearningButton itemId={i.id} />
                      </td>
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
