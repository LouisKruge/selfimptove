import { formatDayShort, today } from "@/lib/core/date";
import { money, pct } from "@/lib/core/format";
import { debtPayments, debtPlan } from "@/lib/services/finance";
import { deleteDebt } from "@/lib/actions/money";
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
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { DeleteRowButton } from "@/components/business/BusinessForms";
import { DebtForm, DebtPaymentForm } from "@/components/finance/FinanceForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Debt" };

export default async function DebtPage() {
  const day = today();
  const plan = await debtPlan();
  const payments = await debtPayments();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Finance"
        title="Debt"
        description="Debt is the tax on impatience. Smallest balance first produces the earliest clean kill and the momentum that comes with it."
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={4}>
            <Kpi label="Total debt" value={plan.totalCents > 0 ? money(plan.totalCents) : "—"} />
            <Kpi label="Minimum payments" value={money(plan.totalMinPaymentCents)} detail="per month" />
            <Kpi
              label="Months to clear"
              value={plan.monthsToClearAtMinimum ?? "—"}
              detail="at minimum payments only"
            />
            <Kpi label="Accounts" value={plan.debts.length || "—"} />
          </KpiGrid>
        </PanelBody>
      </Panel>

      <Section title="Payoff order" meta="Smallest balance first.">
        {plan.debts.length === 0 ? (
          <EmptyState
            title="No debt recorded"
            description="If you are debt free, nothing needs to go here. If not, recording it is the first step to killing it."
          />
        ) : (
          <div className="space-y-px">
            {plan.payoffOrder.map((d, i) => {
              const paid = d.original_cents > 0 ? ((d.original_cents - d.balance_cents) / d.original_cents) * 100 : null;
              return (
                <Panel key={d.id}>
                  <PanelBody>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2.5">
                          <span className="numeral text-[0.6875rem] text-ink-ghost">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="text-base text-ink">{d.name}</span>
                          <Badge tone="muted">{d.kind.replace("_", " ")}</Badge>
                        </div>
                        <div className="numeral text-2xl font-medium text-ink">
                          {money(d.balance_cents)}
                        </div>
                        <div className="mt-3 max-w-md">
                          <ProgressBar
                            value={paid}
                            label="Paid down"
                            right={paid === null ? "no original recorded" : pct(paid)}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.6875rem] text-ink-faint">
                          {d.interest_rate !== null ? <span>{d.interest_rate}% interest</span> : null}
                          {d.min_payment_cents > 0 ? <span>{money(d.min_payment_cents)} minimum</span> : null}
                          {d.due_day ? <span>Due day {d.due_day}</span> : null}
                        </div>
                      </div>

                      <div className="w-full lg:w-80 lg:flex-none">
                        <DebtPaymentForm debtId={d.id} date={day} minPaymentCents={d.min_payment_cents} />
                        <div className="mt-3 flex justify-end">
                          <DeleteRowButton
                            action={deleteDebt.bind(null, d.id)}
                            confirm={`Remove ${d.name}? Payment history goes with it.`}
                          />
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

      <Section title="Add a debt">
        <Disclosure label="Add debt" defaultOpen={plan.debts.length === 0}>
          <Panel>
            <PanelBody>
              <DebtForm />
            </PanelBody>
          </Panel>
        </Disclosure>
      </Section>

      <Section title="Payment history" meta={`${payments.length} recorded`}>
        {payments.length === 0 ? (
          <EmptyState compact title="No payments logged" description="Each payment updates the balance and the finance score." />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="numeral whitespace-nowrap text-ink-faint">{formatDayShort(p.date)}</td>
                      <td className="numeral text-right text-ink">{money(p.amount_cents)}</td>
                      <td className="numeral text-right text-ink-dim">{money(p.balance_after ?? 0)}</td>
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
