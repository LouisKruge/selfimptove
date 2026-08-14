import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDay, monthLabel } from "@/lib/core/date";
import { km, money, num } from "@/lib/core/format";
import {
  getReview,
  ninetyDayComparison,
  reviewAnswers,
  reviewSnapshot,
  storedSnapshot,
  REVIEW_QUESTIONS,
} from "@/lib/services/reviews";
import { PILLAR_NAME } from "@/lib/domain/balance";
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
  TrendGlyph,
} from "@/components/primitives";
import { ReopenButton, ReviewForm } from "@/components/reviews/ReviewForm";

export const dynamic = "force-dynamic";

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await getReview(id);
  if (!review) notFound();

  const answers = reviewAnswers(review);
  const questions = REVIEW_QUESTIONS[review.kind];
  const snapshot =
    storedSnapshot(review) ?? await reviewSnapshot(review.kind, review.period_start, review.period_end);
  const complete = review.status === "COMPLETE";
  const ninety =
    review.kind === "NINETY_DAY"
      ? await ninetyDayComparison(review.period_start, review.period_end)
      : null;

  const title =
    review.kind === "MONTHLY"
      ? monthLabel(review.period_start)
      : review.kind === "DAILY"
        ? formatDay(review.period_start)
        : `${formatDay(review.period_start)} → ${formatDay(review.period_end)}`;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`${review.kind.replace("_", " ")} review`}
        title={title}
        actions={
          <>
            <Badge tone={complete ? "positive" : "muted"}>{review.status}</Badge>
            {complete ? <ReopenButton reviewId={review.id} /> : null}
            <Link href="/reviews" className="btn btn-ghost">
              Reviews
            </Link>
          </>
        }
      />

      {/* ------------------------------------------------------- THE NUMBERS */}
      <Section title="What the data says" meta={`${snapshot.scoredDays} scored days in this period`}>
        <Panel>
          <PanelBody className="space-y-6">
            <KpiGrid cols={5}>
              {snapshot.pillars.map((p) => (
                <div key={p.pillar}>
                  <div className="label">{PILLAR_NAME[p.pillar]}</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="numeral text-lg font-medium text-ink">
                      {p.average === null ? "—" : p.average}
                    </span>
                    <TrendGlyph trend={p.verdict} />
                  </div>
                  <div className="mt-1.5 text-[0.625rem] text-ink-faint">
                    {p.start === null || p.end === null
                      ? "not enough data"
                      : `${p.start} → ${p.end}`}
                  </div>
                </div>
              ))}
            </KpiGrid>

            <div className="hairline pt-6">
              <KpiGrid cols={4}>
                <Kpi label="Sessions" value={snapshot.sessionsCompleted} />
                <Kpi label="Distance run" value={snapshot.distanceM > 0 ? km(snapshot.distanceM) : "—"} />
                <Kpi
                  label="Tasks complete"
                  value={snapshot.tasksCompleted}
                  detail={`${snapshot.mustWinsCompleted} must-wins`}
                />
                <Kpi label="Learning" value={`${Math.round(snapshot.learningMinutes / 6) / 10}h`} />
              </KpiGrid>
            </div>

            <div className="hairline pt-6">
              <KpiGrid cols={4}>
                <Kpi label="Revenue" value={money(snapshot.revenueCents)} />
                <Kpi
                  label="Income / spend"
                  value={`${money(snapshot.incomeCents)} / ${money(snapshot.expensesCents)}`}
                />
                <Kpi label="Net worth" value={money(snapshot.netWorthCents)} />
                <Kpi
                  label="Promise rate"
                  value={snapshot.promiseRate === null ? "—" : `${snapshot.promiseRate}%`}
                />
              </KpiGrid>
            </div>

            {snapshot.missionProgress !== null ? (
              <p className="hairline pt-6 text-xs text-ink-faint">
                Mission progress at the end of this period: {snapshot.missionProgress}%.
              </p>
            ) : null}
          </PanelBody>
        </Panel>
      </Section>

      {/* ------------------------------------------------------ 90-DAY DELTA */}
      {ninety ? (
        <Section title="Day 1 vs Day 90" meta="First and last week of the window, averaged.">
          <Panel>
            <PanelBody>
              {!ninety.hasData ? (
                <EmptyState
                  compact
                  title="Not enough scored days"
                  description={`Only ${ninety.scoredDays} days have scores. A 90-day verdict needs at least 14.`}
                />
              ) : (
                <>
                  <KpiGrid cols={5}>
                    {ninety.pillars.map((p) => (
                      <div key={p.pillar}>
                        <div className="label">{PILLAR_NAME[p.pillar]}</div>
                        <div className="numeral mt-2 text-lg font-medium text-ink">
                          {p.from ?? "—"} → {p.to ?? "—"}
                        </div>
                        <div className="mt-1.5 text-[0.625rem] text-ink-faint">
                          {p.delta === null ? "—" : `${p.delta > 0 ? "+" : ""}${p.delta}`}
                        </div>
                      </div>
                    ))}
                  </KpiGrid>
                  <p className="hairline mt-6 pt-6 text-sm leading-relaxed text-ink-dim">
                    Overall {ninety.overallFrom ?? "—"} → {ninety.overallTo ?? "—"}.{" "}
                    {ninety.overallFrom !== null && ninety.overallTo !== null
                      ? ninety.overallTo > ninety.overallFrom
                        ? "The system produced improvement. Continue and refine."
                        : "The system did not produce improvement. Change the strategy, not the effort."
                      : ""}
                  </p>
                </>
              )}
            </PanelBody>
          </Panel>
        </Section>
      ) : null}

      {/* ---------------------------------------------------------- ANSWERS */}
      <Section title={complete ? "Your answers" : "Answer honestly"}>
        <ReviewForm
          reviewId={review.id}
          questions={questions}
          answers={answers}
          complete={complete}
        />
      </Section>
    </div>
  );
}
