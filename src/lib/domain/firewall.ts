import type { DecisionLevel } from "@/lib/types";

/**
 * IMPULSE FIREWALL
 *
 * GREEN  — normal decision, act now.
 * YELLOW — important decision, 24-hour cooling period.
 * RED    — emotionally charged or high-risk, 72-hour cooling period.
 *
 * The firewall exists to slow decisions down, never to encourage them. It does
 * not recommend borrowing, spending or risk-taking under any circumstances.
 */

export const COOLING_HOURS: Record<DecisionLevel, number> = {
  GREEN: 0,
  YELLOW: 24,
  RED: 72,
};

export interface FirewallInput {
  amountCents: number | null;
  reversibility: "REVERSIBLE" | "COSTLY" | "IRREVERSIBLE";
  emotionalIntensity: number | null; // 1–5
  involvesBorrowing: boolean;
  isBusinessPivot: boolean;
  /** Threshold above which spending is treated as major, in cents. */
  majorSpendCents: number;
}

export interface FirewallVerdict {
  level: DecisionLevel;
  coolingHours: number;
  reasons: string[];
}

export function classifyDecision(input: FirewallInput): FirewallVerdict {
  const reasons: string[] = [];
  let level: DecisionLevel = "GREEN";

  const escalate = (to: DecisionLevel, reason: string) => {
    reasons.push(reason);
    if (to === "RED" || (to === "YELLOW" && level === "GREEN")) level = to;
  };

  if (input.involvesBorrowing) {
    escalate("RED", "Involves borrowing money.");
  }
  if (input.reversibility === "IRREVERSIBLE") {
    escalate("RED", "The decision cannot be undone.");
  }
  if (input.emotionalIntensity !== null && input.emotionalIntensity >= 4) {
    escalate("RED", "Made under high emotional intensity.");
  }
  if (input.amountCents !== null && input.amountCents >= input.majorSpendCents * 3) {
    escalate("RED", "Amount is far above your major-spend threshold.");
  } else if (input.amountCents !== null && input.amountCents >= input.majorSpendCents) {
    escalate("YELLOW", "Amount is above your major-spend threshold.");
  }
  if (input.isBusinessPivot) {
    escalate("RED", "Changes the direction of the business.");
  }
  if (input.reversibility === "COSTLY") {
    escalate("YELLOW", "Reversing this would be costly.");
  }
  if (input.emotionalIntensity !== null && input.emotionalIntensity === 3) {
    escalate("YELLOW", "Moderate emotional charge.");
  }

  if (reasons.length === 0) reasons.push("Routine decision — no escalation triggers matched.");

  return { level, coolingHours: COOLING_HOURS[level], reasons };
}

export function coolingUntil(level: DecisionLevel, from: Date = new Date()): string | null {
  const hours = COOLING_HOURS[level];
  if (hours === 0) return null;
  return new Date(from.getTime() + hours * 3_600_000).toISOString();
}

export interface CoolingState {
  released: boolean;
  remainingMs: number;
  label: string;
}

export function coolingState(coolingUntilIso: string | null, now: Date = new Date()): CoolingState {
  if (!coolingUntilIso) return { released: true, remainingMs: 0, label: "No cooling period" };
  const target = Date.parse(coolingUntilIso);
  if (Number.isNaN(target)) return { released: true, remainingMs: 0, label: "No cooling period" };
  const remaining = target - now.getTime();
  if (remaining <= 0) return { released: true, remainingMs: 0, label: "Cooling period complete" };

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return {
    released: false,
    remainingMs: remaining,
    label: hours >= 1 ? `${hours}h ${minutes}m remaining` : `${minutes}m remaining`,
  };
}
