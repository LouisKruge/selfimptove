import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay } from "@/lib/core/date";
import { money } from "@/lib/core/format";
import { getLead, leadEvents } from "@/lib/services/business";
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
import { DeleteLeadButton, LeadEditForm, StageMover } from "@/components/business/BusinessForms";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(id);
  if (!lead) notFound();

  const events = await leadEvents(lead.id);
  const expected = Math.round((lead.potential_cents * lead.probability) / 100);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`Lead · ${lead.source ?? "no source recorded"}`}
        title={lead.company}
        description={lead.contact_name ?? undefined}
        actions={
          <>
            <DeleteLeadButton leadId={lead.id} />
            <Link href="/business/sales" className="btn btn-ghost">
              Sales
            </Link>
          </>
        }
      />

      <Panel>
        <PanelBody className="space-y-6">
          <StageMover leadId={lead.id} stage={lead.stage} />
          <div className="hairline pt-5">
            <KpiGrid cols={4}>
              <Kpi label="Potential" value={money(lead.potential_cents)} />
              <Kpi label="Probability" value={`${lead.probability}%`} />
              <Kpi label="Expected" value={money(expected)} />
              <Kpi
                label="Next action"
                value={lead.next_action_date ? formatDay(lead.next_action_date) : "—"}
                detail={lead.next_action ?? undefined}
              />
            </KpiGrid>
          </div>
        </PanelBody>
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Detail" />
          <PanelBody>
            <DataRow label="Stage" value={<Badge>{lead.stage.replace("_", " ")}</Badge>} />
            <DataRow label="Email" value={lead.contact_email ?? "—"} />
            <DataRow label="Phone" value={lead.contact_phone ?? "—"} />
            <DataRow label="Source" value={lead.source ?? "—"} />
            <DataRow
              label="Last contact"
              value={lead.last_contact_date ? formatDay(lead.last_contact_date) : "—"}
            />
            {lead.lost_reason ? <DataRow label="Lost reason" value={lead.lost_reason} tone="critical" /> : null}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Stage history" meta="The record conversion rates are built from" />
          <PanelBody>
            {events.length === 0 ? (
              <p className="text-xs text-ink-faint">No stage movements recorded.</p>
            ) : (
              <ol className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-ink">
                      {e.from_stage ? `${e.from_stage.replace("_", " ")} → ` : ""}
                      {e.to_stage.replace("_", " ")}
                    </span>
                    <span className="numeral text-[0.6875rem] text-ink-faint">
                      {formatDay(e.date)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </PanelBody>
        </Panel>
      </div>

      {lead.notes ? (
        <Panel>
          <PanelHeader title="Notes" />
          <PanelBody>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">{lead.notes}</p>
          </PanelBody>
        </Panel>
      ) : null}

      <Section title="Edit">
        <Disclosure label="Edit lead">
          <LeadEditForm lead={lead} />
        </Disclosure>
      </Section>
    </div>
  );
}
