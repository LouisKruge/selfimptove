import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay } from "@/lib/core/date";
import { money } from "@/lib/core/format";
import { decisionView } from "@/lib/services/character";
import { all } from "@/lib/db";
import {
  Badge,
  DataRow,
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
  DecideForm,
  DecisionActions,
  DecisionOptionForm,
  DecisionOptionList,
  OutcomeForm,
} from "@/components/character/DecisionForms";

export const dynamic = "force-dynamic";

export default async function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const d = await decisionView(id);
  if (!d) notFound();

  const notes = await all<{ id: string; title: string | null; body: string }>(
      "SELECT id, title, body FROM notes WHERE entity_type = 'decision' AND entity_id = ?",
      [id],
    );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`Decision · ${d.pillar}`}
        title={d.title}
        description={d.problem ?? undefined}
        actions={
          <>
            <Badge tone={d.level === "RED" ? "critical" : d.level === "YELLOW" ? "attention" : "positive"}>
              {d.level}
            </Badge>
            <Link href="/character/decisions" className="btn btn-ghost">
              Decisions
            </Link>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHeader title={d.status === "DECIDED" ? "Decision" : "The firewall"} />
          <PanelBody className="space-y-5">
            {d.status === "DECIDED" ? (
              <>
                <p className="text-lg leading-relaxed text-ink">{d.decision}</p>
                <p className="text-xs text-ink-faint">
                  Decided {d.decided_at ? formatDay(d.decided_at.slice(0, 10)) : "—"}
                </p>
              </>
            ) : d.status === "ABANDONED" ? (
              <p className="text-sm text-ink-faint">This decision was abandoned.</p>
            ) : (
              <DecideForm
                decisionId={d.id}
                options={d.options}
                released={d.cooling.released}
                coolingLabel={d.cooling.label}
              />
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Context" />
          <PanelBody>
            <DataRow label="Status" value={d.status} />
            <DataRow label="Reversibility" value={d.reversibility.toLowerCase()} />
            <DataRow label="Emotional state" value={d.emotional_state ?? "—"} />
            <DataRow label="Emotional intensity" value={d.emotional_intensity ?? "—"} />
            <DataRow label="Amount" value={d.amount_cents ? money(d.amount_cents) : "—"} />
            <DataRow
              label="Cooling until"
              value={d.cooling_until ? formatDay(d.cooling_until.slice(0, 10)) : "—"}
            />
          </PanelBody>
        </Panel>
      </div>

      {notes.length > 0 ? (
        <Panel>
          <PanelHeader title="Why it was classified this way" />
          <PanelBody>
            {notes.map((n) => (
              <p key={n.id} className="whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">
                {n.body}
              </p>
            ))}
          </PanelBody>
        </Panel>
      ) : null}

      {d.objective ? (
        <Panel>
          <PanelHeader title="Objective" />
          <PanelBody>
            <p className="text-sm leading-relaxed text-ink-dim">{d.objective}</p>
          </PanelBody>
        </Panel>
      ) : null}

      <Section title="Options" meta={`${d.options.length} recorded`}>
        <Panel>
          <PanelBody className="space-y-6">
            <DecisionOptionList options={d.options} />
            <div className="hairline pt-5">
              <Disclosure label="Add an option">
                <DecisionOptionForm decisionId={d.id} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Outcome">
        <Panel>
          <PanelBody className="space-y-5">
            {d.outcome ? (
              <>
                <p className="text-sm leading-relaxed text-ink">{d.outcome}</p>
                <KpiGrid cols={2}>
                  <Kpi label="Rating" value={d.outcome_rating ?? "—"} detail="out of 5" />
                  <Kpi
                    label="Recorded"
                    value={d.outcome_recorded_at ? formatDay(d.outcome_recorded_at.slice(0, 10)) : "—"}
                  />
                </KpiGrid>
                {d.lesson ? (
                  <p className="hairline pt-5 text-sm leading-relaxed text-ink-dim">
                    <span className="label mr-2">Lesson</span>
                    {d.lesson}
                  </p>
                ) : null}
              </>
            ) : d.status === "DECIDED" ? (
              <OutcomeForm decisionId={d.id} />
            ) : (
              <p className="text-xs text-ink-faint">
                Record an outcome once the decision has been made and had time to play out.
              </p>
            )}
          </PanelBody>
        </Panel>
      </Section>

      <DecisionActions decisionId={d.id} />
    </div>
  );
}
