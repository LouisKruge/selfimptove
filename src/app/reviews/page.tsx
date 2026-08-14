import Link from "next/link";
import { formatDay, monthLabel, today } from "@/lib/core/date";
import {
  listReviews,
  outstandingReviews,
  periodFor,
  reviewAnswers,
  REVIEW_QUESTIONS,
} from "@/lib/services/reviews";
import {
  AlertCard,
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Section,
} from "@/components/primitives";
import { StartReviewButton } from "@/components/reviews/ReviewForm";
import type { ReviewKind } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reviews" };

const KINDS: Array<{ kind: ReviewKind; title: string; description: string }> = [
  {
    kind: "DAILY",
    title: "Daily",
    description: "What did I accomplish? What did I miss? Why? What matters tomorrow?",
  },
  {
    kind: "WEEKLY",
    title: "Weekly",
    description: "What improved, what declined, what worked, what wasted time — and what changes.",
  },
  {
    kind: "MONTHLY",
    title: "Monthly",
    description: "Each pillar up, flat or down. Biggest win, biggest failure, biggest lesson.",
  },
  {
    kind: "NINETY_DAY",
    title: "90-day",
    description: "Day 1 against day 90. Did life materially improve? If not, the strategy changes.",
  },
];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const params = await searchParams;
  const day = today();
  const reviews = await listReviews();
  const outstanding = await outstandingReviews(day);
  const periods = new Map(
    await Promise.all(KINDS.map(async (k) => [k.kind, await periodFor(k.kind, day)] as const)),
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Growth"
        title="Reviews"
        description="A week without a review is a week that taught you nothing. Each review freezes the metrics of its period alongside your answers."
      />

      {outstanding.length > 0 ? (
        <div className="space-y-px">
          {outstanding.map((o) => (
            <AlertCard
              key={`${o.kind}-${o.start}`}
              severity="ATTENTION"
              title={`${o.label} is outstanding`}
              body="Close it out before the next period absorbs it."
            />
          ))}
        </div>
      ) : null}

      <Section title="Start a review">
        <div className="grid gap-px sm:grid-cols-2">
          {KINDS.map((k) => {
            const period = periods.get(k.kind)!;
            return (
              <Panel key={k.kind}>
                <PanelBody className="flex h-full flex-col gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-ink">{k.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-ink-faint">{k.description}</p>
                    <p className="mt-3 text-[0.6875rem] text-ink-ghost">
                      Current period {formatDay(period.start)} → {formatDay(period.end)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StartReviewButton kind={k.kind} label={`Open ${k.title.toLowerCase()}`} />
                    {k.kind === "DAILY" ? (
                      <StartReviewButton
                        kind="DAILY"
                        date={outstanding.find((o) => o.kind === "DAILY")?.start}
                        label="Yesterday"
                      />
                    ) : null}
                    {k.kind === "WEEKLY" || k.kind === "MONTHLY" ? (
                      <StartReviewButton
                        kind={k.kind}
                        date={outstanding.find((o) => o.kind === k.kind)?.start}
                        label="Last period"
                      />
                    ) : null}
                  </div>
                </PanelBody>
              </Panel>
            );
          })}
        </div>
      </Section>

      <Section title="History" meta={`${reviews.length} recorded`}>
        {reviews.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            description="The review is where execution becomes feedback and feedback becomes improvement. Without it the loop never closes."
          />
        ) : (
          <div className="space-y-px">
            {reviews.map((r) => {
              const answers = reviewAnswers(r);
              const questions = REVIEW_QUESTIONS[r.kind];
              const answered = questions.filter((q) => answers[q.key]).length;
              const first = questions.find((q) => answers[q.key] && q.kind !== "verdict");
              return (
                <Link
                  key={r.id}
                  href={`/reviews/${r.id}`}
                  className="panel block p-4 transition-colors hover:border-line-strong sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="label">{r.kind.replace("_", " ")}</span>
                        <Badge tone={r.status === "COMPLETE" ? "positive" : "muted"}>{r.status}</Badge>
                      </div>
                      <div className="text-sm text-ink">
                        {r.kind === "MONTHLY"
                          ? monthLabel(r.period_start)
                          : r.kind === "DAILY"
                            ? formatDay(r.period_start)
                            : `${formatDay(r.period_start)} → ${formatDay(r.period_end)}`}
                      </div>
                      {first ? (
                        <p className="mt-2 line-clamp-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
                          {answers[first.key]}
                        </p>
                      ) : null}
                    </div>
                    <span className="numeral flex-none text-[0.6875rem] text-ink-faint">
                      {answered}/{questions.length} answered
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Section>
    </div>
  );
}
