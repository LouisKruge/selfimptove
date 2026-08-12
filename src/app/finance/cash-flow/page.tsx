import { formatDayShort, today } from "@/lib/core/date";
import { money } from "@/lib/core/format";
import {
  cashOnHandCents,
  forecasts,
  listAccounts,
  listDebts,
  listIncome,
  listPersonalExpenses,
  listScheduled,
} from "@/lib/services/finance";
import { deleteExpense, deleteIncome, deleteScheduled, deleteAccount } from "@/lib/actions/money";
import {
  AlertCard,
  Badge,
  BarSeries,
  EmptyState,
  Kpi,
  LineChart,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Section,
  TableWrap,
  cx,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { DeleteRowButton } from "@/components/business/BusinessForms";
import {
  AccountForm,
  ExpenseForm,
  IncomeForm,
  ScheduledForm,
  ScheduledToggle,
} from "@/components/finance/FinanceForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cash Flow" };

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const f = forecasts(day);
  const accounts = listAccounts();
  const scheduled = listScheduled(false);
  const expenses = listPersonalExpenses(40);
  const income = listIncome(20);
  const debts = listDebts();
  const cash = cashOnHandCents();

  const horizons = [
    { label: "7 day", data: f.week },
    { label: "30 day", data: f.month },
    { label: "90 day", data: f.quarter },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Finance"
        title="Cash Flow"
        description="Projected forward from money you have actually scheduled. Nothing is extrapolated from averages — an unpredicted expense is simply absent."
      />

      {f.quarter.shortfall ? (
        <AlertCard
          severity="CRITICAL"
          title={`Shortfall projected on ${f.quarter.shortfall.date}`}
          body={`The balance falls ${money(f.quarter.shortfall.amountCents)} short. Move a payment, bring income forward, or cut a scheduled item.`}
        />
      ) : null}

      <div className="grid gap-px sm:grid-cols-3">
        {horizons.map((h) => (
          <Panel key={h.label}>
            <PanelBody>
              <div className="label">{h.label} forecast</div>
              <div
                className={cx(
                  "numeral mt-3 text-3xl font-medium leading-none",
                  h.data.closingCents < 0 ? "text-critical" : "text-ink",
                )}
              >
                {money(h.data.closingCents)}
              </div>
              <div className="mt-3 space-y-1 text-[0.6875rem] text-ink-faint">
                <div>
                  In {money(h.data.totalInCents)} · out {money(h.data.totalOutCents)}
                </div>
                <div className={h.data.lowestCents < 0 ? "text-critical" : undefined}>
                  Lowest {money(h.data.lowestCents)}
                  {h.data.lowestDate ? ` on ${formatDayShort(h.data.lowestDate)}` : ""}
                </div>
              </div>
            </PanelBody>
          </Panel>
        ))}
      </div>

      <Section title="Projected balance" meta="Next 90 days">
        <Panel>
          <PanelBody>
            <LineChart
              height={110}
              points={f.quarter.days.map((d) => ({
                label: formatDayShort(d.date),
                value: Math.round(d.balanceCents / 100),
              }))}
              format={(v) => money(v * 100)}
            />
            <div className="mt-6">
              <KpiGrid cols={3}>
                <Kpi label="Cash on hand" value={money(cash)} detail={`${accounts.filter((a) => a.include_in_cash).length} accounts`} />
                <Kpi label="Scheduled out" value={money(f.month.totalOutCents)} detail="next 30 days" />
                <Kpi label="Scheduled in" value={money(f.month.totalInCents)} detail="next 30 days" />
              </KpiGrid>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Upcoming" meta={`${f.month.events.length} movements in the next 30 days`}>
        {f.month.events.length === 0 ? (
          <EmptyState
            compact
            title="Nothing scheduled"
            description="Add your recurring bills and income so the forecast has something to work with."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {f.month.events.map((e, i) => (
                    <tr key={`${e.name}-${e.date}-${i}`}>
                      <td className="numeral whitespace-nowrap text-ink-faint">{formatDayShort(e.date)}</td>
                      <td className="text-ink">{e.name}</td>
                      <td className="text-ink-faint">{e.category ?? "—"}</td>
                      <td className={cx("numeral text-right", e.direction === "IN" ? "text-positive" : "text-ink-dim")}>
                        {e.direction === "IN" ? "+" : "−"}
                        {money(e.amountCents)}
                      </td>
                      <td className={cx("numeral text-right", e.balanceAfterCents < 0 ? "text-critical" : "text-ink")}>
                        {money(e.balanceAfterCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Log an expense">
          <Disclosure label="Log expense" defaultOpen={params.quick === "expense"}>
            <ExpenseForm date={day} accounts={accounts.map((a) => ({ value: a.id, label: a.name }))} />
          </Disclosure>
        </Section>
        <Section title="Log income">
          <Disclosure label="Log income" defaultOpen={params.quick === "income"}>
            <IncomeForm date={day} accounts={accounts.map((a) => ({ value: a.id, label: a.name }))} />
          </Disclosure>
        </Section>
      </div>

      <Section title="Accounts" meta={`${money(cash)} available`}>
        <Panel>
          <PanelBody className="space-y-6">
            {accounts.length === 0 ? (
              <p className="text-xs text-ink-faint">No accounts. Add one so the forecast has an opening balance.</p>
            ) : (
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Kind</th>
                      <th className="text-right">Balance</th>
                      <th>In cash</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((a) => (
                      <tr key={a.id}>
                        <td className="text-ink">{a.name}</td>
                        <td className="text-ink-faint">{a.kind}</td>
                        <td className="numeral text-right text-ink">{money(a.balance_cents)}</td>
                        <td className="text-ink-faint">{a.include_in_cash ? "Yes" : "—"}</td>
                        <td className="text-right">
                          <DeleteRowButton action={deleteAccount.bind(null, a.id)} confirm={`Remove ${a.name}?`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
            <div className="hairline pt-5">
              <Disclosure label="Add an account">
                <AccountForm />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Scheduled items" meta={`${scheduled.filter((s) => s.active).length} active`}>
        <Panel>
          <PanelBody className="space-y-6">
            {scheduled.length === 0 ? (
              <p className="text-xs text-ink-faint">Nothing scheduled.</p>
            ) : (
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Cadence</th>
                      <th>When</th>
                      <th className="text-right">Amount</th>
                      <th>State</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {scheduled.map((s) => (
                      <tr key={s.id}>
                        <td className="text-ink">{s.name}</td>
                        <td className="text-ink-faint">{s.cadence}</td>
                        <td className="numeral text-ink-faint">
                          {s.cadence === "MONTHLY"
                            ? `day ${s.day_of_month}`
                            : s.cadence === "WEEKLY"
                              ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.day_of_week ?? 0]
                              : (s.next_date ?? "—")}
                        </td>
                        <td className={cx("numeral text-right", s.direction === "IN" ? "text-positive" : "text-ink-dim")}>
                          {s.direction === "IN" ? "+" : "−"}
                          {money(s.amount_cents)}
                        </td>
                        <td>
                          <ScheduledToggle itemId={s.id} active={s.active === 1} />
                        </td>
                        <td className="text-right">
                          <DeleteRowButton action={deleteScheduled.bind(null, s.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
            <div className="hairline pt-5">
              <Disclosure label="Add a scheduled item">
                <ScheduledForm debts={debts.map((d) => ({ value: d.id, label: d.name }))} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Recent expenses" meta={`${expenses.length}`}>
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th className="text-right">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice(0, 20).map((e) => (
                    <tr key={e.id}>
                      <td className="numeral whitespace-nowrap text-ink-faint">{formatDayShort(e.date)}</td>
                      <td className="text-ink">
                        {e.category}
                        {e.description ? <span className="ml-2 text-ink-faint">{e.description}</span> : null}
                      </td>
                      <td className="numeral text-right text-ink-dim">{money(e.amount_cents)}</td>
                      <td className="text-right">
                        <DeleteRowButton action={deleteExpense.bind(null, e.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </Section>

        <Section title="Recent income" meta={`${income.length}`}>
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Source</th>
                    <th className="text-right">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {income.slice(0, 20).map((e) => (
                    <tr key={e.id}>
                      <td className="numeral whitespace-nowrap text-ink-faint">{formatDayShort(e.date)}</td>
                      <td className="text-ink">
                        {e.source}
                        {e.description ? <span className="ml-2 text-ink-faint">{e.description}</span> : null}
                      </td>
                      <td className="numeral text-right text-positive">{money(e.amount_cents)}</td>
                      <td className="text-right">
                        <DeleteRowButton action={deleteIncome.bind(null, e.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </Section>
      </div>
    </div>
  );
}
