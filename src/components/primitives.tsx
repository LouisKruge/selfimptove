import type { ReactNode } from "react";
import Link from "next/link";

/** Shared visual primitives. Every screen is built from these. */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ----------------------------------------------------------------- PANEL */

export function Panel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  return <Tag className={cx("panel min-w-0", className)}>{children}</Tag>;
}

export function PanelHeader({
  title,
  meta,
  action,
  className,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-4 border-b border-line px-4 py-3 sm:px-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="label-bright truncate">{title}</h2>
        {meta ? <div className="mt-1.5 text-xs text-ink-faint">{meta}</div> : null}
      </div>
      {action ? <div className="flex flex-none flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function PanelBody({
  children,
  className,
  flush,
}: {
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return <div className={cx(flush ? "" : "p-4 sm:p-5", className)}>{children}</div>;
}

/* ------------------------------------------------------------ PAGE FRAME */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="label mb-2.5">{eyebrow}</div> : null}
        <h1 className="headline text-ink">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({
  title,
  meta,
  action,
  children,
  className,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("min-w-0 space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="label-bright">{title}</h2>
          {meta ? <div className="mt-1.5 text-xs text-ink-faint">{meta}</div> : null}
        </div>
        {action ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------ METRIC CARD */

export type Tone = "default" | "critical" | "attention" | "positive";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-ink",
  critical: "text-critical",
  attention: "text-attention",
  positive: "text-positive",
};

export function MetricCard({
  label,
  value,
  unit,
  detail,
  trend,
  tone = "default",
  href,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  trend?: ReactNode;
  tone?: Tone;
  href?: string;
  size?: "sm" | "md" | "lg";
}) {
  const valueSize =
    size === "lg" ? "text-4xl sm:text-5xl" : size === "sm" ? "text-xl" : "text-2xl sm:text-3xl";

  const inner = (
    <>
      <div className="label">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className={cx("numeral font-medium leading-none", valueSize, TONE_TEXT[tone])}>
          {value}
        </span>
        {unit ? <span className="text-xs text-ink-faint">{unit}</span> : null}
        {trend ? <span className="ml-auto text-sm text-ink-dim">{trend}</span> : null}
      </div>
      {detail ? (
        <div className="mt-2.5 text-xs leading-relaxed text-ink-faint">{detail}</div>
      ) : null}
    </>
  );

  const className = cx(
    "panel p-4 sm:p-5 transition-colors",
    href && "hover:border-line-strong block",
  );

  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <div className={className}>{inner}</div>
  );
}

/* --------------------------------------------------------------- KPI ROW */

export function Kpi({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className={cx("numeral mt-2 text-lg font-medium leading-none", TONE_TEXT[tone])}>
        {value}
      </div>
      {detail ? <div className="mt-1.5 truncate text-xs text-ink-faint">{detail}</div> : null}
    </div>
  );
}

export function KpiGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 }) {
  const map = {
    2: "grid-cols-2",
    3: "grid-cols-2 sm:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  } as const;
  return <div className={cx("grid gap-x-4 gap-y-6", map[cols])}>{children}</div>;
}

/* ---------------------------------------------------------- PROGRESS BAR */

export function ProgressBar({
  value,
  label,
  right,
  tone = "default",
  height = "md",
  showTicks,
}: {
  value: number | null;
  label?: ReactNode;
  right?: ReactNode;
  tone?: Tone;
  height?: "sm" | "md" | "lg";
  /** Marks the point where the mission should be, based on elapsed time. */
  showTicks?: number | null;
}) {
  const pct = value === null ? null : Math.max(0, Math.min(100, value));
  const h = height === "lg" ? "h-2" : height === "sm" ? "h-px" : "h-1";
  const fill =
    tone === "critical"
      ? "bg-critical"
      : tone === "attention"
        ? "bg-attention"
        : tone === "positive"
          ? "bg-positive"
          : "bg-ink";

  return (
    <div className="w-full">
      {label || right ? (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="label">{label}</span>
          <span className="numeral text-xs text-ink-dim">{right}</span>
        </div>
      ) : null}
      <div className={cx("relative w-full bg-line-soft", h)} aria-hidden>
        {pct === null ? (
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,var(--color-line)_0_2px,transparent_2px_6px)]" />
        ) : (
          <div className={cx("absolute inset-y-0 left-0", fill)} style={{ width: `${pct}%` }} />
        )}
        {showTicks !== null && showTicks !== undefined ? (
          <div
            className="absolute inset-y-[-3px] w-px bg-ink-faint"
            style={{ left: `${Math.max(0, Math.min(100, showTicks))}%` }}
            title="Where elapsed time says you should be"
          />
        ) : null}
      </div>
    </div>
  );
}

