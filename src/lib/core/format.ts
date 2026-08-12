/**
 * Display formatting. Money is stored as integer cents everywhere; nothing in
 * COMMAND does arithmetic on formatted strings.
 */

export const CURRENCY_SYMBOL = "R";

/** R150,000 — no decimals, the default for headline figures. */
export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  const negative = cents < 0;
  const value = Math.round(Math.abs(cents) / 100);
  return `${negative ? "−" : ""}${CURRENCY_SYMBOL}${group(value)}`;
}

/** R150,000.00 — for ledgers where cents matter. */
export function moneyExact(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "−" : ""}${CURRENCY_SYMBOL}${group(whole)}.${frac}`;
}

/** Compact money for dense tiles: R1.2m / R150k / R840 */
export function moneyCompact(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || !Number.isFinite(cents)) return "—";
  const sign = cents < 0 ? "−" : "";
  const v = Math.abs(cents) / 100;
  if (v >= 1_000_000) return `${sign}${CURRENCY_SYMBOL}${trim(v / 1_000_000)}m`;
  if (v >= 1_000) return `${sign}${CURRENCY_SYMBOL}${trim(v / 1_000)}k`;
  return `${sign}${CURRENCY_SYMBOL}${group(Math.round(v))}`;
}

function trim(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}

export function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function num(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const fixed = n.toFixed(decimals);
  const [whole, frac] = fixed.split(".");
  const signed = whole.startsWith("-") ? `−${group(Math.abs(Number(whole)))}` : group(Number(whole));
  return frac ? `${signed}.${frac}` : signed;
}

/** 84 → "84%" */
export function pct(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${num(n, decimals)}%`;
}

export function signed(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n === 0) return num(0, decimals);
  return `${n > 0 ? "+" : "−"}${num(Math.abs(n), decimals)}`;
}

/** 92.5 → "92.5", 90 → "90" */
export function kg(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

export function kgLabel(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${kg(v)}kg`;
}

/** 4530 → "1:15:30"; 330 → "5:30" */
export function duration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) {
    return "—";
  }
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Rest-timer style, always mm:ss. */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** 270 sec/km → "4:30/km" */
export function pace(secPerKm: number | null | undefined): string {
  if (secPerKm === null || secPerKm === undefined || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return "—";
  }
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}/km`;
}

/** 8000 → "8.0km"; 800 → "800m" */
export function distance(metres: number | null | undefined): string {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) return "—";
  if (metres >= 1000) {
    const km = metres / 1000;
    return `${Number.isInteger(km) ? km : km.toFixed(km >= 10 ? 1 : 2)}km`;
  }
  return `${Math.round(metres)}m`;
}

export function km(metres: number | null | undefined, decimals = 1): string {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) return "—";
  return `${(metres / 1000).toFixed(decimals)}km`;
}

/** Human label for enum-ish constants: MUST_WIN → "Must Win" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function upperLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").toUpperCase();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}
