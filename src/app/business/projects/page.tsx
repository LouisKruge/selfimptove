import Link from "next/link";
import { formatDayShort, relativeDays, today } from "@/lib/core/date";
import { money, pct } from "@/lib/core/format";
import { listGoals, listMissions, listProjects, projectProgress } from "@/lib/services/core";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  ProgressBar,
  Section,
  cx,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { ProjectForm } from "@/components/business/BusinessForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Projects" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const projects = listProjects();
  const missions = listMissions()
    .filter((m) => m.status === "ACTIVE")
    .map((m) => ({ value: m.id, label: m.title }));
  const goals = listGoals({ status: "ACTIVE" }).map((g) => ({ value: g.id, label: g.title }));

  const open = projects.filter((p) => p.status !== "COMPLETE" && p.status !== "CANCELLED");
  const closed = projects.filter((p) => p.status === "COMPLETE" || p.status === "CANCELLED");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Business"
        title="Projects"
        description="Every project states its objective, its expected outcome, its revenue impact and the single next action."
      />

      <Section title="Active" meta={`${open.length} open`}>
        {open.length === 0 ? (
          <EmptyState
            title="No active projects"
            description="A mission is delivered through projects. Without them there is nothing to schedule."
          />
        ) : (
          <div className="space-y-px">
            {open.map((p) => {
              const progress = projectProgress(p.id);
              return (
                <Panel key={p.id} className={cx(p.status === "BLOCKED" && "border-l-2 border-l-critical")}>
                  <PanelBody>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge tone={p.status === "BLOCKED" ? "critical" : "muted"}>{p.status}</Badge>
                          <Badge tone="muted">{p.pillar}</Badge>
                          {!p.mission_id ? <Badge tone="muted">Not linked to a mission</Badge> : null}
                        </div>
                        <Link href={`/business/projects/${p.id}`} className="group block">
                          <h3 className="text-base font-medium text-ink transition-colors group-hover:text-ink-dim">
                            {p.title}
                          </h3>
                        </Link>
                        {p.objective ? (
                          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">
                            {p.objective}
                          </p>
                        ) : null}
                        {p.next_action ? (
                          <p className="mt-2.5 text-xs text-ink-faint">
                            <span className="label mr-2">Next</span>
                            {p.next_action}
                          </p>
                        ) : null}
                      </div>

                      <div className="w-full lg:w-64 lg:flex-none">
                        <ProgressBar
                          value={progress}
                          label="Task completion"
                          right={progress === null ? "no tasks" : pct(progress)}
                        />
                        <div className="mt-3 space-y-1.5 text-[0.6875rem] text-ink-faint">
                          {p.deadline ? (
                            <div>
                              Due {formatDayShort(p.deadline)} · {relativeDays(p.deadline, day)}
                            </div>
                          ) : null}
                          {p.revenue_impact ? (
                            <div>Revenue impact {money(p.revenue_impact)}</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </PanelBody>
                </Panel>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="New project">
        <Disclosure label="Create a project" defaultOpen={params.quick === "project" || open.length === 0}>
          <ProjectForm missions={missions} goals={goals} />
        </Disclosure>
      </Section>

      {closed.length > 0 ? (
        <Section title="Closed" meta={`${closed.length}`}>
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {closed.map((p) => (
              <Link key={p.id} href={`/business/projects/${p.id}`} className="panel p-4 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-ink-faint">{p.title}</span>
                  <Badge tone="muted">{p.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
