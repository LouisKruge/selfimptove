"use client";

import { useState } from "react";
import type { SessionDetail } from "@/lib/services/body";
import { LiveExercisePanel } from "./LiveExercise";

/** Keeps one exercise expanded at a time so the screen never asks two questions. */
export function LiveSession({ detail }: { detail: SessionDetail }) {
  const firstIncomplete = detail.exercises.findIndex(
    (e) => e.sets.filter((s) => !s.is_warmup).length < e.sessionExercise.target_sets,
  );
  const [active, setActive] = useState<string | null>(
    detail.exercises[firstIncomplete >= 0 ? firstIncomplete : 0]?.sessionExercise.id ?? null,
  );

  return (
    <div className="space-y-px">
      {detail.exercises.map((e, i) => (
        <LiveExercisePanel
          key={e.sessionExercise.id}
          data={e}
          index={i}
          active={active === e.sessionExercise.id}
          onActivate={() =>
            setActive(active === e.sessionExercise.id ? null : e.sessionExercise.id)
          }
        />
      ))}
    </div>
  );
}
