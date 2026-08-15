import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, formatDayShort, relativeDays, today } from "@/lib/core/date";
import { taskDetail, taskNeighbours } from "@/lib/services/tasks";
import { listAttachments } from "@/lib/services/attachments";
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
  Section,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import {
  BlockForm,
  DeleteNoteButton,
  LogWorkForm,
  PlanForm,
  ResultForm,
  StatusButtons,
} from "@/components/task/TaskRecord";
import { DocumentList, UploadDocument } from "@/components/task/Documents";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  COMPLETE: "positive",
  BLOCKED: "critical",
  IN_PROGRESS: "attention",
  CANCELLED: "muted",
  TODO: "muted",
} as const;

function minutes(m: number | null): string {
  if (m === null) return "—";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await taskDetail(id);
  return { title: detail?.task.title ?? "Task" };
}

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await taskDetail(id);
  if (!detail) notFound();

  const { task, project, mission, goal, log, varianceMinutes } = detail;
  const { previous, next } = await taskNeighbours(task);
  const documents = await listAttachments("task", task.id);
  const day = today();
  const done = task.status === "COMPLETE";

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={task.description ?? task.pillar}
        title={task.title}
        description={task.expected_outcome ?? undefined}
        actions={
          <>
            <Badge tone={STATUS_TONE[task.status]}>{task.status.replace("_", " ")}</Badge>
            <Badge tone={task.priority === "MUST_WIN" ? "attention" : "muted"}>
              {task.priority.replace("_", " ")}
            </Badge>
          </>
        }
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={4}>
            <Kpi
              label="Scheduled"
              value={task.scheduled_date ? formatDayShort(task.scheduled_date) : "—"}
              detail={task.scheduled_date ? relativeDays(task.scheduled_date, day) : "not scheduled"}
            />
            <Kpi
              label="Deadline"
              value={task.deadline ? formatDayShort(task.deadline) : "—"}
              detail={task.deadline ? relativeDays(task.deadline, day) : "none set"}
            />
            <Kpi label="Estimate" value={minutes(task.estimated_minutes)} />
            <Kpi
              label="Actual"
              value={minutes(task.actual_minutes)}
              detail={
                varianceMinutes === null
                  ? "not recorded"
                  : varianceMinutes === 0
                    ? "exactly as estimated"
                    : `${varianceMinutes > 0 ? "+" : "−"}${minutes(Math.abs(varianceMinutes))} against estimate`
              }
              tone={varianceMinutes !== null && varianceMinutes > 0 ? "attention" : "default"}
            />
          </KpiGrid>
        </PanelBody>
      </Panel>

      {/* ------------------------------------------------------------ record */}

      <Section
        title="What actually happened"
        meta="The record. Planned outcome above, real outcome here."
      >
        <Panel>
          <PanelBody className="space-y-6">
            <ResultForm task={task} />
            <div className="hairline space-y-4 pt-5">
              <StatusButtons task={task} />
              <BlockForm task={task} />
            </div>
            {done && task.completed_at ? (
              <p className="hairline pt-5 text-xs text-ink-faint">
                Completed {formatDay(task.completed_at.slice(0, 10))}.
              </p>
            ) : null}
          </PanelBody>
        </Panel>
      </Section>

      {/* -------------------------------------------------------- documents */}

      <Section
        title="Documents"
        meta={`${documents.length} ${documents.length === 1 ? "file" : "files"}`}
      >
        <Panel>
          <PanelBody className="space-y-6">
            <UploadDocument entityType="task" entityId={task.id} />
            <div className="hairline pt-5">
              <DocumentList documents={documents} entityType="task" entityId={task.id} />
            </div>
          </PanelBody>
        </Panel>
      </Section>

      {/* --------------------------------------------------------- work log */}

      <Section title="Work log" meta={`${log.length} ${log.length === 1 ? "entry" : "entries"}`}>
        <Panel>
          <PanelBody className="space-y-6">
            <LogWorkForm taskId={task.id} />

            <div className="hairline pt-5">
              {log.length === 0 ? (
                <p className="text-xs text-ink-faint">
                  Nothing logged yet. Findings recorded here stay attached to this task.
                </p>
              ) : (
                <div className="space-y-px">
                  {log.map((note) => (
                    <div key={note.id} className="border-l border-line py-3 pl-4">
                      <div className="flex items-baseline justify-between gap-4">
                        <div className="min-w-0">
                          {note.title ? (
                            <p className="text-sm text-ink">{note.title}</p>
                          ) : null}
                          <p className="numeral text-[0.6875rem] text-ink-ghost">
                            {formatDay(note.created_at.slice(0, 10))}
                          </p>
                        </div>
                        <DeleteNoteButton noteId={note.id} taskId={task.id} />
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">
                        {note.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PanelBody>
        </Panel>
      </Section>

      {/* ------------------------------------------------------------- plan */}

      <Section title="The plan" meta="What this task is for, and when it is meant to happen.">
        <Panel>
          <PanelBody className="space-y-6">
            <div>
              <DataRow label="Pillar" value={task.pillar} />
              {task.description ? <DataRow label="Phase" value={task.description} /> : null}
              <DataRow
                label="Project"
                value={
                  project ? (
                    <Link href={`/business/projects/${project.id}`} className="link">
                      {project.title}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <DataRow
                label="Mission"
                value={
                  mission ? (
                    <Link href={`/missions/${mission.id}`} className="link">
                      {mission.title}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <DataRow
                label="Goal"
                value={
                  goal ? (
                    <Link href={`/goals/${goal.id}`} className="link">
                      {goal.title}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              {task.delegated_to ? (
                <DataRow label="Delegated to" value={task.delegated_to} />
              ) : null}
            </div>

            <div className="hairline pt-5">
              <Disclosure label="Edit the plan">
                <PlanForm task={task} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      {/* ---------------------------------------------------------- sequence */}

      {previous || next ? (
        <Section title="Sequence" meta={project?.title}>
          <div className="grid gap-px sm:grid-cols-2">
            {previous ? (
              <Panel>
                <PanelHeader title="Previous" />
                <PanelBody className="p-4">
                  <Link href={`/tasks/${previous.id}`} className="text-sm text-ink hover:text-ink-dim">
                    {previous.title}
                  </Link>
                </PanelBody>
              </Panel>
            ) : null}
            {next ? (
              <Panel>
                <PanelHeader title="Next" />
                <PanelBody className="p-4">
                  <Link href={`/tasks/${next.id}`} className="text-sm text-ink hover:text-ink-dim">
                    {next.title}
                  </Link>
                </PanelBody>
              </Panel>
            ) : null}
          </div>
        </Section>
      ) : (
        <EmptyState
          title="Not part of a sequence"
          description="This task is not linked to a project, so it has no neighbours."
        />
      )}
    </div>
  );
}
