import Link from "next/link";
import { formatDayShort } from "@/lib/core/date";
import { pct } from "@/lib/core/format";
import { ideaViews } from "@/lib/services/growth";
import {
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
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { IdeaCaptureForm } from "@/components/growth/GrowthForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ideas" };

const STAGES = ["CAPTURE", "RESEARCH", "VALIDATE", "SCORED", "PARKED", "ACTIVE", "KILLED"] as const;

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const ideas = await ideaViews();

  const byStage = new Map<string, typeof ideas>();
  for (const i of ideas) {
    const list = byStage.get(i.stage);
    if (list) list.push(i);
    else byStage.set(i.stage, [i]);
  }

  const scored = ideas.filter((i) => i.score.total !== null);
  const best = [...scored].sort((a, b) => (b.score.total ?? 0) - (a.score.total ?? 0))[0];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Growth"
        title="Idea Vault"
        description="Capture → research → validate → score → park or activate. An idea only becomes a project when it is deliberately promoted."
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={4}>
            <Kpi label="Captured" value={ideas.length || "—"} />
            <Kpi label="Scored" value={scored.length || "—"} />
            <Kpi label="Active" value={ideas.filter((i) => i.stage === "ACTIVE").length || "—"} />
            <Kpi
              label="Strongest"
              value={best ? best.title : "—"}
              detail={best?.score.total !== null && best ? `${best.score.total}/100` : undefined}
            />
          </KpiGrid>
        </PanelBody>
      </Panel>

      <Section title="Capture">
        <Disclosure label="Capture an idea" defaultOpen={params.quick === "idea" || ideas.length === 0}>
          <IdeaCaptureForm />
        </Disclosure>
      </Section>

      {ideas.length === 0 ? (
        <EmptyState
          title="The vault is empty"
          description="Ideas go here so they stop competing with the mission for attention. Capturing one costs nothing; activating one costs everything else."
        />
      ) : (
        STAGES.filter((s) => byStage.has(s)).map((stage) => (
          <Section key={stage} title={stage} meta={`${byStage.get(stage)?.length ?? 0}`}>
            <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
              {byStage.get(stage)?.map((idea) => (
                <Link
                  key={idea.id}
                  href={`/ideas/${idea.id}`}
                  className="panel p-4 transition-colors hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-ink">{idea.title}</span>
                    {idea.score.total !== null ? (
                      <span className="numeral flex-none text-xs text-ink-dim">
                        {idea.score.total}
                      </span>
                    ) : null}
                  </div>
                  {idea.summary ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-faint">
                      {idea.summary}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <ProgressBar value={idea.score.total} />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[0.625rem] text-ink-ghost">
                    <span>
                      {idea.score.complete
                        ? `Leverage ${idea.score.leverage ?? "—"}`
                        : `${idea.score.missing.length} unscored`}
                    </span>
                    <span>{formatDayShort(idea.created_at.slice(0, 10))}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        ))
      )}
    </div>
  );
}
