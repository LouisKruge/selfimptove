import Link from "next/link";
import { formatDay, formatDayShort, today } from "@/lib/core/date";
import { all } from "@/lib/db";
import { listReviews, reviewAnswers, REVIEW_QUESTIONS } from "@/lib/services/reviews";
import { createNote, deleteNote } from "@/lib/actions/self";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Section,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { NoteForm } from "@/components/character/NoteForm";
import { DeleteRowButton } from "@/components/business/BusinessForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reflection" };

export default async function ReflectionPage() {
  const notes = all<{ id: string; title: string | null; body: string; pillar: string | null; created_at: string }>(
    "SELECT id, title, body, pillar, created_at FROM notes WHERE entity_type IS NULL ORDER BY created_at DESC LIMIT 60",
  );
  const reviews = listReviews().filter((r) => r.status === "COMPLETE").slice(0, 12);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Character"
        title="Reflection"
        description="Thinking that is written down can be revisited. Thinking that is not, cannot."
        actions={<Link href="/reviews" className="btn btn-ghost">Reviews</Link>}
      />

      <Section title="Write">
        <Disclosure label="New note" defaultOpen={notes.length === 0}>
          <NoteForm />
        </Disclosure>
      </Section>

      <Section title="Notes" meta={`${notes.length} recorded`}>
        {notes.length === 0 ? (
          <EmptyState
            title="Nothing written"
            description="Reflection is where lessons get extracted from experience. Without it, the same mistakes stay affordable."
          />
        ) : (
          <div className="space-y-px">
            {notes.map((n) => (
              <Panel key={n.id}>
                <PanelBody className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {n.title ? <div className="mb-2 text-sm text-ink">{n.title}</div> : null}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-dim">{n.body}</p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <span className="text-[0.6875rem] text-ink-faint">
                          {formatDayShort(n.created_at.slice(0, 10))}
                        </span>
                        {n.pillar ? <Badge tone="muted">{n.pillar}</Badge> : null}
                      </div>
                    </div>
                    <DeleteRowButton action={deleteNote.bind(null, n.id)} />
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        )}
      </Section>

      {reviews.length > 0 ? (
        <Section title="Completed reviews" meta={`${reviews.length} most recent`}>
          <div className="space-y-px">
            {reviews.map((r) => {
              const answers = reviewAnswers(r);
              const questions = REVIEW_QUESTIONS[r.kind];
              const first = questions.find((q) => answers[q.key]);
              return (
                <Link key={r.id} href={`/reviews/${r.id}`} className="panel block p-4 transition-colors hover:border-line-strong sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="label mb-2">
                        {r.kind.replace("_", " ")} · {formatDay(r.period_start)}
                      </div>
                      {first ? (
                        <p className="line-clamp-2 text-sm leading-relaxed text-ink-dim">
                          {answers[first.key]}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone="positive">Complete</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </Section>
      ) : null}
    </div>
  );
}
