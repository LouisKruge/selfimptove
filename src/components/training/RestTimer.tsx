"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clock } from "@/lib/core/format";
import { cx } from "../primitives";

/**
 * REST TIMER
 *
 * Starts automatically when a set is completed. Pause, skip, add or remove time.
 * Counts from a wall-clock deadline so a backgrounded tab stays accurate.
 */
export function RestTimer({
  seconds,
  runKey,
  onComplete,
}: {
  seconds: number;
  /** Changing this restarts the timer — the id of the set just completed. */
  runKey: string | null;
  onComplete?: () => void;
  }) {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(seconds);
  const [paused, setPaused] = useState(false);
  const pausedAt = useRef<number | null>(null);
  const lastKey = useRef<string | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (runKey === null || runKey === lastKey.current) return;
    lastKey.current = runKey;
    fired.current = false;
    setPaused(false);
    pausedAt.current = null;
    setDeadline(Date.now() + seconds * 1000);
    setRemaining(seconds);
  }, [runKey, seconds]);

  useEffect(() => {
    if (deadline === null || paused) return;
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !fired.current) {
        fired.current = true;
        onComplete?.();
        // A short vibration where supported; never a sound.
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(180);
        }
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [deadline, paused, onComplete]);

  const adjust = useCallback(
    (delta: number) => {
      setDeadline((d) => {
        if (d === null) return Date.now() + Math.max(5, seconds + delta) * 1000;
        return Math.max(Date.now(), d + delta * 1000);
      });
    },
    [seconds],
  );

  const togglePause = () => {
    if (paused) {
      const heldFor = pausedAt.current ? Date.now() - pausedAt.current : 0;
      setDeadline((d) => (d === null ? null : d + heldFor));
      pausedAt.current = null;
      setPaused(false);
    } else {
      pausedAt.current = Date.now();
      setPaused(true);
    }
  };

  const running = deadline !== null && remaining > 0;
  const pct = deadline === null ? 0 : ((seconds - remaining) / seconds) * 100;

  return (
    <div className="panel-sunken px-4 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <span className="label">Rest</span>
          <span
            className={cx(
              "numeral text-3xl font-medium leading-none tabular-nums",
              running ? "text-ink" : remaining === 0 && deadline !== null ? "text-positive" : "text-ink-ghost",
            )}
          >
            {clock(remaining)}
          </span>
          {paused ? <span className="label">Paused</span> : null}
        </div>

        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => adjust(-15)} className="btn" title="Reduce 15 seconds">
            −15
          </button>
          <button type="button" onClick={() => adjust(15)} className="btn" title="Add 15 seconds">
            +15
          </button>
          <button type="button" onClick={togglePause} className="btn" disabled={deadline === null}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDeadline(null);
              setRemaining(0);
              setPaused(false);
            }}
            className="btn btn-ghost"
          >
            Skip
          </button>
        </div>
      </div>

      <div className="mt-3 h-px w-full bg-line" aria-hidden>
        <div
          className="h-px bg-ink transition-[width] duration-300 ease-linear"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}
