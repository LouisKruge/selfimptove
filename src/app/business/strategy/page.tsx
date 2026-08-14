import Link from "next/link";
import { today } from "@/lib/core/date";
import { money, num } from "@/lib/core/format";
import { businessDashboard, conversionSummary, primaryBusiness } from "@/lib/services/business";
import {
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
import { BusinessProfileForm } from "@/components/business/BusinessForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Strategy" };

export default async function StrategyPage() {
  const day = today();
  const business = await primaryBusiness();
  const b = await businessDashboard(day);
  const conv = await conversionSummary();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Business"
        title="Strategy"
        description="Target customer, offer, and the arithmetic that connects the revenue target to the number of conversations it takes to get there."
        actions={<Link href="/business" className="btn btn-ghost">Dashboard</Link>}
      />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Target customer" />
          <PanelBody>
            {business?.target_customer ? (
              <p className="text-base leading-relaxed text-ink">{business.target_customer}</p>
            ) : (
              <p className="text-sm text-ink-ghost">
                Not defined. Everything downstream — the offer, the outreach, the pricing — depends
                on this one paragraph.
              </p>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Offer" />
          <PanelBody>
            {business?.offer ? (
              <p className="text-base leading-relaxed text-ink">{business.offer}</p>
            ) : (
              <p className="text-sm text-ink-ghost">
                Not defined. A vague offer makes every sales conversation harder than it needs to be.
              </p>
            )}
          </PanelBody>
        </Panel>
      </div>

      <Section title="The arithmetic" meta={b.plan.note}>
        <Panel>
          <PanelBody>
            {b.plan.customersRequired === null ? (
              <EmptyState
                compact
                title="Set an average deal value and a target"
                description="Without both, the funnel cannot be back-solved — and COMMAND will not invent the numbers."
              />
            ) : (
              <>
                <KpiGrid cols={4}>
                  <Kpi label="Target MRR" value={money(b.plan.targetMrrCents)} />
                  <Kpi label="Average deal" value={money(b.plan.avgDealCents)} />
                  <Kpi label="Customers required" value={b.plan.customersRequired} />
                  <Kpi label="Still needed" value={b.plan.customerGap ?? "—"} />
                </KpiGrid>

                <div className="hairline mt-6 pt-6">
                  <TableWrap>
                    <table>
                      <thead>
                        <tr>
                          <th>Stage</th>
                          <th className="text-right">Volume required</th>
                          <th className="text-right">Converts onward</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.plan.steps.map((s) => (
                          <tr key={s.stage}>
                            <td className="text-ink">{s.stage.replace("_", " ")}</td>
                            <td className="numeral text-right text-ink">
                              {s.required === null ? "—" : num(s.required)}
                            </td>
                            <td className="numeral text-right text-ink-faint">
                              {s.rateOut === null ? "unknown" : `${s.rateOut}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                </div>
              </>
            )}
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Conversion" meta="Measured across every lead you have recorded.">
        <Panel>
          <PanelBody className="space-y-4">
            {conv.conversions.map((c) => (
              <div key={`${c.from}-${c.to}`} className="flex items-baseline justify-between gap-4 border-b border-line-soft pb-3 last:border-b-0 last:pb-0">
                <span className="text-sm text-ink-dim">
                  {c.from.replace("_", " ")} → {c.to.replace("_", " ")}
                </span>
                <span className="numeral text-sm text-ink">
                  {c.rate === null ? (
                    <span className="text-ink-ghost">
                      unknown · {c.reached} of 3 leads needed
                    </span>
                  ) : (
                    `${c.rate}% · ${c.advanced}/${c.reached}`
                  )}
                </span>
              </div>
            ))}
            {conv.overall !== null ? (
              <p className="hairline pt-5 text-xs text-ink-faint">
                End-to-end, {conv.overall}% of prospects become customers on current rates.
              </p>
            ) : null}
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Business profile">
        <BusinessProfileForm business={business ?? null} />
      </Section>
    </div>
  );
}
