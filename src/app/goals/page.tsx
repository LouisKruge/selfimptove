import Link from "next/link";
import { formatDay, relativeDays, today } from "@/lib/core/date";
import { money, num, pct } from "@/lib/core/format";
import { getUser, goalTree, listGoals, type GoalNode } from "@/lib/services/core";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  Section,
  cx,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { GoalForm } from "@/components/plan/GoalForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Goals" };

const HORIZON_LABEL: Record<string, string> = {
  VISION: "Life vision",
  THREE_YEAR: "3 year",
  ONE_YEAR: "1 year",
  QUARTER: "90 day",
  MONTH: "Month",
  WEEK: "Week",
};

export default async function GoalsPage() {
  const user = await getUser();
  const tree = await goalTree("ACTIVE");
  const all = await listGoals({ status: "ACTIVE" });
  const parents = all.map((g) => ({
    value: g.id,
    label: `${HORIZON_LABEL[g.horizon]} · ${g.title}`,
  }));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Command"
        title="Goals"
        description="Life vision at the top, this week at the bottom. Everything below inherits its reason for existing from the level above it."
      />

      {user?.life_vision ? (
        <Panel>
          <PanelHeader title="Life vision" />
          <PanelBody>
            <p className="max-w-3xl text-lg leading-relaxed text-ink">{user.life_vision}</p>
          </PanelBody>
        </Panel>
      ) : null}

      <Section title="Hierarchy" meta={`${all.length} active goals`}>
        {tree.length === 0 ? (
          <EmptyState
            title="No goals yet"
            description="Start at the top: what does the life look like? Then work down to what this quarter has to produce."
          />
        ) : (
          <div className="space-y-px">
            {tree.map((node) => (
              <GoalBranch key={node.goal.id} node={node} depth={0} />
            ))}
          </div>
        )}
      </Section>

      <Section title="New goal">
        <Disclosure label="Add a goal" defaultOpen={all.length === 0}>
          <GoalForm parents={parents} />
        </Disclosure>
      </Section>
    </div>
  );
}

function GoalBranch({ node, depth }: { node: GoalNode; depth: number }) {
  const g = node.goal;
  const gap =
    g.target_value !== null && g.current_value !== null
      ? g.direction === "UP"
        ? Math.max(0, g.target_value - g.current_value)
        : Math.max(0, g.current_value - g.target_value)
      : null;

  const fmt = (v: number | null) => {
    if (v === null) return "—";
    if (g.unit === "ZAR") return money(v * 100);
    return `${num(v, Number.isInteger(v) ? 0 : 1)}${g.unit && g.unit !== "ZAR" ? ` ${g.unit}` : ""}`;
  };

  return (
    <>
      <div
        className={cx("panel transition-colors hover:border-line-strong")}
        style={{ marginLeft: depth * 20 }}
      >
        <PanelBody className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="label">{HORIZON_LABEL[g.horizon]}</span>
                <Badge tone="muted">{g.pillar}</Badge>
                {g.deadline ? (
                  <span className="text-[0.6875rem] text-ink-faint">
                    {formatDay(g.deadline)} · {relativeDays(g.deadline, today())}
                  </span>
                ) : null}
              </div>
              <Link href={`/goals/${g.id}`} className="group block">
                <h3
                  className={cx(
                    "leading-snug text-ink transition-colors group-hover:text-ink-dim",
                    depth === 0 ? "text-lg" : "text-sm",
                  )}
                >
                  {g.title}
                </h3>
              </Link>
              {g.next_action ? (
                <p className="mt-2 text-xs text-ink-faint">
                  <span className="label mr-2">Next</span>
                  {g.next_action}
                </p>
              ) : null}
            </div>

            <div className="w-full lg:w-72 lg:flex-none">
              {g.target_value !== null ? (
                <>
                  <ProgressBar
                    value={node.progress}
                    label={g.kpi ?? "Progress"}
                    right={node.progress === null ? "no data" : pct(node.progress)}
                  />
                  <div className="mt-3 flex justify-between gap-3 text-[0.6875rem] text-ink-faint">
                    <span>
                      <span className="label mr-1.5">Now</span>
                      <span className="numeral text-ink-dim">{fmt(g.current_value)}</span>
                    </span>
                    <span>
                      <span className="label mr-1.5">Gap</span>
                      <span className="numeral text-ink-dim">{fmt(gap)}</span>
                    </span>
                    <span>
                      <span className="label mr-1.5">Target</span>
                      <span className="numeral text-ink-dim">{fmt(g.target_value)}</span>
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[0.6875rem] text-ink-ghost">
                  No target set — progress cannot be calculated.
                </p>
              )}
            </div>
          </div>
        </PanelBody>
      </div>

      {node.children.map((child) => (
        <GoalBranch key={child.goal.id} node={child} depth={depth + 1} />
      ))}
    </>
  );
}
