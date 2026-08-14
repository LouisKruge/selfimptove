import Link from "next/link";
import { formatDayShort, today } from "@/lib/core/date";
import { money, pct } from "@/lib/core/format";
import { listLeads, nextSalesActions, pipeline, primaryBusiness } from "@/lib/services/business";
import { LEAD_STAGES } from "@/lib/types";
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
  TableWrap,
  cx,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { LeadForm } from "@/components/business/BusinessForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sales" };

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string; stage?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const business = await primaryBusiness();
  const p = await pipeline();
  const leads = await listLeads(params.stage ? { stage: params.stage } : {});
  const actions = await nextSalesActions(6, day);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Business"
        title="Sales"
        description="Conversion is measured from recorded stage history. Where the sample is too small, the rate stays blank rather than being guessed."
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={4}>
            <Kpi label="Open leads" value={p.totalOpen} />
            <Kpi label="Pipeline value" value={money(p.openValueCents)} />
            <Kpi label="Weighted value" value={money(p.weightedValueCents)} detail="by probability" />
            <Kpi label="Lost" value={p.lost} />
          </KpiGrid>
        </PanelBody>
      </Panel>

      <Section title="Funnel" meta="Leads that have ever reached each stage.">
        <Panel>
          <PanelBody className="space-y-5">
            {p.stages.map((s, i) => {
              const conv = p.conversions[i];
              const top = p.stages[0].everReached || 1;
              return (
                <div key={s.stage} className="space-y-2">
                  <ProgressBar
                    value={(s.everReached / top) * 100}
                    label={s.stage.replace("_", " ")}
                    right={`${s.everReached} reached · ${s.current} here now`}
                  />
                  {conv ? (
                    <div className="flex items-baseline justify-between pl-1 text-[0.6875rem] text-ink-faint">
                      <span>→ {conv.to.replace("_", " ")}</span>
                      <span className="numeral">
                        {conv.rate === null
                          ? `rate unknown (${conv.reached} of 3 needed)`
                          : `${conv.rate}% · ${conv.advanced}/${conv.reached}`}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {p.bottleneck ? (
              <p className="hairline pt-5 text-xs leading-relaxed text-ink-dim">
                The bottleneck is {p.bottleneck.from.replace("_", " ")} →{" "}
                {p.bottleneck.to.replace("_", " ")} at {p.bottleneck.rate}%. Fixing that stage moves
                more revenue than adding leads at the top.
              </p>
            ) : null}
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Highest-value next actions">
        {actions.length === 0 ? (
          <EmptyState compact title="Nothing to work" description="No open leads in the pipeline." />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Stage</th>
                    <th>Next action</th>
                    <th className="text-right">Expected</th>
                    <th>Why now</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/business/sales/${a.id}`} className="text-ink hover:underline">
                          {a.company}
                        </Link>
                      </td>
                      <td>
                        <Badge tone="muted">{a.stage.replace("_", " ")}</Badge>
                      </td>
                      <td className="text-ink-dim">{a.next_action ?? "—"}</td>
                      <td className="numeral text-right text-ink">{money(a.expectedCents)}</td>
                      <td className="text-ink-faint">{a.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </Section>

      <Section title="New lead">
        <Disclosure label="Add a lead" defaultOpen={params.quick === "lead"}>
          <LeadForm businessId={business?.id} />
        </Disclosure>
      </Section>

      <Section
        title="All leads"
        meta={`${leads.length} shown`}
        action={
          <div className="scroll-x flex w-full min-w-0 gap-1 pb-1">
            <Link href="/business/sales" className={cx("btn", !params.stage && "btn-primary")}>
              All
            </Link>
            {LEAD_STAGES.map((s) => (
              <Link
                key={s}
                href={`/business/sales?stage=${s}`}
                className={cx("btn", params.stage === s && "btn-primary")}
              >
                {s.replace("_", " ")}
              </Link>
            ))}
          </div>
        }
      >
        {leads.length === 0 ? (
          <EmptyState
            title="No leads"
            description="Every conversion rate in this system comes from leads moving through these stages."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Stage</th>
                    <th className="text-right">Potential</th>
                    <th className="text-right">Probability</th>
                    <th>Next action</th>
                    <th className="text-right">Due</th>
                    <th className="text-right">Last contact</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/business/sales/${l.id}`} className="text-ink hover:underline">
                          {l.company}
                        </Link>
                        {l.contact_name ? (
                          <span className="ml-2 text-[0.6875rem] text-ink-faint">{l.contact_name}</span>
                        ) : null}
                      </td>
                      <td>
                        <Badge tone={l.stage === "LOST" ? "critical" : l.stage === "CUSTOMER" || l.stage === "RETAINED" ? "positive" : "muted"}>
                          {l.stage.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="numeral text-right text-ink-dim">{money(l.potential_cents)}</td>
                      <td className="numeral text-right text-ink-faint">{l.probability}%</td>
                      <td className="text-ink-dim">{l.next_action ?? "—"}</td>
                      <td
                        className={cx(
                          "numeral text-right",
                          l.next_action_date && l.next_action_date < day
                            ? "text-critical"
                            : "text-ink-faint",
                        )}
                      >
                        {l.next_action_date ? formatDayShort(l.next_action_date) : "—"}
                      </td>
                      <td className="numeral text-right text-ink-faint">
                        {l.last_contact_date ? formatDayShort(l.last_contact_date) : "—"}
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
