import { formatDayShort, today } from "@/lib/core/date";
import { money, pct } from "@/lib/core/format";
import { investmentContributions, investmentViews } from "@/lib/services/finance";
import { deleteInvestment } from "@/lib/actions/money";
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
import { DeleteRowButton } from "@/components/business/BusinessForms";
import { ContributionForm, InvestmentForm } from "@/components/finance/FinanceForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investments" };

export default async function InvestmentsPage() {
  const day = today();
  const investments = await investmentViews();
  const contributions = await investmentContributions();

  const total = investments.reduce((t, i) => t + i.current_cents, 0);
  const basis = investments.reduce((t, i) => t + i.cost_basis_cents, 0);
  const gain = total - basis;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Finance"
        title="Investments"
        description="Long-term holdings and what has been contributed to them. This is a record of ownership, not a trading screen."
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={4}>
            <Kpi label="Portfolio value" value={total > 0 ? money(total) : "—"} />
            <Kpi label="Cost basis" value={money(basis)} />
            <Kpi
              label="Return"
              value={money(gain)}
              tone={gain < 0 ? "critical" : gain > 0 ? "positive" : "default"}
              detail={basis > 0 ? pct((gain / basis) * 100, 1) : undefined}
            />
            <Kpi label="Holdings" value={investments.length || "—"} />
          </KpiGrid>
        </PanelBody>
      </Panel>

      <Section title="Holdings">
        {investments.length === 0 ? (
          <EmptyState
            title="Nothing held"
            description="Assets outlast effort. Record what you own and what it cost so the return is real, not remembered."
          />
        ) : (
          <div className="space-y-px">
            {investments.map((i) => (
              <Panel key={i.id}>
                <PanelBody>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2.5">
                        <span className="text-base text-ink">{i.name}</span>
                        <Badge tone="muted">{i.asset_class}</Badge>
                      </div>
                      <div className="numeral text-2xl font-medium text-ink">{money(i.current_cents)}</div>
                      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[0.6875rem] text-ink-faint">
                        <span>Cost {money(i.cost_basis_cents)}</span>
                        <span className={cx(i.returnCents < 0 ? "text-critical" : i.returnCents > 0 ? "text-positive" : undefined)}>
                          {i.returnCents >= 0 ? "+" : ""}
                          {money(i.returnCents)}
                          {i.returnPct !== null ? ` · ${i.returnPct}%` : ""}
                        </span>
                        <span>Opened {formatDayShort(i.opened_at)}</span>
                      </div>
                      {i.objective ? (
                        <p className="mt-2.5 text-xs leading-relaxed text-ink-faint">{i.objective}</p>
                      ) : null}
                    </div>

                    <div className="w-full lg:w-80 lg:flex-none">
                      <ProgressBar
                        value={i.allocationPct}
                        label="Allocation"
                        right={i.allocationPct === null ? "—" : pct(i.allocationPct, 1)}
                      />
                      <div className="mt-4">
                        <ContributionForm investmentId={i.id} date={day} />
                      </div>
                      <div className="mt-3 flex justify-end">
                        <DeleteRowButton
                          action={deleteInvestment.bind(null, i.id)}
                          confirm={`Remove ${i.name}?`}
                        />
                      </div>
                    </div>
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        )}
      </Section>

      <Section title="Add an investment">
        <Disclosure label="Add investment" defaultOpen={investments.length === 0}>
          <Panel>
            <PanelBody>
              <InvestmentForm date={day} />
            </PanelBody>
          </Panel>
        </Disclosure>
      </Section>

      {contributions.length > 0 ? (
        <Section title="Contributions" meta={`${contributions.length} recorded`}>
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Amount</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => (
                    <tr key={c.id}>
                      <td className="numeral whitespace-nowrap text-ink-faint">{formatDayShort(c.date)}</td>
                      <td className="numeral text-right text-ink">{money(c.amount_cents)}</td>
                      <td className="text-ink-faint">{c.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </Section>
      ) : null}
    </div>
  );
}
