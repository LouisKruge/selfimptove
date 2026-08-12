import Link from "next/link";
import { addDays, formatDay, today } from "@/lib/core/date";
import {
  computeMissionProgress,
  listGoals,
  listMissions,
  primaryMission,
  unalignedProjects,
} from "@/lib/services/core";
import {
  AlertCard,
  Badge,
  BlockBar,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  Section,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { MissionForm, PromoteMissionButton } from "@/components/plan/MissionForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Missions" };

export default async function MissionsPage() {
  const day = today();
  const missions = listMissions();
  const primary = primaryMission();
  const goals = listGoals({ status: "ACTIVE" }).map((g) => ({ value: g.id, label: g.title }));
  const unaligned = unalignedProjects(primary?.id ?? null);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Command"
        title="Missions"
        description="One primary 90-day mission at a time. Everything else is secondary, a project, or an idea in the vault."
      />

      {primary ? null : (
        <AlertCard
          severity="ATTENTION"
          title="No active primary mission"
          body="Without one, COMMAND cannot tell you whether today's work moved anything."
        />
      )}

      {unaligned.length > 0 && primary ? (
        <AlertCard
          severity="INFO"
          title={`${unaligned.length} active ${unaligned.length === 1 ? "project is" : "projects are"} not linked to the mission`}
          body={unaligned
            .slice(0, 4)
            .map((p) => p.title)
            .join(" · ")}
          href="/business/projects"
        />
      ) : null}

      <Section title="Missions" meta={`${missions.length} recorded`}>
        {missions.length === 0 ? (
          <EmptyState
            title="No missions yet"
            description="A mission converts a one-year goal into 90 days of work you can actually schedule."
          />
        ) : (
          <div className="space-y-px">
            {missions.map((m) => {
              const progress = computeMissionProgress(m, day);
              return (
                <Panel key={m.id}>
                  <PanelBody>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2.5 flex flex-wrap items-center gap-2">
                          <Badge tone={m.kind === "PRIMARY" ? "default" : "muted"}>{m.kind}</Badge>
                          <Badge
                            tone={
                              m.status === "ACTIVE"
                                ? "positive"
                                : m.status === "FAILED" || m.status === "ABANDONED"
                                  ? "critical"
                                  : "muted"
                            }
                          >
                            {m.status}
                          </Badge>
                        </div>
                        <Link href={`/missions/${m.id}`} className="group block">
                          <h3 className="headline text-ink transition-colors group-hover:text-ink-dim">
                            {m.title}
                          </h3>
                        </Link>
                        {m.objective ? (
                          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-dim">
                            {m.objective}
                          </p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <BlockBar value={progress.progressPct} width={18} />
                          <span className="numeral text-sm text-ink">
                            {progress.progressPct === null ? "—" : `${progress.progressPct}%`}
                          </span>
                          <span className="text-xs text-ink-faint">
                            {formatDay(m.start_date)} → {formatDay(m.end_date)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-4 lg:w-64 lg:flex-none">
                        <KpiGrid cols={2}>
                          <Kpi label="Days left" value={progress.daysRemaining} />
                          <Kpi
                            label="Schedule"
                            value={progress.schedule.replace("_", " ")}
                            tone={
                              progress.schedule === "AT_RISK"
                                ? "critical"
                                : progress.schedule === "BEHIND"
                                  ? "attention"
                                  : progress.schedule === "AHEAD"
                                    ? "positive"
                                    : "default"
                            }
                          />
                        </KpiGrid>
                        <div className="flex items-center gap-2">
                          <Link href={`/missions/${m.id}`} className="btn">
                            Open
                          </Link>
                          {m.kind !== "PRIMARY" && m.status === "ACTIVE" ? (
                            <PromoteMissionButton missionId={m.id} />
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

      <Section title="New mission">
        <Disclosure label="Create a mission" defaultOpen={missions.length === 0}>
          <MissionForm
            defaultStart={day}
            defaultEnd={addDays(day, 89)}
            goals={goals}
          />
        </Disclosure>
      </Section>
    </div>
  );
}