/** ████████████░░░░ — the mission bar from the command brief. */
export function BlockBar({ value, width = 16 }: { value: number | null; width?: number }) {
  const filled = value === null ? 0 : Math.round((Math.max(0, Math.min(100, value)) / 100) * width);
  return (
    <span className="numeral select-none text-[0.7rem] leading-none tracking-[0.05em]">
      {value === null ? (
        <span className="text-ink-ghost">{"·".repeat(width)}</span>
      ) : (
        <>
          <span className="text-ink">{"█".repeat(filled)}</span>
          <span className="text-ink-ghost">{"░".repeat(width - filled)}</span>
        </>
      )}
    </span>
  );
}

/* ------------------------------------------------------------ PROGRESS RING */

export function ProgressRing({
  value,
  size = 96,
  stroke = 3,
  label,
  caption,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: ReactNode;
  caption?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        {value !== null ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="butt"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeral text-lg font-medium leading-none">
          {label ?? (value === null ? "—" : Math.round(value))}
        </span>
        {caption ? <span className="label mt-1">{caption}</span> : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- BADGE */

export function Badge({
  children,
  tone = "default",
  subtle,
}: {
  children: ReactNode;
  tone?: Tone | "muted";
  subtle?: boolean;
}) {
  const map: Record<string, string> = {
    default: "text-ink border-line-strong",
    muted: "text-ink-faint border-line",
    critical: "text-critical border-critical/40",
    attention: "text-attention border-attention/40",
    positive: "text-positive border-positive/40",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap border px-1.5 py-0.5 text-[0.5625rem] font-medium uppercase leading-none tracking-[0.14em]",
        map[tone],
        subtle && "border-transparent px-0",
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ TREND */

export function TrendGlyph({
  trend,
  className,
}: {
  trend: "UP" | "FLAT" | "DOWN" | null;
  className?: string;
}) {
  if (trend === null) {
    return (
      <span className={cx("text-ink-ghost", className)} title="Not enough data">
        ·
      </span>
    );
  }
  const glyph = trend === "UP" ? "↑" : trend === "DOWN" ? "↓" : "→";
  const tone =
    trend === "UP" ? "text-positive" : trend === "DOWN" ? "text-critical" : "text-ink-faint";
  return (
    <span className={cx(tone, className)} title={`Trending ${trend.toLowerCase()}`}>
      {glyph}
    </span>
  );
}

/* ------------------------------------------------------------ EMPTY STATE */

export function EmptyState({
  title,
  description,
  action,
  compact,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-start justify-center border border-dashed border-line",
        compact ? "gap-2 p-5" : "gap-3 p-8",
      )}
    >
      <div className="label-bright">{title}</div>
      {description ? (
        <p className="max-w-md text-sm leading-relaxed text-ink-faint">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------- ALERT CARD */

export function AlertCard({
  severity,
  title,
  body,
  href,
  action,
}: {
  severity: "INFO" | "ATTENTION" | "CRITICAL" | "WIN";
  title: string;
  body?: string | null;
  href?: string | null;
  action?: ReactNode;
}) {
  const rail =
    severity === "CRITICAL"
      ? "bg-critical"
      : severity === "ATTENTION"
        ? "bg-attention"
        : severity === "WIN"
          ? "bg-positive"
          : "bg-line-strong";

  const content = (
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium leading-snug text-ink">{title}</div>
      {body ? <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{body}</p> : null}
    </div>
  );

  return (
    <div className="panel flex gap-3.5 p-4 transition-colors hover:border-line-strong">
      <div className={cx("mt-0.5 w-px flex-none self-stretch", rail)} />
      {href ? (
        <Link href={href} className="min-w-0 flex-1">
          {content}
        </Link>
      ) : (
        content
      )}
      {action ? <div className="flex-none">{action}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------- DATA LIST */

export function DataRow({
  label,
  value,
  tone = "default",
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2.5 last:border-b-0">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className={cx("numeral text-sm text-right", TONE_TEXT[tone])}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------- NO-DATA CUE */

/** The single, consistent way COMMAND says "there is nothing here yet". */
export function NoData({ children }: { children?: ReactNode }) {
  return (
    <span className="text-ink-ghost" title={typeof children === "string" ? children : undefined}>
      —
    </span>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-ink-faint">{children}</p>;
}

/* ------------------------------------------------------------- SPARK LINE */

export function Sparkline({
  points,
  height = 32,
  width = 120,
  tone = "default",
}: {
  points: Array<number | null>;
  height?: number;
  width?: number;
  tone?: Tone;
}) {
  const values = points.map((p) => (p === null ? null : p));
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-[0.625rem] text-ink-ghost"
        style={{ height, width }}
      >
        insufficient data
      </div>
    );
  }

  const min = Math.min(...known);
  const max = Math.max(...known);
  const span = max - min || 1;
  const step = width / Math.max(1, values.length - 1);

  // Break the path wherever data is missing rather than interpolating over gaps.
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    const x = i * step;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    current.push(`${current.length === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  const stroke =
    tone === "critical"
      ? "var(--color-critical)"
      : tone === "positive"
        ? "var(--color-positive)"
        : "var(--color-ink-dim)";

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden>
      {segments.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={stroke} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------- BAR SERIES */

export function BarSeries({
  points,
  height = 56,
  format,
}: {
  points: Array<{ label: string; value: number | null }>;
  height?: number;
  format?: (v: number) => string;
}) {
  const known = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (known.length === 0) {
    return <EmptyState compact title="No data" description="Nothing has been recorded yet." />;
  }
  const max = Math.max(...known, 1);

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {points.map((p, i) => (
        <div key={i} className="group relative flex h-full flex-1 items-end" title={p.label}>
          {p.value === null ? (
            <div className="h-px w-full bg-line" />
          ) : (
            <div
              className="w-full bg-ink-ghost transition-colors group-hover:bg-ink-dim"
              style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
            />
          )}
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap border border-line bg-raised px-1.5 py-1 text-[0.625rem] text-ink group-hover:block">
            {p.label}
            {p.value !== null ? ` · ${format ? format(p.value) : p.value}` : " · no data"}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ TABLE */

export function TableWrap({ children }: { children: ReactNode }) {
  // Wide tables scroll inside their panel — the page itself never scrolls sideways.
  return <div className="scroll-x w-full max-w-full">{children}</div>;
}

/* ------------------------------------------------------------- LINE CHART */

/**
 * A full-width line for values where the *shape* matters more than the
 * magnitude — cash balance, net worth, score history. Scaled to the data's own
 * range, with the zero line drawn whenever it falls inside that range, so a
 * negative balance is unmistakable.
 */
/**
 * A single bar divided into its parts, with a legend that names each one.
 *
 * The right shape for a balance sheet or a spending breakdown: the question is
 * always "what is this made of, and which part dominates", which a stack answers
 * in one glance and a row of separate bars does not.
 *
 * Monochrome by design — segments are separated by luminance, in descending
 * order, so the largest part is the brightest. Colour is reserved for the one
 * thing that needs a human decision.
 */
export function CompositionBar({
  segments,
  format,
  emptyLabel = "Nothing recorded",
}: {
  segments: Array<{ label: string; value: number; tone?: Tone }>;
  format: (v: number) => string;
  emptyLabel?: string;
}) {
  const present = segments.filter((s) => s.value > 0);
  const total = present.reduce((t, s) => t + s.value, 0);

  if (total <= 0) {
    return <EmptyState compact title={emptyLabel} description="Nothing to break down yet." />;
  }

  // Brightest for the largest share, stepping down from there.
  const shades = ["bg-ink", "bg-ink-dim", "bg-ink-faint", "bg-ink-ghost", "bg-line-strong", "bg-line"];
  const ranked = [...present].sort((a, b) => b.value - a.value);

  return (
    <div className="min-w-0">
      <div className="flex h-3 w-full overflow-hidden rounded-[1px]">
        {ranked.map((s, i) => (
          <div
            key={s.label}
            className={cx(
              s.tone === "critical" ? "bg-critical" : shades[Math.min(i, shades.length - 1)],
            )}
            style={{ width: `${(s.value / total) * 100}%` }}
            title={`${s.label} — ${format(s.value)}`}
          />
        ))}
      </div>

      <div className="mt-4 space-y-0">
        {ranked.map((s, i) => (
          <div
            key={s.label}
            className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2 last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                className={cx(
                  "h-2 w-2 flex-none",
                  s.tone === "critical" ? "bg-critical" : shades[Math.min(i, shades.length - 1)],
                )}
              />
              <span className="truncate text-xs text-ink-faint">{s.label}</span>
            </span>
            <span className="flex flex-none items-baseline gap-3">
              <span className="numeral text-[0.6875rem] text-ink-ghost">
                {Math.round((s.value / total) * 100)}%
              </span>
              <span
                className={cx("numeral text-sm", s.tone === "critical" ? "text-critical" : "text-ink")}
              >
                {format(s.value)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Two series side by side per period — money in against money out.
 *
 * A single net figure hides whether a good month came from earning more or
 * spending less, and those call for different decisions.
 */
export function PairedBars({
  points,
  format,
  height = 72,
  labels = ["In", "Out"],
}: {
  points: Array<{ label: string; a: number; b: number }>;
  format: (v: number) => string;
  height?: number;
  labels?: [string, string] | string[];
}) {
  if (points.length === 0) {
    return <EmptyState compact title="No data" description="Nothing has been recorded yet." />;
  }
  const max = Math.max(...points.flatMap((p) => [p.a, p.b]), 1);

  return (
    <div className="min-w-0">
      <div
        className="flex items-end justify-around gap-3 border-b border-line-soft"
        style={{ height }}
      >
        {points.map((p) => (
          <div key={p.label} className="flex min-w-0 flex-1 items-end justify-center gap-[3px]">
            {/* Capped width: with two or three months an uncapped bar becomes a
                slab that reads as a block rather than a measurement. */}
            <div
              className="w-full max-w-[22px] bg-ink"
              style={{ height: `${Math.max((p.a / max) * height, p.a > 0 ? 2 : 0)}px` }}
              title={`${p.label} — ${labels[0]} ${format(p.a)}`}
            />
            <div
              className="w-full max-w-[22px] bg-ink-ghost"
              style={{ height: `${Math.max((p.b / max) * height, p.b > 0 ? 2 : 0)}px` }}
              title={`${p.label} — ${labels[1]} ${format(p.b)}`}
            />
          </div>
        ))}
      </div>

      <div className="mt-1.5 flex items-start justify-around gap-3">
        {points.map((p) => (
          <span
            key={p.label}
            className="numeral min-w-0 flex-1 truncate text-center text-[0.625rem] text-ink-ghost"
          >
            {p.label.slice(5)}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 text-[0.6875rem] text-ink-ghost">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 bg-ink" />
          {labels[0]}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 bg-ink-ghost" />
          {labels[1]}
        </span>
      </div>
    </div>
  );
}

export function LineChart({
  points,
  height = 96,
  format,
  showZero = true,
}: {
  points: Array<{ label: string; value: number | null }>;
  height?: number;
  format?: (v: number) => string;
  showZero?: boolean;
}) {
  const known = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (known.length < 2) {
    return (
      <EmptyState
        compact
        title="Not enough data"
        description="At least two recorded points are needed to draw a line."
      />
    );
  }

  const W = 1000;
  const H = height;
  const pad = 4;
  const rawMin = Math.min(...known);
  const rawMax = Math.max(...known);
  const min = showZero ? Math.min(0, rawMin) : rawMin;
  const max = Math.max(rawMax, min + 1);
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * W;
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);

  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
  });
  if (current.length > 1) segments.push(current.join(" "));

  const zeroY = y(0);
  const showZeroLine = showZero && min < 0 && max > 0;
  const last = points[points.length - 1];
  const first = points.find((p) => p.value !== null);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label="Trend line"
      >
        {showZeroLine ? (
          <line
            x1={0}
            x2={W}
            y1={zeroY}
            y2={zeroY}
            stroke="var(--color-critical)"
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {segments.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-2.5 flex items-baseline justify-between text-[0.625rem] text-ink-faint">
        <span className="numeral">
          {first?.label}
          {first?.value !== null && first?.value !== undefined && format
            ? ` · ${format(first.value)}`
            : ""}
        </span>
        <span className="numeral">
          low {format ? format(rawMin) : rawMin} · high {format ? format(rawMax) : rawMax}
        </span>
        <span className="numeral">
          {last?.label}
          {last?.value !== null && last?.value !== undefined && format
            ? ` · ${format(last.value)}`
            : ""}
        </span>
      </div>
    </div>
  );
}
