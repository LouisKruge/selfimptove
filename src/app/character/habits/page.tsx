import { formatDayShort, today, weekdayShort } from "@/lib/core/date";
import { pct } from "@/lib/core/format";
import { habitDoneSet, habitGrid, habitStats, listHabits } from "@/lib/services/character";
import { habitPortfolio } from "@/lib/domain/character";
import {
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
import { HabitChecklist } from "@/components/character/HabitChecklist";
import { HabitForm, HabitRowControls } from "@/components/character/DecisionForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Habits" };

export default async function HabitsPage() {
  const day = today();
  const habits = await listHabits();
  const stats = await habitStats(day);
  const done = [...await habitDoneSet(day)];
  const grid = await habitGrid(28, day);

  const p7 = habitPortfolio(stats, 7);
  const p30 = habitPortfolio(stats, 30);
  const p90 = habitPortfolio(stats, 90);
  const consistency = Object.fromEntries(stats.map((h) => [h.habitId, h.consistency30]));

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Character"
        title="Habits"
        description="Five to eight core habits, measured as frequency against a stated target. No streak theatre — a missed day is data, not a punishment."
      />

      <Panel>
        <PanelBody>
          <KpiGrid cols={4}>
            <Kpi label="Active habits" value={habits.length} detail="8 is the ceiling" />
            <Kpi label="7-day consistency" value={p7.average === null ? "—" : pct(p7.average)} />
            <Kpi label="30-day consistency" value={p30.average === null ? "—" : pct(p30.average)} />
            <Kpi
              label="Weakest"
              value={p30.weakest ? p30.weakest.name : "—"}
              detail={p30.weakest?.consistency30 === null || !p30.weakest ? undefined : pct(p30.weakest.consistency30)}
            />
          </KpiGrid>
        </PanelBody>
      </Panel>

      <Section title="Today" meta={`${done.length} of ${habits.length} done`}>
        <Panel>
          <PanelBody>
            <HabitChecklist habits={habits} done={done} date={day} consistency={consistency} />
          </PanelBody>
        </Panel>
      </Section>

      {habits.length > 0 ? (
        <Section title="Last 28 days" meta="Each column is a day; the rightmost is today.">
          <Panel>
            <PanelBody flush className="p-4 sm:p-5">
              <div className="scroll-x">
                <table className="min-w-[42rem]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-panel">Habit</th>
                      {grid.dates.map((d) => (
                        <th key={d} className="!px-1 text-center">
                          <span className="text-ink-ghost">{d.slice(8, 10)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.habits.map((h) => (
                      <tr key={h.id}>
                        <td className="sticky left-0 whitespace-nowrap bg-panel text-ink">{h.name}</td>
                        {grid.dates.map((d) => (
                          <td key={d} className="!px-1 text-center">
                            <span
                              className={cx(
                                "mx-auto block h-2.5 w-2.5",
                                grid.isDone(h.id, d) ? "bg-ink" : "bg-line",
                              )}
                              title={`${h.name} · ${d} · ${grid.isDone(h.id, d) ? "done" : "not done"}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelBody>
          </Panel>
        </Section>
      ) : null}

      <Section title="Consistency" meta="Scaled to how long each habit has existed.">
        {stats.length === 0 ? (
          <EmptyState
            title="No habits yet"
            description="Pick the handful that actually move the pillars. More than eight is a list, not a system."
          />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Habit</th>
                    <th className="text-right">Target</th>
                    <th className="text-right">7 day</th>
                    <th className="text-right">30 day</th>
                    <th className="text-right">90 day</th>
                    <th className="text-right">Last done</th>
                    <th>Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => {
                    const habit = habits.find((h) => h.id === s.habitId);
                    return (
                      <tr key={s.habitId}>
                        <td className="text-ink">{s.name}</td>
                        <td className="numeral text-right text-ink-faint">{s.targetPerWeek}×/wk</td>
                        <td className="numeral text-right text-ink-dim">
                          {s.consistency7 === null ? "—" : pct(s.consistency7)}
                        </td>
                        <td className="numeral text-right text-ink">
                          {s.consistency30 === null ? "—" : pct(s.consistency30)}
                        </td>
                        <td className="numeral text-right text-ink-dim">
                          {s.consistency90 === null ? "—" : pct(s.consistency90)}
                        </td>
                        <td className="numeral text-right text-ink-faint">
                          {s.lastDone ? `${formatDayShort(s.lastDone)}${s.daysSince === 0 ? " · today" : ""}` : "—"}
                        </td>
                        <td>{habit ? <HabitRowControls habit={habit} /> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </Section>

      <Section title="New habit">
        <Disclosure label="Add a habit" defaultOpen={habits.length === 0}>
          <HabitForm />
        </Disclosure>
      </Section>
    </div>
  );
}
