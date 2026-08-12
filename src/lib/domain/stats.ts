/** Shared numeric primitives. Pure, dependency-free, unit-tested. */

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function sum(xs: readonly number[]): number {
  let t = 0;
  for (const x of xs) t += x;
  return t;
}

export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  return sum(xs) / xs.length;
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function stdev(xs: readonly number[]): number | null {
  const m = mean(xs);
  if (m === null || xs.length < 2) return null;
  return Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1));
}

export function min(xs: readonly number[]): number | null {
  return xs.length ? Math.min(...xs) : null;
}

export function max(xs: readonly number[]): number | null {
  return xs.length ? Math.max(...xs) : null;
}

/**
 * Percentage change from `a` to `b`. Returns null when a baseline of zero makes
 * the ratio meaningless — COMMAND shows "—" rather than a fabricated ∞.
 */
export function pctChange(a: number, b: number): number | null {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === 0) return null;
  return ((b - a) / Math.abs(a)) * 100;
}

/** Progress toward a target as 0–100, honouring goal direction. */
export function progressPct(opts: {
  start: number | null | undefined;
  current: number | null | undefined;
  target: number | null | undefined;
  direction?: "UP" | "DOWN";
}): number | null {
  const { current, target } = opts;
  if (current === null || current === undefined) return null;
  if (target === null || target === undefined) return null;
  const direction = opts.direction ?? "UP";
  const start = opts.start ?? (direction === "UP" ? 0 : target * 2);

  const span = target - start;
  if (span === 0) return current === target ? 100 : 0;
  const done = ((current - start) / span) * 100;
  return clamp(done, 0, 100);
}

/** Least-squares slope of y over evenly-indexed x. Null under 3 points. */
export function slope(ys: readonly number[]): number | null {
  const n = ys.length;
  if (n < 3) return null;
  const xs = Array.from({ length: n }, (_, i) => i);
  const mx = (n - 1) / 2;
  const my = sum(ys) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

/** Simple moving average; windows shorter than `w` are averaged as-is. */
export function movingAverage(xs: readonly number[], w: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const from = Math.max(0, i - w + 1);
    const win = xs.slice(from, i + 1);
    out.push(sum(win) / win.length);
  }
  return out;
}

/** Weighted average that ignores null components and renormalises weights. */
export function weightedAverage(
  parts: ReadonlyArray<{ value: number | null | undefined; weight: number }>,
): number | null {
  let total = 0;
  let weight = 0;
  for (const p of parts) {
    if (p.value === null || p.value === undefined || !Number.isFinite(p.value)) continue;
    if (p.weight <= 0) continue;
    total += p.value * p.weight;
    weight += p.weight;
  }
  if (weight === 0) return null;
  return total / weight;
}

export function round(v: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** Rounds a barbell load to the nearest achievable increment. */
export function roundToIncrement(kg: number, increment: number): number {
  if (increment <= 0) return round(kg, 2);
  return round(Math.round(kg / increment) * increment, 2);
}
