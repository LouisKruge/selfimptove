import Link from "next/link";
import { commandCenter } from "@/lib/services/overview";
import { formatCommandDate, today } from "@/lib/core/date";
import { money, moneyCompact, num, pct } from "@/lib/core/format";
import { PILLAR_NAME } from "@/lib/domain/balance";
import {
  AlertCard,
  Badge,
  BlockBar,
  EmptyState,
  Kpi,
  KpiGrid,
  NoData,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  Section,
  TrendGlyph,
  cx,
} from "@/components/primitives";
import { TaskLine } from "@/components/task/TaskLine";
import { DismissAlert } from "@/components/shell/DismissAlert";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const day = today();
  const c = await commandCenter(day);

  const scoreEntries = [
    { key: "BODY" as const, score: c.scores.body, href: "/body" },
    { key: "BUSINESS" as const, score: c.scores.business, href: "/business" },
    { key: "CHARACTER" as const, score: c.scores.character, href: "/character" },
    { key: "FINANCE" as const, score: c.scores.finance, href: "/finance" },
    { key: "LEARNING" as const, score: c.scores.learning, href: "/learning" },
  ];
  const trajectoryByPillar = new Map(c.trajectories.map((t) => [t.pillar, t]));

  return (
    <div className="space-y-10">
      {/* ---------------------------------------------------------- HEADER */}
      <header className="flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="label mb-3">{formatCommandDate(day)}</div>
          <h1 className="display text-ink">COMMAND</h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
            <div>
              <div className="label mb-1.5">Season</div>
              <div className="text-sm tracking-[0.08em] text-ink">
                {c.season?.name ?? <NoData />}
              </div>
            </div>
            <div>
              <div className="label mb-1.5">Streak</div>
              <div className="numeral text-sm text-ink">
                {c.streak > 0 ? `${c.streak} ${c.streak === 1 ? "day" : "days"}` : <NoData />}
              </div>
            </div>
            <div>
              <div className="label mb-1.5">Active goals</div>
              <div className="numeral text-sm text-ink">{c.activeGoals}</div>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-8">
          <div>
            <div className="label mb-2">Overall performance</div>
            <div className="flex items-baseline gap-3">
              <span className="numeral text-5xl font-medium leading-none text-ink">
                {c.scores.overall === null ? "—" : Math.round(c.scores.overall)}
              </span>
              <TrendGlyph trend={c.overallTrend.trend} className="text-2xl" />
            </div>
            <p className="mt-2 max-w-[16rem] text-[0.6875rem] leading-relaxed text-ink-faint">
              {c.overallTrend.detail}
            </p>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------- MISSION */}
      <Section
        title="90-Day Mission"
        action={
          <Link href="/missions" className="btn btn-ghost">
            All missions
          </Link>
        }
      >
        {c.mission && c.missionProgress ? (
          <Panel>
            <div className="grid gap-px bg-line lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="bg-panel p-5 sm:p-6">
                <Link href={`/missions/${c.mission.id}`} className="group block">
                  <h3 className="headline text-ink transition-colors group-hover:text-ink-dim">
                    {c.mission.title}
                  </h3>
                </Link>
                {c.mission.objective ? (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-dim">
                    {c.mission.objective}
                  </p>
                ) : null}

                <div className="mt-6 flex items-center gap-4">
                  <BlockBar value={c.missionProgress.progressPct} width={20} />
                  <span className="numeral text-sm text-ink">
                    {c.missionProgress.progressPct === null
                      ? "—"
                      : `${c.missionProgress.progressPct}%`}
                  </span>
                  <Badge
                    tone={
                      c.missionProgress.schedule === "AT_RISK"
                        ? "critical"
                        : c.missionProgress.schedule === "BEHIND"
                          ? "attention"
                          : c.missionProgress.schedule === "AHEAD"
                            ? "positive"
                            : "muted"
                    }
                  >
                    {c.missionProgress.schedule.replace("_", " ")}
                  </Badge>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-ink-faint">
                  {c.missionProgress.message}
                </p>
              </div>

              <div className="bg-panel p-5 sm:p-6">
                <KpiGrid cols={2}>
                  <Kpi
                    label="Days left"
                    value={c.missionProgress.daysRemaining}
                    detail={`of ${c.missionProgress.daysTotal}`}
                  />
                  <Kpi
                    label="Elapsed"
                    value={pct(c.missionProgress.elapsedPct)}
                    detail="of the window"
                  />
                  <Kpi
                    label="Milestones"
                    value={
                      c.missionProgress.milestonePct === null
                        ? "—"
                        : pct(c.missionProgress.milestonePct)
                    }
                  />
                  <Kpi
                    label="Linked tasks"
                    value={c.missionProgress.taskPct === null ? "—" : pct(c.missionProgress.taskPct)}
                  />
                </KpiGrid>
              </div>
            </div>
          </Panel>
        ) : (
          <EmptyState
            title="No active mission"
            description="One primary 90-day mission focuses everything else. Without it, COMMAND cannot tell you whether today's work mattered."
            action={
              <Link href="/missions" className="btn btn-primary">
                Set the mission
              </Link>
            }
          />
        )}
      </Section>

      {/* ----------------------------------------------------------- TODAY */}
      <Section
        title="Today"
        meta={
          c.bigThree.total > 0
            ? `${c.bigThree.complete} of ${c.bigThree.total} complete`
            : "Nothing scheduled"
        }
        action={
          <Link href="/today" className="btn btn-ghost">
            Open Today
          </Link>
        }
      >
        {c.bigThree.mustWin || c.bigThree.support.length > 0 ? (
          <div className="space-y-px">
            {c.bigThree.mustWin ? (
              <Panel className="border-l-2 border-l-ink">
                <PanelBody>
                  <div className="label mb-3">01 — Must win</div>
                  <TaskLine task={c.bigThree.mustWin} dominant />
                </PanelBody>
              </Panel>
            ) : (
              <EmptyState
                compact
                title="No must-win set"
                description="One task that, if it were the only thing you did today, would still make the day count."
                action={
                  <Link href="/today?quick=task" className="btn">
                    Set it
                  </Link>
                }
              />
            )}
            {c.bigThree.support.map((task, i) => (
              <Panel key={task.id}>
                <PanelBody>
                  <div className="label mb-3">{`0${i + 2} — Support`}</div>
                  <TaskLine task={task} />
                </PanelBody>
              </Panel>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Today is unplanned"
            description="Set a must-win and up to two support tasks. Anything beyond three is a wish list, not a plan."
            action={
              <Link href="/today?quick=task" className="btn btn-primary">
                Plan today
              </Link>
            }
          />
        )}
      </Section>

      {/* ---------------------------------------------------------- SCORES */}
      <Section title="Performance" meta="Derived from what you logged. Unlogged pillars score nothing.">
        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
          {scoreEntries.map(({ key, score, href }) => {
            const t = trajectoryByPillar.get(key);
            return (
              <Link
                key={key}
                href={href}
                className="group bg-panel p-4 transition-colors hover:bg-raised sm:p-5"
              >
                <div className="label">{PILLAR_NAME[key]}</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="numeral text-3xl font-medium leading-none text-ink">
                    {score === null ? "—" : Math.round(score)}
                  </span>
                  <TrendGlyph trend={t?.trend ?? null} className="text-lg" />
                </div>
                <div className="mt-2.5 text-[0.6875rem] leading-relaxed text-ink-faint">
                  {score === null ? "Nothing logged today." : (t?.detail ?? "")}
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* --------------------------------------------------- OPERATIONS ROW */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Training */}
        <Panel>
          <PanelHeader
            title="Training"
            action={
              <Link href="/body/training" className="btn btn-ghost">
                Open
              </Link>
            }
          />
          <PanelBody className="space-y-5">
            {c.training.sessions.length === 0 ? (
              <EmptyState
                compact
                title="Nothing scheduled today"
                description="Schedule a session from the library and COMMAND will bring the targets with it."
                action={
                  <Link href="/body/training?quick=schedule" className="btn">
                    Schedule
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {c.training.sessions.map((s) => (
                  <Link
                    key={s.id}
                    href={`/body/training/${s.id}`}
                    className="flex items-center justify-between gap-4 border-b border-line-soft pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">{s.name}</div>
                      <div className="label mt-1.5">{s.type}</div>
                    </div>
                    <Badge tone={s.status === "COMPLETED" ? "positive" : "muted"}>{s.status}</Badge>
                  </Link>
                ))}
              </div>
            )}

            {c.training.nextTarget ? (
              <div className="panel-sunken p-4">
                <div className="label mb-2.5">Next target</div>
                <div className="text-sm text-ink">{c.training.nextTarget.exerciseName}</div>
                <div className="numeral mt-1.5 text-2xl font-medium text-ink">
                  {c.training.nextTarget.target}
                </div>
                {c.training.nextTarget.last ? (
                  <div className="mt-3">
                    <div className="label mb-1">Last session</div>
                    <div className="numeral text-xs text-ink-dim">{c.training.nextTarget.last}</div>
                  </div>
                ) : null}
                <p className="mt-3 text-[0.6875rem] leading-relaxed text-ink-faint">
                  {c.training.nextTarget.rationale}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <Kpi
                label="Readiness"
                value={c.training.readiness.level ?? "—"}
                detail={c.training.readiness.index === null ? "Log sleep and energy" : `${c.training.readiness.index}/100`}
                tone={
                  c.training.readiness.level === "LOW"
                    ? "attention"
                    : c.training.readiness.level === "HIGH"
                      ? "positive"
                      : "default"
                }
              />
              <Kpi label="Workload" value="" detail={c.training.loadStatus} />
            </div>
          </PanelBody>
        </Panel>

        {/* Nutrition + money */}
        <div className="space-y-6">
          <Panel>
            <PanelHeader
              title="Nutrition"
              action={
                <Link href="/body/nutrition" className="btn btn-ghost">
                  Open
                </Link>
              }
            />
            <PanelBody className="space-y-5">
              {c.nutrition.target ? (
                <>
                  <div>
                    <ProgressBar
                      value={c.nutrition.proteinPct}
                      label="Protein"
                      right={`${Math.round(c.nutrition.log?.protein_g ?? 0)} / ${c.nutrition.target.protein_g}g`}
                    />
                  </div>
                  <div>
                    <ProgressBar
                      value={c.nutrition.caloriePct}
                      label="Calories"
                      right={`${num(c.nutrition.log?.calories ?? 0)} / ${num(c.nutrition.target.calories)}`}
                    />
                  </div>
                  {c.nutrition.remaining ? (
                    <p className="text-xs text-ink-faint">
                      {c.nutrition.remaining.protein_g > 0
                        ? `${Math.round(c.nutrition.remaining.protein_g)}g protein and ${num(Math.max(0, c.nutrition.remaining.calories))} kcal remaining.`
                        : "Targets met for the day."}
                    </p>
                  ) : null}
                </>
              ) : (
                <EmptyState
                  compact
                  title="No nutrition target"
                  description="Set calories and protein so intake can be measured against something."
                  action={
                    <Link href="/body/nutrition" className="btn">
                      Set targets
                    </Link>
                  }
                />
              )}
            </PanelBody>
          </Panel>

          <div className="grid gap-px bg-line sm:grid-cols-2">
            <Link href="/business" className="bg-panel p-4 transition-colors hover:bg-raised sm:p-5">
              <div className="label">Business</div>
              <div className="numeral mt-3 text-2xl font-medium leading-none text-ink">
                {c.business.mrrCents > 0 ? moneyCompact(c.business.mrrCents) : "—"}
              </div>
              <div className="mt-2 text-[0.6875rem] text-ink-faint">
                MRR
                {c.business.mrrTargetCents
                  ? ` · target ${moneyCompact(c.business.mrrTargetCents)}`
                  : ""}
              </div>
              <div className="mt-3 text-[0.6875rem] text-ink-faint">
                {c.business.openLeads} open {c.business.openLeads === 1 ? "lead" : "leads"} ·{" "}
                {money(c.business.revenueThisMonthCents)} this month
              </div>
            </Link>
            <Link href="/finance" className="bg-panel p-4 transition-colors hover:bg-raised sm:p-5">
              <div className="label">Finance</div>
              <div
                className={cx(
                  "numeral mt-3 text-2xl font-medium leading-none",
                  c.finance.netWorthCents < 0 ? "text-critical" : "text-ink",
                )}
              >
                {moneyCompact(c.finance.netWorthCents)}
              </div>
              <div className="mt-2 text-[0.6875rem] text-ink-faint">Net worth</div>
              <div
                className={cx(
                  "mt-3 text-[0.6875rem]",
                  c.finance.shortfall ? "text-critical" : "text-ink-faint",
                )}
              >
                {c.finance.shortfall
                  ? `Shortfall projected ${c.finance.shortfall.date}`
                  : `${money(c.finance.cashCents)} cash · 30-day forecast clear`}
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- TRAJECTORY */}
      <Section title="Trajectory" meta="Direction across the last 28 days of scored data.">
        <Panel>
          <PanelBody className="space-y-4">
            {c.trajectories.map((t) => (
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
          </PanelBody>
        </Panel>

        {c.balance.spread !== null ? (
          <p className="text-xs leading-relaxed text-ink-faint">
            {c.balance.spread} point spread between the strongest and weakest pillar.{" "}
            <Link href="/analytics" className="text-ink-dim underline decoration-line-strong underline-offset-2">
              Balance analysis
            </Link>
          </p>
        ) : null}
      </Section>

      {/* --------------------------------------------------------- ATTENTION */}
      <Section
        title="Attention"
        meta={
          c.alerts.length === 0
            ? "Nothing is asking for you right now."
            : `${c.alerts.length} ${c.alerts.length === 1 ? "item" : "items"}`
        }
      >
        {c.alerts.length === 0 ? (
          <EmptyState
            title="Clear"
            description="No overdue work, no projected shortfall, no unresolved promises. Keep executing."
          />
        ) : (
          <div className="grid gap-px sm:grid-cols-2">
            {c.alerts.slice(0, 8).map((a) => (
              <AlertCard
                key={a.id}
                severity={a.severity}
                title={a.title}
                body={a.body}
                href={a.href}
                action={<DismissAlert id={a.id} />}
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
