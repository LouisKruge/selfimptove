import { formatDayShort, today } from "@/lib/core/date";
import { money } from "@/lib/core/format";
import {
  listBusinessExpenses,
  listCustomers,
  listRevenue,
  monthlyRevenue,
  primaryBusiness,
  currentMrrCents,
} from "@/lib/services/business";
import { deleteBusinessExpense, deleteRevenue, deleteCustomer } from "@/lib/actions/money";
import {
  Badge,
  BarSeries,
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
import {
  BusinessExpenseForm,
  CustomerForm,
  DeleteRowButton,
  RevenueForm,
} from "@/components/business/BusinessForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revenue" };

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const business = await primaryBusiness();
  const entries = await listRevenue(60);
  const expenses = await listBusinessExpenses(40);
  const customers = await listCustomers();
  const months = await monthlyRevenue(12, day);
  const mrr = await currentMrrCents();

  // Zero entries means unrecorded, not zero earned. Only claim a figure once
  // something has actually been logged.
  const totalRevenue = entries.length > 0 ? entries.reduce((t, e) => t + e.amount_cents, 0) : null;
  const thisMonth = entries.length > 0 ? (months[months.length - 1]?.revenueCents ?? 0) : null;
  const thisMonthProfit =
    entries.length > 0 || expenses.length > 0 ? (months[months.length - 1]?.profitCents ?? 0) : null;
  const churned = customers.filter((c) => c.status === "CHURNED").length;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Business"
        title="Revenue"
        description="What actually arrived, from whom, and what it cost to produce."
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={4}>
            <Kpi label="MRR" value={mrr > 0 ? money(mrr) : "—"} detail={`${customers.filter((c) => c.status === "ACTIVE").length} active customers`} />
            <Kpi
              label="Recorded revenue"
              value={money(totalRevenue)}
              detail={entries.length > 0 ? `${entries.length} entries` : "not recorded"}
            />
            <Kpi
              label="This month"
              value={money(thisMonth)}
              detail={thisMonthProfit === null ? "not recorded" : `profit ${money(thisMonthProfit)}`}
            />
            <Kpi label="Churned" value={churned || "—"} />
          </KpiGrid>
        </PanelBody>
      </Panel>

      <Section title="Monthly revenue and profit">
        <Panel>
          <PanelBody className="space-y-6">
            <div>
              <div className="label mb-3">Revenue</div>
              <BarSeries
                height={72}
                points={months.map((m) => ({ label: m.month, value: Math.round(m.revenueCents / 100) }))}
                format={(v) => money(v * 100)}
              />
            </div>
            <div>
              <div className="label mb-3">Profit</div>
              <BarSeries
                height={48}
                points={months.map((m) => ({ label: m.month, value: Math.round(m.profitCents / 100) }))}
                format={(v) => money(v * 100)}
              />
            </div>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Log revenue">
        <Disclosure label="Log revenue" defaultOpen={params.quick === "revenue"}>
          <RevenueForm
            date={day}
            businessId={business?.id}
            customers={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Disclosure>
      </Section>

      <Section title="Customers" meta={`${customers.length} recorded`}>
        <Panel>
          <PanelBody className="space-y-6">
            {customers.length === 0 ? (
              <EmptyState compact title="No customers" description="A lead becomes a customer when it reaches the CUSTOMER stage." />
            ) : (
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Status</th>
                      <th className="text-right">MRR</th>
                      <th className="text-right">Started</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td className="text-ink">{c.name}</td>
                        <td>
                          <Badge tone={c.status === "ACTIVE" ? "positive" : c.status === "CHURNED" ? "critical" : "muted"}>
                            {c.status}
                          </Badge>
                        </td>
                        <td className="numeral text-right text-ink-dim">{money(c.mrr_cents)}</td>
                        <td className="numeral text-right text-ink-faint">{formatDayShort(c.started_at)}</td>
                        <td className="text-right">
                          <DeleteRowButton
                            action={deleteCustomer.bind(null, c.id)}
                            confirm={`Remove ${c.name}?`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
            <div className="hairline pt-5">
              <Disclosure label="Add a customer">
                <CustomerForm date={day} businessId={business?.id} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Revenue entries" meta={`${entries.length} most recent`}>
        {entries.length === 0 ? (
          <EmptyState title="Nothing recorded" description="Revenue is the only number that proves the business works." />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Kind</th>
                    <th className="text-right">Amount</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="numeral whitespace-nowrap text-ink-faint">{formatDayShort(e.date)}</td>
                      <td className="text-ink">{e.description ?? "—"}</td>
                      <td>
                        <Badge tone="muted">{e.kind.replace("_", " ")}</Badge>
                      </td>
                      <td className="numeral text-right text-ink">{money(e.amount_cents)}</td>
                      <td className="text-right">
                        <DeleteRowButton action={deleteRevenue.bind(null, e.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </Section>

      <Section title="Business expenses" meta={`${expenses.length} most recent`}>
        <Panel>
          <PanelBody className="space-y-6">
            {expenses.length === 0 ? (
              <p className="text-xs text-ink-faint">No business expenses recorded.</p>
            ) : (
              <TableWrap>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th className="text-right">Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="numeral whitespace-nowrap text-ink-faint">{formatDayShort(e.date)}</td>
                        <td className="text-ink">{e.description ?? "—"}</td>
                        <td className="text-ink-faint">{e.category ?? "—"}</td>
                        <td className="numeral text-right text-ink-dim">{money(e.amount_cents)}</td>
                        <td className="text-right">
                          <DeleteRowButton action={deleteBusinessExpense.bind(null, e.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
            <div className="hairline pt-5">
              <Disclosure label="Log an expense">
                <BusinessExpenseForm date={day} businessId={business?.id} />
              </Disclosure>
            </div>
          </PanelBody>
        </Panel>
      </Section>
    </div>
  );
}
