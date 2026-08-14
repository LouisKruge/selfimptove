import Link from "next/link";
import { formatDayShort, today } from "@/lib/core/date";
import { pct } from "@/lib/core/format";
import { characterDashboard, habitDoneSet, listHabits, promisesFor } from "@/lib/services/character";
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
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { HabitChecklist } from "@/components/character/HabitChecklist";
import { PromiseList } from "@/components/character/PromiseList";
import { PromiseForm } from "@/components/character/PromiseForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discipline" };

export default async function CharacterPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const c = await characterDashboard(day);
  const habits = await listHabits();
  const done = [...await habitDoneSet(day)];
  const todayPromises = await promisesFor(day);
  const score = await storedScore(day);
  const series = await scoreSeries("character", 28, day);
  const t = trajectory(series.map((s) => s.value));

  const consistency = Object.fromEntries(c.habits.map((h) => [h.habitId, h.consistency30]));
  const overdue = c.openPromises.filter((p) => p.date < day);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Character"
        title="Discipline"
        description="Character is measured through behaviour that was recorded. Promise rate is reliability to yourself; habit consistency is frequency against a stated target."
        actions={
          <>
            <Link href="/character/habits" className="btn btn-ghost">Habits</Link>
            <Link href="/character/decisions" className="btn btn-ghost">Decisions</Link>
          </>
        }
      />

      {overdue.length > 0 ? (
        <AlertCard
          severity="ATTENTION"
          title={`${overdue.length} unresolved ${overdue.length === 1 ? "promise" : "promises"}`}
          body="Mark them kept or broken. An unresolved promise measures nothing — and the promise rate only counts what was resolved."
        />
      ) : null}

      <Panel>
        <PanelBody>
          <div className="flex flex-wrap items-end justify-between gap-8">
            <div>
              <div className="label mb-2">Character score today</div>
              <div className="flex items-baseline gap-3">
                <span className="numeral text-5xl font-medium leading-none text-ink">
                  {score?.character === null || !score ? "—" : Math.round(score.character)}
                </span>
                <TrendGlyph trend={t.trend} className="text-2xl" />
              </div>
              <p className="mt-2.5 text-[0.6875rem] text-ink-faint">{t.detail}</p>
            </div>
            <Sparkline points={series.map((s) => s.value)} width={240} height={48} />
          </div>
        </PanelBody>
      </Panel>

      <Section title="Promise rate" meta="Kept divided by resolved. Open promises are never counted.">
        <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
          <Panel>
            <PanelBody>
              <div className="label">30 days</div>
              <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
                {c.promises30.rate === null ? "—" : pct(c.promises30.rate, 1)}
              </div>
              <div className="mt-3 text-[0.6875rem] text-ink-faint">{c.promises30.message}</div>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelBody>
              <div className="label">90 days</div>
              <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
                {c.promises90.rate === null ? "—" : pct(c.promises90.rate, 1)}
              </div>
              <div className="mt-3 text-[0.6875rem] text-ink-faint">
                {c.promises90.kept} kept · {c.promises90.broken} broken
              </div>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelBody>
              <div className="label">Standard</div>
              <div className="numeral mt-3 text-3xl font-medium leading-none text-ink-dim">90%</div>
              <div className="mt-3 text-[0.6875rem] text-ink-faint">
                {c.promises30.meetsTarget === null
                  ? "Not enough resolved promises."
                  : c.promises30.meetsTarget
                    ? "Above the standard."
                    : "Below the standard."}
              </div>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelBody>
              <div className="label">Discipline</div>
              <div className="numeral mt-3 text-3xl font-medium leading-none text-ink">
                {c.disciplineScore === null ? "—" : c.disciplineScore}
              </div>
              <div className="mt-3 text-[0.6875rem] text-ink-faint">
                Promise reliability and habit consistency, 30 days.
              </div>
            </PanelBody>
          </Panel>
        </div>
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Today's promises" meta={`${todayPromises.length} made`} />
          <PanelBody className="space-y-6">
            <PromiseList promises={todayPromises} allowDelete />
            <div className="hairline pt-5">
              <Disclosure label="Make a promise" defaultOpen={params.quick === "promise"}>
                <PromiseForm date={day} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Habits today"
            meta={`${done.length} of ${habits.length} done`}
            action={<Link href="/character/habits" className="btn btn-ghost">Open</Link>}
          />
          <PanelBody>
            <HabitChecklist habits={habits} done={done} date={day} consistency={consistency} />
            <div className="hairline mt-5 pt-5">
              <KpiGrid cols={3}>
                <Kpi label="7-day" value={c.portfolio7.average === null ? "—" : pct(c.portfolio7.average)} />
                <Kpi label="30-day" value={c.portfolio30.average === null ? "—" : pct(c.portfolio30.average)} />
                <Kpi label="90-day" value={c.portfolio90.average === null ? "—" : pct(c.portfolio90.average)} />
              </KpiGrid>
            </div>
          </PanelBody>
        </Panel>
      </div>

      {c.openPromises.length > 0 ? (
        <Section title="Open promises" meta={`${c.openPromises.length} unresolved`}>
          <Panel>
            <PanelBody>
              <PromiseList promises={c.openPromises} showDate allowDelete />
            </PanelBody>
          </Panel>
        </Section>
      ) : null}

      <Section
        title="Decision quality"
        meta="Comparing outcomes of calm decisions against emotionally charged ones."
        action={<Link href="/character/decisions" className="btn btn-ghost">All decisions</Link>}
      >
        <Panel>
          <PanelBody>
            <KpiGrid cols={4}>
              <Kpi label="Decided" value={c.quality.decided || "—"} />
              <Kpi label="With outcome" value={c.quality.withOutcome || "—"} />
              <Kpi label="Calm average" value={c.quality.calmAverage ?? "—"} detail="outcome rating" />
              <Kpi label="High-emotion average" value={c.quality.highEmotionAverage ?? "—"} detail="outcome rating" />
            </KpiGrid>
            <p className="mt-5 text-sm leading-relaxed text-ink-dim">
              {c.quality.insight ??
                "Not enough rated outcomes yet to compare calm decisions against charged ones. Record what actually happened after each decision."}
            </p>
          </PanelBody>
        </Panel>
      </Section>

      {c.cooling.length > 0 ? (
        <Section title="In the firewall" meta={`${c.cooling.length} cooling`}>
          <div className="grid gap-px sm:grid-cols-2">
            {c.cooling.map((d) => (
              <Link key={d.id} href={`/character/decisions/${d.id}`} className="panel p-4 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-ink">{d.title}</span>
                  <Badge tone={d.level === "RED" ? "critical" : "attention"}>{d.level}</Badge>
                </div>
                <p className="mt-2.5 text-xs text-ink-faint">{d.cooling.label}</p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
