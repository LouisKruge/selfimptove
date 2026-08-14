import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay } from "@/lib/core/date";
import { ideaView } from "@/lib/services/growth";
import { IDEA_DIMENSIONS } from "@/lib/domain/ideas";
import {
  Badge,
  DataRow,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  Section,
} from "@/components/primitives";
import { DeleteIdeaButton, IdeaScoreForm, IdeaStageControls } from "@/components/growth/GrowthForms";

export const dynamic = "force-dynamic";

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const idea = await ideaView(id);
  if (!idea) notFound();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`Idea · ${idea.stage}`}
        title={idea.title}
        description={idea.summary ?? undefined}
        actions={
          <>
            <DeleteIdeaButton ideaId={idea.id} />
            <Link href="/ideas" className="btn btn-ghost">
              Vault
            </Link>
          </>
        }
      />

      <Panel>
        <PanelBody className="space-y-6">
          <IdeaStageControls
            ideaId={idea.id}
            stage={idea.stage}
            canActivate={idea.activation.ok}
            activationReason={idea.activation.reason}
          />
          <div className="hairline pt-5">
            <KpiGrid cols={3}>
              <Kpi
                label="Score"
                value={idea.score.total === null ? "—" : idea.score.total}
                detail="weighted, out of 100"
              />
              <Kpi
                label="Leverage"
                value={idea.score.leverage ?? "—"}
                detail="upside ÷ effort"
              />
              <Kpi
                label="Scoring"
                value={idea.score.complete ? "Complete" : "Incomplete"}
                detail={idea.score.complete ? undefined : idea.score.missing.join(", ")}
              />
            </KpiGrid>
          </div>
        </PanelBody>
      </Panel>

      <Section title="Dimensions">
        <Panel>
          <PanelBody className="space-y-5">
            {IDEA_DIMENSIONS.map((d) => {
              const raw = idea[d.key];
              return (
                <ProgressBar
                  key={d.key}
                  value={raw === null ? null : (raw / 10) * 100}
                  label={`${d.label}${d.invert ? " (lower is better)" : ""}`}
                  right={raw === null ? "not scored" : `${raw}/10`}
                />
              );
            })}
          </PanelBody>
        </Panel>
      </Section>

      {idea.research_notes || idea.validation_notes ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="Research" />
            <PanelBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">
                {idea.research_notes ?? "Nothing recorded."}
              </p>
            </PanelBody>
          </Panel>
          <Panel>
            <PanelHeader title="Validation" />
            <PanelBody>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">
                {idea.validation_notes ?? "Nothing recorded."}
              </p>
            </PanelBody>
          </Panel>
        </div>
      ) : null}

      <Section title="Score and notes">
        <IdeaScoreForm idea={idea} />
      </Section>

      {idea.promoted_project_id ? (
        <Panel>
          <PanelHeader title="Activated" />
          <PanelBody>
            <p className="text-sm text-ink-dim">
              This idea became a project on{" "}
              {idea.activated_at ? formatDay(idea.activated_at.slice(0, 10)) : "—"}.
            </p>
            <Link href={`/business/projects/${idea.promoted_project_id}`} className="btn mt-4">
              Open the project
            </Link>
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
