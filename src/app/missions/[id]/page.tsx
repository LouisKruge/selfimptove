import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, today } from "@/lib/core/date";
import { money, pct } from "@/lib/core/format";
import {
  computeMissionProgress,
  getMission,
  missionKpis,
  missionMilestones,
  missionProjects,
  missionRisks,
  missionTasks,
} from "@/lib/services/core";
import {
  Badge,
  BlockBar,
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
import {
  KpiForm,
  KpiList,
  MilestoneForm,
  MilestoneList,
  RiskForm,
  RiskList,
} from "@/components/plan/MissionForms";
import { TaskLine } from "@/components/task/TaskLine";

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mission = await getMission(id);
  if (!mission) notFound();

  const day = today();
  const progress = await computeMissionProgress(mission, day);
  const milestones = await missionMilestones(mission.id);
  const kpis = await missionKpis(mission.id);
  const risks = await missionRisks(mission.id);
  const projects = await missionProjects(mission.id);
  const tasks = await missionTasks(mission.id);
  const openTasks = tasks.filter((t) => t.status !== "COMPLETE" && t.status !== "CANCELLED");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`${mission.kind} · ${mission.status}`}
        title={mission.title}
        description={mission.objective ?? undefined}
        actions={
          <Link href="/missions" className="btn btn-ghost">
            All missions
          </Link>
        }
      />

      {/* -------------------------------------------------------- PROGRESS */}
      <Panel>
        <PanelBody className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <BlockBar value={progress.progressPct} width={24} />
            <span className="numeral text-2xl font-medium text-ink">
              {progress.progressPct === null ? "—" : `${progress.progressPct}%`}
            </span>
            <Badge
              tone={
                progress.schedule === "AT_RISK"
                  ? "critical"
                  : progress.schedule === "BEHIND"
                    ? "attention"
                    : progress.schedule === "AHEAD"
                      ? "positive"
                      : "muted"
              }
            >
              {progress.schedule.replace("_", " ")}
            </Badge>
          </div>

          <ProgressBar
            value={progress.progressPct}
            label="Progress against elapsed time"
            right={`${progress.elapsedPct}% elapsed`}
            height="lg"
            showTicks={progress.elapsedPct}
          />

          <p className="text-sm leading-relaxed text-ink-dim">{progress.message}</p>

          <div className="hairline pt-5">
            <KpiGrid cols={4}>
              <Kpi label="Start" value={formatDay(mission.start_date)} />
              <Kpi label="End" value={formatDay(mission.end_date)} />
              <Kpi label="Days remaining" value={progress.daysRemaining} detail={`of ${progress.daysTotal}`} />
              <Kpi
                label="Target"
                value={
                  mission.target_value === null
                    ? "—"
                    : mission.unit?.includes("ZAR")
                      ? money(mission.target_value * 100)
                      : mission.target_value
                }
                detail={mission.unit ?? undefined}
              />
            </KpiGrid>
          </div>

          <div className="hairline grid gap-4 pt-5 sm:grid-cols-3">
            {progress.components.map((c) => (
              <div key={c.label}>
                <ProgressBar
                  value={c.value}
                  label={`${c.label} · ${c.weight}%`}
                  right={c.value === null ? "no data" : pct(c.value)}
                />
                <p className="mt-2 text-[0.6875rem] text-ink-faint">{c.detail}</p>
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>

      {mission.why ? (
        <Panel>
          <PanelHeader title="Why" />
          <PanelBody>
            <p className="max-w-3xl text-sm leading-relaxed text-ink-dim">{mission.why}</p>
          </PanelBody>
        </Panel>
      ) : null}

      {/* ------------------------------------------------------ MILESTONES */}
      <Section
        title="Milestones"
        meta={`${milestones.filter((m) => m.status === "COMPLETE").length} of ${milestones.length} complete`}
      >
        <Panel>
          <PanelBody className="space-y-6">
            <MilestoneList milestones={milestones} />
            <div className="hairline pt-5">
              <Disclosure label="Add milestone">
                <MilestoneForm missionId={mission.id} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      {/* ------------------------------------------------------------ KPIs */}
      <Section title="KPIs" meta="Measured outcomes, not activity counts.">
        <Panel>
          <PanelBody className="space-y-6">
            <KpiList kpis={kpis} />
            <div className="hairline pt-5">
              <Disclosure label="Add KPI">
                <KpiForm missionId={mission.id} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      {/* --------------------------------------------------------- PROJECTS */}
      <Section title="Projects" meta={`${projects.length} linked`}>
        {projects.length === 0 ? (
          <EmptyState
            compact
            title="No projects linked"
            description="Link the projects that actually move this mission so progress can be derived."
            action={
              <Link href="/business/projects" className="btn">
                Projects
              </Link>
            }
          />
        ) : (
          <div className="grid gap-px sm:grid-cols-2">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/business/projects/${p.id}`}
                className="panel p-4 transition-colors hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-ink">{p.title}</span>
                  <Badge
                    tone={p.status === "BLOCKED" ? "critical" : p.status === "COMPLETE" ? "positive" : "muted"}
                  >
                    {p.status}
                  </Badge>
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

      {/* ------------------------------------------------------------ TASKS */}
      <Section title="Open tasks" meta={`${openTasks.length} open of ${tasks.length} linked`}>
        {openTasks.length === 0 ? (
          <EmptyState compact title="Nothing open" description="No outstanding tasks linked to this mission." />
        ) : (
          <Panel>
            <PanelBody className="space-y-4">
              {openTasks.slice(0, 12).map((t) => (
                <TaskLine key={t.id} task={t} showDate />
              ))}
            </PanelBody>
          </Panel>
        )}
      </Section>

      {/* ------------------------------------------------------------ RISKS */}
      <Section title="Risks & blockers" meta={`${risks.filter((r) => r.status === "OPEN").length} open`}>
        <Panel>
          <PanelBody className="space-y-6">
            <RiskList risks={risks} />
            <div className="hairline pt-5">
              <Disclosure label="Record a risk">
                <RiskForm missionId={mission.id} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>
    </div>
  );
}
