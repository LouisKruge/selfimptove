import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, relativeDays, today } from "@/lib/core/date";
import { money, pct } from "@/lib/core/format";
import { getMission, listGoals, listMissions, projectView } from "@/lib/services/core";
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
import { ProjectStatusButtons } from "@/components/business/BusinessForms";
import { RiskForm, RiskList } from "@/components/plan/MissionForms";
import { TaskLine } from "@/components/task/TaskLine";
import { TaskForm } from "@/components/task/TaskForm";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectView(id);
  if (!project) notFound();

  const day = today();
  const mission = project.mission_id ? getMission(project.mission_id) : undefined;
  const openTasks = project.tasks.filter(
    (t) => t.status !== "COMPLETE" && t.status !== "CANCELLED",
  );
  const doneTasks = project.tasks.filter((t) => t.status === "COMPLETE");

  const missions = listMissions()
    .filter((m) => m.status === "ACTIVE")
    .map((m) => ({ value: m.id, label: m.title }));
  const goals = listGoals({ status: "ACTIVE" }).map((g) => ({ value: g.id, label: g.title }));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={mission ? `Mission · ${mission.title}` : "Project"}
        title={project.title}
        description={project.objective ?? undefined}
        actions={
          <Link href="/business/projects" className="btn btn-ghost">
            Projects
          </Link>
        }
      />

      <Panel>
        <PanelBody className="space-y-6">
          <ProjectStatusButtons projectId={project.id} status={project.status} />
          <ProgressBar
            value={project.progress}
            label="Task completion"
            right={
              project.progress === null
                ? "no tasks linked"
                : `${project.tasksComplete}/${project.tasksTotal} · ${pct(project.progress)}`
            }
            height="lg"
          />
          <div className="hairline pt-5">
            <KpiGrid cols={4}>
              <Kpi
                label="Deadline"
                value={project.deadline ? formatDay(project.deadline) : "—"}
                detail={project.deadline ? relativeDays(project.deadline, day) : undefined}
              />
              <Kpi label="Revenue impact" value={project.revenue_impact ? money(project.revenue_impact) : "—"} />
              <Kpi label="Cost" value={project.cost ? money(project.cost) : "—"} />
              <Kpi label="Blockers" value={project.blockers.length || "—"} tone={project.blockers.length ? "critical" : "default"} />
            </KpiGrid>
          </div>
        </PanelBody>
      </Panel>

      {project.next_action ? (
        <Panel>
          <PanelHeader title="Next action" />
          <PanelBody>
            <p className="text-lg leading-relaxed text-ink">{project.next_action}</p>
          </PanelBody>
        </Panel>
      ) : null}

      {project.expected_outcome ? (
        <Panel>
          <PanelHeader title="Expected outcome" />
          <PanelBody>
            <p className="text-sm leading-relaxed text-ink-dim">{project.expected_outcome}</p>
          </PanelBody>
        </Panel>
      ) : null}

      <Section title="Tasks" meta={`${openTasks.length} open · ${doneTasks.length} complete`}>
        <Panel>
          <PanelBody className="space-y-5">
            {openTasks.length === 0 ? (
              <p className="text-xs text-ink-faint">No open tasks.</p>
            ) : (
              openTasks.map((t) => <TaskLine key={t.id} task={t} showDate />)
            )}
            <div className="hairline pt-5">
              <Disclosure label="Add a task">
                <TaskForm
                  date={day}
                  projects={[{ value: project.id, label: project.title }]}
                  missions={missions}
                  goals={goals}
                />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Risks & blockers">
        <Panel>
          <PanelBody className="space-y-6">
            <RiskList risks={project.risks} />
            <div className="hairline pt-5">
              <Disclosure label="Record a risk">
                <RiskForm projectId={project.id} missionId={project.mission_id ?? undefined} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>
    </div>
  );
}
