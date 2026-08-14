import Link from "next/link";
import { formatCommandDate, addDays, today } from "@/lib/core/date";
import { num } from "@/lib/core/format";
import {
  bigThree,
  dayLoad,
  flagTasks,
  listGoals,
  listMissions,
  listProjects,
  openTasks,
  primaryMission,
  computeMissionProgress,
  activeSeason,
} from "@/lib/services/core";
import { bodyDashboard } from "@/lib/services/body";
import { characterDashboard, habitDoneSet, listHabits, promisesFor } from "@/lib/services/character";
import { nextSalesActions } from "@/lib/services/business";
import { storedScore, currentStreak } from "@/lib/services/scores";
import {
  AlertCard,
  Badge,
  BlockBar,
  EmptyState,
  Kpi,
  KpiGrid,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  Section,
  cx,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { TaskLine } from "@/components/task/TaskLine";
import { TaskForm } from "@/components/task/TaskForm";
import { HabitChecklist } from "@/components/character/HabitChecklist";
import { PromiseList } from "@/components/character/PromiseList";
import { PromiseForm } from "@/components/character/PromiseForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today" };

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string; date?: string }>;
}) {
  const params = await searchParams;
  const day = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today();

  const season = await activeSeason(day);
  const mission = await primaryMission();
  const progress = mission ? await computeMissionProgress(mission, day) : null;
  const big3 = await bigThree(day);
  const load = await dayLoad(day);
  const score = await storedScore(day);
  const streak = await currentStreak(60, day);
  const body = await bodyDashboard(day);
  const character = await characterDashboard(day);
  const habits = await listHabits();
  const doneHabits = [...await habitDoneSet(day)];
  const promises = await promisesFor(day);
  const salesAction = (await nextSalesActions(1, day))[0] ?? null;
  const flagged = flagTasks(await openTasks(), day);

  const consistency = Object.fromEntries(
    character.habits.map((h) => [h.habitId, h.consistency30]),
  );

  const projects = (await listProjects({ status: "ACTIVE" })).map((p) => ({ value: p.id, label: p.title }));
  const missions = (await listMissions())
    .filter((m) => m.status === "ACTIVE")
    .map((m) => ({ value: m.id, label: m.title }));
  const goals = (await listGoals({ status: "ACTIVE" })).map((g) => ({ value: g.id, label: g.title }));

  const overdue = flagged.filter((f) => f.flags.includes("OVERDUE"));

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="label mb-3">{formatCommandDate(day)}</div>
          <h1 className="display text-ink">TODAY</h1>
          {mission && progress ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={`/missions/${mission.id}`}
                className="text-sm tracking-[0.06em] text-ink-dim transition-colors hover:text-ink"
              >
                {mission.title}
              </Link>
              <BlockBar value={progress.progressPct} width={12} />
              <span className="numeral text-xs text-ink-faint">
                {progress.progressPct === null ? "—" : `${progress.progressPct}%`}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex items-end gap-10">
          <div>
            <div className="label mb-2">Daily score</div>
            <div className="numeral text-4xl font-medium leading-none text-ink">
              {score?.overall === null || score === undefined ? "—" : Math.round(score.overall)}
            </div>
          </div>
          <div>
            <div className="label mb-2">Streak</div>
            <div className="numeral text-4xl font-medium leading-none text-ink">
              {streak || "—"}
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="label mb-2">Season</div>
            <div className="text-sm tracking-[0.08em] text-ink-dim">{season?.name ?? "—"}</div>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------- BIG 3 */}
      <Section
        title="The Big 3"
        meta="One must-win. Two support. Everything else waits."
        action={
          <div className="flex items-center gap-2">
            <Link href={`/today?date=${addDays(day, -1)}`} className="btn btn-ghost">
              ←
            </Link>
            <Link href={`/today?date=${addDays(day, 1)}`} className="btn btn-ghost">
              →
            </Link>
          </div>
        }
      >
        <div className="space-y-px">
          {big3.mustWin ? (
            <Panel className="border-l-2 border-l-ink">
              <PanelBody>
                <div className="label mb-3">01 — Must win</div>
                <TaskLine task={big3.mustWin} dominant />
              </PanelBody>
            </Panel>
          ) : (
            <EmptyState
              title="No must-win"
              description="Name the one thing that makes today count even if nothing else happens."
            />
          )}

          {big3.support.map((task, i) => (
            <Panel key={task.id}>
              <PanelBody>
                <div className="label mb-3">{`0${i + 2} — Support`}</div>
                <TaskLine task={task} />
              </PanelBody>
            </Panel>
          ))}

          {big3.support.length < 2 ? (
            <div className="border border-dashed border-line px-4 py-5">
              <div className="label">{`0${big3.support.length + 2} — Support`}</div>
              <p className="mt-2 text-xs text-ink-ghost">Open.</p>
            </div>
          ) : null}
        </div>

        {load.overloaded ? (
          <AlertCard
            severity="ATTENTION"
            title="Today is carrying too much"
            body={`${load.count} open tasks estimated at ${Math.round(load.minutes / 60)} hours. Cut, delegate or reschedule until it fits the day you actually have.`}
          />
        ) : null}
      </Section>

      {/* ------------------------------------------------------ OTHER WORK */}
      {big3.other.length > 0 ? (
        <Section title="Also scheduled" meta={`${big3.other.length} beyond the Big 3`}>
          <Panel>
            <PanelBody className="space-y-4">
              {big3.other.map((task) => (
                <TaskLine key={task.id} task={task} />
              ))}
            </PanelBody>
          </Panel>
        </Section>
      ) : null}

      {overdue.length > 0 ? (
        <Section title="Overdue" meta="Carried from earlier days">
          <Panel>
            <PanelBody className="space-y-4">
              {overdue.slice(0, 8).map(({ task }) => (
                <TaskLine key={task.id} task={task} showDate />
              ))}
            </PanelBody>
          </Panel>
        </Section>
      ) : null}

      <Section title="Add work">
        <Disclosure label="Add a task" defaultOpen={params.quick === "task"}>
          <TaskForm
            date={day}
            projects={projects}
            missions={missions}
            goals={goals}
            defaultPriority={big3.mustWin ? "SUPPORT" : "MUST_WIN"}
          />
        </Disclosure>
      </Section>

      {/* -------------------------------------------------------- THE DAY */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <PanelHeader
            title="Training"
            action={
              <Link href="/body/training" className="btn btn-ghost">
                Open
              </Link>
            }
          />
          <PanelBody className="space-y-4">
            {body.todaySessions.length === 0 ? (
              <p className="text-xs text-ink-faint">Nothing scheduled.</p>
            ) : (
              body.todaySessions.map((s) => (
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
            <div className="hairline pt-4">
              <Kpi
                label="Readiness"
                value={body.readiness.level ?? "—"}
                detail={body.readiness.message}
              />
            </div>
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
          <PanelBody className="space-y-5">
            {body.nutrition.target ? (
              <>
                <ProgressBar
                  value={body.nutrition.proteinPct}
                  label="Protein"
                  right={`${Math.round(body.nutrition.log?.protein_g ?? 0)} / ${body.nutrition.target.protein_g}g`}
                />
                <ProgressBar
                  value={body.nutrition.caloriePct}
                  label="Calories"
                  right={`${num(body.nutrition.log?.calories ?? 0)} / ${num(body.nutrition.target.calories)}`}
                />
                <div className="hairline pt-4 text-xs text-ink-faint">
                  {body.nutrition.meals.length} {body.nutrition.meals.length === 1 ? "meal" : "meals"} logged.
                </div>
              </>
            ) : (
              <p className="text-xs text-ink-faint">No nutrition target set.</p>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Business priority"
            action={
              <Link href="/business/sales" className="btn btn-ghost">
                Open
              </Link>
            }
          />
          <PanelBody className="space-y-4">
            {salesAction ? (
              <>
                <Link href={`/business/sales/${salesAction.id}`} className="block">
                  <div className="text-sm text-ink">{salesAction.company}</div>
                  <div className="label mt-1.5">{salesAction.stage}</div>
                </Link>
                <p className="text-xs leading-relaxed text-ink-dim">
                  {salesAction.next_action ?? "No next action set."}
                </p>
                <p className="text-[0.6875rem] text-ink-faint">{salesAction.reason}</p>
              </>
            ) : (
              <p className="text-xs text-ink-faint">
                No open leads. Revenue cannot arrive from an empty pipeline.
              </p>
            )}
          </PanelBody>
        </Panel>
      </div>

      {/* -------------------------------------------------------- CHARACTER */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Habits"
            meta={`${doneHabits.length} of ${habits.length} done today`}
            action={
              <Link href="/character/habits" className="btn btn-ghost">
                Open
              </Link>
            }
          />
          <PanelBody>
            <HabitChecklist
              habits={habits}
              done={doneHabits}
              date={day}
              consistency={consistency}
            />
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Promises"
            meta={
              character.promises30.rate === null
                ? "No resolved promises in 30 days"
                : `${character.promises30.rate}% kept over 30 days`
            }
          />
          <PanelBody className="space-y-5">
            <PromiseList promises={promises} allowDelete />
            <div className="hairline pt-4">
              <PromiseForm date={day} />
            </div>
          </PanelBody>
        </Panel>
      </div>

      <Section title="Day at a glance">
        <Panel>
          <PanelBody>
            <KpiGrid cols={5}>
              <Kpi
                label="Tasks"
                value={`${big3.complete}/${big3.total}`}
                detail="scheduled today"
              />
              <Kpi
                label="Estimated load"
                value={load.minutes > 0 ? `${Math.round(load.minutes / 60)}h` : "—"}
                detail={`${load.count} open`}
                tone={load.overloaded ? "attention" : "default"}
              />
              <Kpi
                label="Body"
                value={score?.body === null || !score ? "—" : Math.round(score.body)}
              />
              <Kpi
                label="Business"
                value={score?.business === null || !score ? "—" : Math.round(score.business)}
              />
              <Kpi
                label="Character"
                value={score?.character === null || !score ? "—" : Math.round(score.character)}
              />
            </KpiGrid>
          </PanelBody>
        </Panel>
      </Section>
    </div>
  );
}
