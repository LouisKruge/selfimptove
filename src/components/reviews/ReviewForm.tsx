"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openReview, reopenReview, saveReview } from "@/lib/actions/system";
import type { ReviewKind, Trend } from "@/lib/types";
import { ActionForm, SubmitButton } from "../forms";
import { cx } from "../primitives";

export interface Question {
  key: string;
  label: string;
  hint?: string;
  kind: "text" | "long" | "verdict";
}

const VERDICTS: Array<{ value: Trend; label: string; glyph: string }> = [
  { value: "UP", label: "Up", glyph: "↑" },
  { value: "FLAT", label: "Flat", glyph: "→" },
  { value: "DOWN", label: "Down", glyph: "↓" },
];

/**
 * A review is not a form to fill in — it is the moment the week is allowed to
 * teach you something. It cannot be completed with questions left blank.
 */
export function ReviewForm({
  reviewId,
  questions,
  answers,
  complete,
}: {
  reviewId: string;
  questions: Question[];
  answers: Record<string, string>;
  complete: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(answers);

  return (
    <ActionForm
      action={async (form) => {
        form.set("id", reviewId);
        return await saveReview(form);
      }}
      className="space-y-6"
    >
      {questions.map((q) => (
        <div key={q.key} className="panel p-4 sm:p-5">
          <div className="label mb-1">{q.label}</div>
          {q.hint ? <p className="mb-3 text-[0.6875rem] text-ink-ghost">{q.hint}</p> : null}

          {q.kind === "verdict" ? (
            <div className="mt-3 flex gap-1.5">
              {VERDICTS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  onClick={() => setValues({ ...values, [q.key]: v.value })}
                  className={cx(
                    "flex items-center gap-2 border px-3 py-2 text-xs transition-colors",
                    values[q.key] === v.value
                      ? "border-ink bg-ink text-inverse"
                      : "border-line text-ink-faint hover:border-line-strong hover:text-ink-dim",
                  )}
                >
                  <span>{v.glyph}</span>
                  {v.label}
                </button>
              ))}
              <input type="hidden" name={`q_${q.key}`} value={values[q.key] ?? ""} />
            </div>
          ) : q.kind === "long" ? (
            <textarea
              name={`q_${q.key}`}
              rows={3}
              className="mt-3"
              defaultValue={answers[q.key] ?? ""}
              placeholder="Be specific. Vague reviews teach nothing."
            />
          ) : (
            <input name={`q_${q.key}`} className="mt-3" defaultValue={answers[q.key] ?? ""} />
          )}
        </div>
      ))}

      {/* The submitter's name/value decides whether this is a draft save or a
          completion, so completing is always a deliberate click. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SubmitButton variant="default">Save draft</SubmitButton>
        <SubmitButton name="complete" value="1">
          {complete ? "Save changes" : "Complete review"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

export function StartReviewButton({
  kind,
  date,
  label,
}: {
  kind: ReviewKind;
  date?: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const result = await openReview(kind, date);
        if (result.ok) router.push(`/reviews/${result.data.id}`);
        setPending(false);
      }}
      className="btn"
    >
      {pending ? "···" : label}
    </button>
  );
}

export function ReopenButton({ reviewId }: { reviewId: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await reopenReview(reviewId);
        setPending(false);
      }}
      className="btn btn-ghost"
    >
      Reopen
    </button>
  );
}
