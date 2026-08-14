import Link from "next/link";
import { formatDayShort } from "@/lib/core/date";
import { money } from "@/lib/core/format";
import { coolingDecisions, listDecisions } from "@/lib/services/character";
import { decisionQuality } from "@/lib/domain/character";
import { COOLING_HOURS } from "@/lib/domain/firewall";
import {
  Badge,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Section,
  TableWrap,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { DecisionForm } from "@/components/character/DecisionForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Decisions" };

export default async function DecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const decisions = await listDecisions();
  const cooling = await coolingDecisions();
  const quality = decisionQuality(decisions);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Character"
        title="Decisions"
        description="A permanent record of what you decided, how you felt at the time, and how it turned out. The firewall puts distance between the feeling and the commitment."
      />

      <Panel>
        <PanelHeader title="Impulse firewall" meta="Classification is automatic and cannot be skipped." />
        <PanelBody>
          <div className="grid gap-6 sm:grid-cols-3">
            {(["GREEN", "YELLOW", "RED"] as const).map((level) => (
              <div key={level}>
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={level === "RED" ? "critical" : level === "YELLOW" ? "attention" : "positive"}>
                    {level}
                  </Badge>
                  <span className="numeral text-xs text-ink-faint">
                    {COOLING_HOURS[level] === 0 ? "no wait" : `${COOLING_HOURS[level]}h`}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-ink-faint">
                  {level === "GREEN"
                    ? "Normal decision. Act now."
                    : level === "YELLOW"
                      ? "Important decision — major spend or costly to reverse. 24 hours."
                      : "Emotionally charged, irreversible, borrowing, or a business pivot. 72 hours."}
                </p>
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>

      {cooling.length > 0 ? (
        <Section title="Cooling" meta={`${cooling.length} waiting`}>
          <div className="grid gap-px sm:grid-cols-2">
            {cooling.map((d) => (
              <Link key={d.id} href={`/character/decisions/${d.id}`} className="panel p-4 transition-colors hover:border-line-strong">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm text-ink">{d.title}</span>
                  <Badge tone={d.level === "RED" ? "critical" : "attention"}>{d.level}</Badge>
                </div>
                <p className="numeral mt-2.5 text-lg text-ink-dim">{d.cooling.label}</p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="New decision">
        <Disclosure label="Create a decision" defaultOpen={params.quick === "decision"}>
          <DecisionForm />
        </Disclosure>
      </Section>

      <Section title="Decision quality">
        <Panel>
          <PanelBody>
            <KpiGrid cols={4}>
              <Kpi label="Decided" value={quality.decided || "—"} />
              <Kpi label="Outcomes recorded" value={quality.withOutcome || "—"} />
              <Kpi label="Average rating" value={quality.averageRating ?? "—"} />
              <Kpi label="Made under high emotion" value={quality.highEmotionCount || "—"} />
            </KpiGrid>
            <p className="mt-5 text-sm leading-relaxed text-ink-dim">
              {quality.insight ?? "Record outcomes to see whether emotional state is affecting your decision quality."}
            </p>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="History" meta={`${decisions.length} recorded`}>
        {decisions.length === 0 ? (
          <EmptyState
            title="No decisions recorded"
            description="Major decisions deserve a record. Later you can look back and see which conditions produced good outcomes."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Decision</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th>Reversibility</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Outcome</th>
                    <th className="text-right">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <Link href={`/character/decisions/${d.id}`} className="text-ink hover:underline">
                          {d.title}
                        </Link>
                      </td>
                      <td>
                        <Badge tone={d.level === "RED" ? "critical" : d.level === "YELLOW" ? "attention" : "positive"}>
                          {d.level}
                        </Badge>
                      </td>
                      <td className="text-ink-faint">{d.status}</td>
                      <td className="text-ink-faint">{d.reversibility.toLowerCase()}</td>
                      <td className="numeral text-right text-ink-dim">
                        {d.amount_cents ? money(d.amount_cents) : "—"}
                      </td>
                      <td className="numeral text-right text-ink-dim">{d.outcome_rating ?? "—"}</td>
                      <td className="numeral text-right text-ink-faint">
                        {formatDayShort(d.created_at.slice(0, 10))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </Section>
    </div>
  );
}
