import type { ScoredPillar, Trend } from "@/lib/types";
import { SCORED_PILLARS } from "@/lib/types";
import { round } from "./stats";

/**
 * BALANCE ENGINE
 *
 * The point is not to maximise one pillar at the cost of the rest. This looks
 * for the pattern "one area climbing while another falls" and states it plainly.
 */

export interface PillarSnapshot {
  pillar: ScoredPillar;
  score: number | null;
  trend: Trend | null;
}

export interface BalanceFinding {
  severity: "INFO" | "ATTENTION" | "CRITICAL";
  headline: string;
  detail: string;
  pillars: ScoredPillar[];
}

export interface BalanceResult {
  spread: number | null;
  strongest: PillarSnapshot | null;
  weakest: PillarSnapshot | null;
  findings: BalanceFinding[];
}

const NAME: Record<ScoredPillar, string> = {
  BODY: "Body",
  BUSINESS: "Business",
  CHARACTER: "Character",
  FINANCE: "Finance",
  LEARNING: "Learning",
};

export function analyseBalance(snapshots: readonly PillarSnapshot[]): BalanceResult {
  const scored = snapshots.filter(
    (s): s is PillarSnapshot & { score: number } => s.score !== null,
  );

  if (scored.length < 2) {
    return { spread: null, strongest: null, weakest: null, findings: [] };
  }

  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const spread = round(strongest.score - weakest.score, 1);

  const findings: BalanceFinding[] = [];

  const rising = scored.filter((s) => s.trend === "UP");
  const falling = scored.filter((s) => s.trend === "DOWN");

  if (rising.length > 0 && falling.length > 0) {
    findings.push({
      severity: "ATTENTION",
      headline: "Progress is being traded, not compounded",
      detail: `${list(rising.map((r) => NAME[r.pillar]))} ${rising.length === 1 ? "is" : "are"} improving while ${list(
        falling.map((f) => NAME[f.pillar]),
      )} ${falling.length === 1 ? "is" : "are"} declining.`,
      pillars: [...rising, ...falling].map((s) => s.pillar),
    });
  }

  if (spread >= 40) {
    findings.push({
      severity: spread >= 55 ? "CRITICAL" : "ATTENTION",
      headline: `${spread} point spread across pillars`,
      detail: `${NAME[strongest.pillar]} is at ${strongest.score} while ${NAME[weakest.pillar]} is at ${weakest.score}.`,
      pillars: [strongest.pillar, weakest.pillar],
    });
  }

  for (const s of scored) {
    if (s.score < 40) {
      findings.push({
        severity: "CRITICAL",
        headline: `${NAME[s.pillar]} is failing`,
        detail: `Scoring ${s.score}. This pillar needs a deliberate correction, not more effort elsewhere.`,
        pillars: [s.pillar],
      });
    }
  }

  const missing = SCORED_PILLARS.filter(
    (p) => !snapshots.some((s) => s.pillar === p && s.score !== null),
  );
  if (missing.length > 0) {
    findings.push({
      severity: "INFO",
      headline: "Unmeasured pillars",
      detail: `${list(missing.map((p) => NAME[p]))} ${missing.length === 1 ? "has" : "have"} no logged data, so ${
        missing.length === 1 ? "it is" : "they are"
      } excluded from the overall score.`,
      pillars: missing,
    });
  }

  return { spread, strongest, weakest, findings };
}

function list(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export const PILLAR_NAME = NAME;
