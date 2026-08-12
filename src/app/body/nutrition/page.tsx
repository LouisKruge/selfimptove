import Link from "next/link";
import { addDays, formatCommandDate, today } from "@/lib/core/date";
import { num } from "@/lib/core/format";
import { mealPresets, nutritionDay, nutritionTrend } from "@/lib/services/body";
import {
  AlertCard,
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
import {
  DeleteMealButton,
  MealForm,
  NutritionTargetForm,
  PresetButtons,
  WaterForm,
} from "@/components/training/BodyForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nutrition" };

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string; date?: string }>;
}) {
  const params = await searchParams;
  const day = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today();

  const n = nutritionDay(day);
  const trend = nutritionTrend(28, day);
  const presets = mealPresets();

  const consumed = n.log ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, water_ml: 0 };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Body"
        title="Nutrition"
        description="Fuel is a performance input. Intake is compared to the target you set and to what your bodyweight actually did."
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/body/nutrition?date=${addDays(day, -1)}`} className="btn btn-ghost">←</Link>
            <span className="label px-1">{formatCommandDate(day)}</span>
            <Link href={`/body/nutrition?date=${addDays(day, 1)}`} className="btn btn-ghost">→</Link>
          </div>
        }
      />

      {n.target ? (
        <Panel>
          <PanelBody className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <ProgressBar
                  value={n.proteinPct}
                  label="Protein"
                  right={`${Math.round(consumed.protein_g)} / ${n.target.protein_g}g`}
                  height="lg"
                />
              </div>
              <div>
                <ProgressBar
                  value={n.caloriePct}
                  label="Calories"
                  right={`${num(consumed.calories)} / ${num(n.target.calories)}`}
                  height="lg"
                />
              </div>
              <div>
                <ProgressBar
                  value={n.target.carbs_g > 0 ? (consumed.carbs_g / n.target.carbs_g) * 100 : null}
                  label="Carbohydrate"
                  right={`${Math.round(consumed.carbs_g)} / ${n.target.carbs_g}g`}
                  height="lg"
                />
              </div>
              <div>
                <ProgressBar
                  value={n.target.fat_g > 0 ? (consumed.fat_g / n.target.fat_g) * 100 : null}
                  label="Fat"
                  right={`${Math.round(consumed.fat_g)} / ${n.target.fat_g}g`}
                  height="lg"
                />
              </div>
            </div>

            {n.remaining ? (
              <div className="hairline pt-5">
                <KpiGrid cols={5}>
                  <Kpi
                    label="Calories left"
                    value={num(Math.max(0, n.remaining.calories))}
                    tone={n.remaining.calories < 0 ? "attention" : "default"}
                  />
                  <Kpi
                    label="Protein left"
                    value={`${Math.max(0, Math.round(n.remaining.protein_g))}g`}
                  />
                  <Kpi label="Fibre" value={`${Math.round(consumed.fiber_g)}g`} detail={n.target.fiber_g ? `of ${n.target.fiber_g}g` : undefined} />
                  <Kpi
                    label="Water"
                    value={`${(consumed.water_ml / 1000).toFixed(1)}L`}
                    detail={n.target.water_ml ? `of ${(n.target.water_ml / 1000).toFixed(1)}L` : undefined}
                  />
                  <Kpi label="Goal" value={n.target.goal.replace("_", " ")} />
                </KpiGrid>
              </div>
            ) : null}
          </PanelBody>
        </Panel>
      ) : (
        <EmptyState
          title="No nutrition target"
          description="Set calories and protein first — without a target, intake cannot be measured against anything."
        />
      )}

      {trend.verdict === "OFF_TREND" ? (
        <AlertCard severity="ATTENTION" title="Intake and bodyweight disagree" body={trend.message} />
      ) : trend.verdict === "ON_TRACK" ? (
        <AlertCard severity="INFO" title="On track" body={trend.message} />
      ) : (
        <AlertCard severity="INFO" title="Trend" body={trend.message} />
      )}

      <Section title="Log" meta="Two taps for anything you eat often.">
        <Panel>
          <PanelBody className="space-y-6">
            <PresetButtons presets={presets} date={day} />
            <div className="hairline pt-5">
              <Disclosure label="Log a meal" defaultOpen={params.quick === "meal"}>
                <MealForm date={day} />
              </Disclosure>
            </div>
            <div className="hairline max-w-xs pt-5">
              <WaterForm date={day} />
            </div>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Today's meals" meta={`${n.meals.length} logged`}>
        {n.meals.length === 0 ? (
          <EmptyState compact title="Nothing logged" description="No meals recorded for this day." />
        ) : (
          <Panel>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>Meal</th>
                    <th>Slot</th>
                    <th className="text-right">kcal</th>
                    <th className="text-right">P</th>
                    <th className="text-right">C</th>
                    <th className="text-right">F</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {n.meals.map((m) => (
                    <tr key={m.id}>
                      <td className="text-ink">{m.name}</td>
                      <td>
                        <Badge tone="muted">{m.slot}</Badge>
                      </td>
                      <td className="numeral text-right text-ink-dim">{m.calories}</td>
                      <td className="numeral text-right text-ink-dim">{Math.round(m.protein_g)}</td>
                      <td className="numeral text-right text-ink-faint">{Math.round(m.carbs_g)}</td>
                      <td className="numeral text-right text-ink-faint">{Math.round(m.fat_g)}</td>
                      <td className="text-right">
                        <DeleteMealButton mealId={m.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        )}
      </Section>

      <Section title="28-day trend">
        <Panel>
          <PanelBody>
            <KpiGrid cols={4}>
              <Kpi
                label="Average calories"
                value={trend.avgCalories === null ? "—" : num(trend.avgCalories)}
                detail={trend.calorieGap === null ? undefined : `${trend.calorieGap > 0 ? "+" : ""}${trend.calorieGap} vs target`}
              />
              <Kpi
                label="Average protein"
                value={trend.avgProtein === null ? "—" : `${trend.avgProtein}g`}
                detail={trend.proteinGap === null ? undefined : `${trend.proteinGap > 0 ? "+" : ""}${trend.proteinGap}g vs target`}
              />
              <Kpi
                label="Observed trend"
                value={trend.observedWeeklyKg === null ? "—" : `${trend.observedWeeklyKg > 0 ? "+" : ""}${trend.observedWeeklyKg}kg`}
                detail="per week"
              />
              <Kpi label="Logging rate" value={`${trend.loggingRate}%`} detail={`${trend.loggedDays} of 28 days`} />
            </KpiGrid>
            <p className="mt-6 text-xs leading-relaxed text-ink-faint">
              {trend.message} This is a description of your own logged data, not medical advice.
            </p>
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Targets">
        <Disclosure label="Set nutrition targets" defaultOpen={!n.target}>
          <NutritionTargetForm date={day} target={n.target} />
        </Disclosure>
      </Section>
    </div>
  );
}
