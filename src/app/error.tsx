"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-8">
      <header className="border-b border-line pb-6">
        <div className="label mb-2.5">Error</div>
        <h1 className="headline text-ink">Something failed on this screen</h1>
      </header>

      <div className="panel p-5">
        <p className="text-sm leading-relaxed text-ink-dim">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest ? (
          <p className="numeral mt-3 text-[0.6875rem] text-ink-ghost">Digest {error.digest}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href="/" className="btn btn-ghost">
          Back to Command
        </Link>
      </div>
    </div>
  );
}
