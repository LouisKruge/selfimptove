import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, relativeDays, today } from "@/lib/core/date";
import { money, num, pct } from "@/lib/core/format";
import { goalView, listGoals } from "@/lib/services/core";
import {
  Badge,
  DataRow,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  Section,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { GoalEditForm, GoalValueForm } from "@/components/plan/GoalForms";
import { TaskLine } from "@/components/task/TaskLine";

export const dynamic = "force-dynamic";

const HORIZON_LABEL: Record<string, string> = {
  VISION: "Life vision",
  THREE_YEAR: "3 year",
  ONE_YEAR: "1 year",
  QUARTER: "90 day",
  MONTH: "Month",
  WEEK: "Week",
};

export default async function GoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const goal = goalView(id);
  if (!goal) notFound();

  const parents = listGoals({ status: "ACTIVE" }).map((g) => ({
    value: g.id,
    label: `${HORIZON_LABEL[g.horizon]} · ${g.title}`,
  }));

  const fmt = (v: number | null) => {
    if (v === null) return "—";
    if (goal.unit === "ZAR") return money(v * 100);
    return `${num(v, Number.isInteger(v) ? 0 : 1)}${goal.unit && goal.unit !== "ZAR" ? ` ${goal.unit}` : ""}`;
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`${HORIZON_LABEL[goal.horizon]} · ${goal.pillar}`}
        title={goal.title}
        description={goal.why ?? undefined}
        actions={
          <Link href="/goals" className="btn btn-ghost">
            All goals
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title="Measurement" meta={goal.kpi ?? "No KPI named"} />
          <PanelBody className="space-y-6">
            {goal.target_value !== null ? (
              <>
                <div className="flex flex-wrap items-end gap-8">
                  <div>
                    <div className="label mb-2">Current</div>
                    <div className="numeral text-4xl font-medium leading-none text-ink">
                      {fmt(goal.current_value)}
                    </div>
                  </div>
                  <div>
                    <div className="label mb-2">Target</div>
                    <div className="numeral text-4xl font-medium leading-none text-ink-dim">
                      {fmt(goal.target_value)}
                    </div>
                  </div>
                  <div>
                    <div className="label mb-2">Gap</div>
                    <div className="numeral text-4xl font-medium leading-none text-ink-dim">
                      {fmt(goal.gap)}
                    </div>
                  </div>
                </div>

                <ProgressBar
                  value={goal.progress}
                  label="Progress"
                  right={goal.progress === null ? "no data" : pct(goal.progress)}
                  height="lg"
                />
              </>
            ) : (
              <EmptyState
                compact
                title="No target set"
                description="A goal without a number is a wish. Add a target so progress can be calculated."
              />
            )}

            <div className="hairline pt-5">
              <GoalValueForm goalId={goal.id} current={goal.current_value} unit={goal.unit} />
            </div>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Detail" />
          <PanelBody>
            <DataRow label="Status" value={<Badge tone={goal.status === "ACTIVE" ? "default" : "muted"}>{goal.status}</Badge>} />
            <DataRow label="Horizon" value={HORIZON_LABEL[goal.horizon]} />
            <DataRow label="Pillar" value={goal.pillar} />
            <DataRow label="Direction" value={goal.direction === "UP" ? "Higher is better" : "Lower is better"} />
            <DataRow
              label="Deadline"
              value={
                goal.deadline ? `${formatDay(goal.deadline)} · ${relativeDays(goal.deadline, today())}` : "—"
              }
            />
            <DataRow label="Baseline" value={fmt(goal.start_value)} />
          </PanelBody>
        </Panel>
      </div>

      {goal.next_action ? (
        <Panel>
          <PanelHeader title="Next action" />
          <PanelBody>
            <p className="text-lg leading-relaxed text-ink">{goal.next_action}</p>
          </PanelBody>
        </Panel>
      ) : null}

      {goal.children.length > 0 ? (
        <Section title="Supporting goals" meta={`${goal.children.length} beneath this one`}>
          <div className="grid gap-px sm:grid-cols-2">
            {goal.children.map((c) => (
              <Link
                key={c.id}
                href={`/goals/${c.id}`}
                className="panel p-4 transition-colors hover:border-line-strong"
              >
                <div className="label mb-2">{HORIZON_LABEL[c.horizon]}</div>
                <div className="text-sm text-ink">{c.title}</div>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Linked work">
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Projects" meta={`${goal.linkedProjects.length} linked`} />
            <PanelBody>
              {goal.linkedProjects.length === 0 ? (
                <p className="text-xs text-ink-faint">No projects linked to this goal.</p>
              ) : (
                <ul className="space-y-3">
                  {goal.linkedProjects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <Link href={`/business/projects/${p.id}`} className="truncate text-sm text-ink">
                        {p.title}
                      </Link>
                      <Badge tone="muted">{p.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="Open tasks" meta={`${goal.linkedTasks.length} open`} />
            <PanelBody className="space-y-4">
              {goal.linkedTasks.length === 0 ? (
                <p className="text-xs text-ink-faint">No open tasks linked to this goal.</p>
              ) : (
                goal.linkedTasks.slice(0, 8).map((t) => <TaskLine key={t.id} task={t} showDate />)
              )}
            </PanelBody>
          </Panel>
        </div>
      </Section>

      <Section title="Edit">
        <Disclosure label="Edit goal">
          <GoalEditForm goal={goal} parents={parents} />
        </Disclosure>
      </Section>
    </div>
  );
}
