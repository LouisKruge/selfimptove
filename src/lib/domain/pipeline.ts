import { LEAD_STAGES, type LeadStage } from "@/lib/types";
import { round } from "./stats";

/**
 * BUSINESS PIPELINE + TARGET ENGINE
 *
 * Conversion rates come from recorded stage history and nothing else. Where the
 * sample is too small to mean anything the rate is `null`, and every calculation
 * that depends on it is `null` too. COMMAND will not back-solve a customer
 * target off an invented conversion rate.
 */

export const MIN_SAMPLE = 3;

export type PipelineStage = (typeof LEAD_STAGES)[number];

export interface StageCount {
  stage: PipelineStage;
  /** Leads sitting in this stage right now. */
  current: number;
  /** Leads that have ever reached this stage. */
  everReached: number;
  valueCents: number;
}

export interface StageConversion {
  from: PipelineStage;
  to: PipelineStage;
  /** 0–100, or null when the sample is below MIN_SAMPLE. */
  rate: number | null;
  reached: number;
  advanced: number;
  sufficient: boolean;
}

export interface PipelineAnalysis {
  stages: StageCount[];
  conversions: StageConversion[];
  totalOpen: number;
  openValueCents: number;
  weightedValueCents: number;
  lost: number;
  /** The first stage where conversion falls furthest below the pipeline mean. */
  bottleneck: StageConversion | null;
}

export interface LeadLike {
  stage: LeadStage;
  potential_cents: number;
  probability: number;
}

export interface StageEventLike {
  lead_id: string;
  to_stage: string;
}

export function analysePipeline(
  leads: readonly LeadLike[],
  events: readonly StageEventLike[],
): PipelineAnalysis {
  // Which stages each lead has ever touched.
  const reachedByLead = new Map<string, Set<string>>();
  for (const e of events) {
    const set = reachedByLead.get(e.lead_id) ?? new Set<string>();
    set.add(e.to_stage);
    reachedByLead.set(e.lead_id, set);
  }

  const everReached = new Map<string, number>();
  for (const set of reachedByLead.values()) {
    for (const stage of set) {
      everReached.set(stage, (everReached.get(stage) ?? 0) + 1);
    }
  }

  const stages: StageCount[] = LEAD_STAGES.map((stage) => {
    const inStage = leads.filter((l) => l.stage === stage);
    return {
      stage,
      current: inStage.length,
      everReached: everReached.get(stage) ?? 0,
      valueCents: inStage.reduce((t, l) => t + l.potential_cents, 0),
    };
  });

  const conversions: StageConversion[] = [];
  for (let i = 0; i < LEAD_STAGES.length - 1; i++) {
    const from = LEAD_STAGES[i];
    const to = LEAD_STAGES[i + 1];
    const reached = everReached.get(from) ?? 0;
    const advanced = everReached.get(to) ?? 0;
    const sufficient = reached >= MIN_SAMPLE;
    conversions.push({
      from,
      to,
      reached,
      advanced,
      sufficient,
      rate: sufficient ? round(Math.min(100, (advanced / reached) * 100), 1) : null,
    });
  }

  const open = leads.filter((l) => l.stage !== "LOST" && l.stage !== "RETAINED");
  const usable = conversions.filter((c) => c.rate !== null);
  const meanRate =
    usable.length > 0 ? usable.reduce((t, c) => t + (c.rate ?? 0), 0) / usable.length : null;

  let bottleneck: StageConversion | null = null;
  if (meanRate !== null) {
    for (const c of usable) {
      if (c.rate === null) continue;
      if (bottleneck === null || c.rate < (bottleneck.rate ?? Infinity)) bottleneck = c;
    }
    // Only call it a bottleneck when it is meaningfully below the rest.
    if (bottleneck && bottleneck.rate !== null && bottleneck.rate >= meanRate * 0.8) {
      bottleneck = null;
    }
  }

  return {
    stages,
    conversions,
    totalOpen: open.length,
    openValueCents: open.reduce((t, l) => t + l.potential_cents, 0),
    weightedValueCents: Math.round(
      open.reduce((t, l) => t + (l.potential_cents * l.probability) / 100, 0),
    ),
    lost: leads.filter((l) => l.stage === "LOST").length,
    bottleneck,
  };
}

/* ------------------------------------------------------- backward planning */

export interface RequirementStep {
  stage: PipelineStage;
  /** Volume required at this stage, or null when a rate downstream is unknown. */
  required: number | null;
  /** Conversion out of this stage, 0–100 or null. */
  rateOut: number | null;
  known: boolean;
}

export interface TargetPlan {
  targetMrrCents: number;
  avgDealCents: number | null;
  customersRequired: number | null;
  currentCustomers: number;
  customerGap: number | null;
  steps: RequirementStep[];
  /** Stages whose rate is unknown, blocking the calculation. */
  missing: PipelineStage[];
  note: string;
}

/**
 * Works backward from a revenue target through the actual funnel.
 *
 *   target MRR / average deal = customers required
 *   customers / rate(PROPOSAL→CUSTOMER) = proposals required
 *   … and so on up the funnel.
 */
export function planToTarget(opts: {
  targetMrrCents: number;
  avgDealCents: number | null;
  currentCustomers: number;
  conversions: readonly StageConversion[];
}): TargetPlan {
  const { targetMrrCents, avgDealCents, currentCustomers, conversions } = opts;

  const customersRequired =
    avgDealCents && avgDealCents > 0 ? Math.ceil(targetMrrCents / avgDealCents) : null;

  const rateOut = new Map<PipelineStage, number | null>();
  for (const c of conversions) rateOut.set(c.from, c.rate);

  const steps: RequirementStep[] = [];
  const missing: PipelineStage[] = [];

  // Walk from CUSTOMER back to PROSPECT.
  const customerIndex = LEAD_STAGES.indexOf("CUSTOMER");
  let carried: number | null = customersRequired;

  steps.push({
    stage: "CUSTOMER",
    required: customersRequired,
    rateOut: rateOut.get("CUSTOMER") ?? null,
    known: customersRequired !== null,
  });

  for (let i = customerIndex - 1; i >= 0; i--) {
    const stage = LEAD_STAGES[i];
    const rate = rateOut.get(stage) ?? null;
    if (rate === null) missing.push(stage);
    const required =
      carried !== null && rate !== null && rate > 0 ? Math.ceil(carried / (rate / 100)) : null;
    steps.push({ stage, required, rateOut: rate, known: required !== null });
    carried = required;
  }

  steps.reverse();

  let note: string;
  if (avgDealCents === null || avgDealCents <= 0) {
    note = "Set an average deal value on the business to calculate the customers required.";
  } else if (missing.length > 0) {
    note = `Conversion is unknown for ${missing.join(", ")} — at least ${MIN_SAMPLE} leads must have reached each stage before the funnel can be back-solved.`;
  } else {
    note = "Requirements derived from your own recorded conversion rates.";
  }

  return {
    targetMrrCents,
    avgDealCents,
    customersRequired,
    currentCustomers,
    customerGap:
      customersRequired === null ? null : Math.max(0, customersRequired - currentCustomers),
    steps,
    missing,
    note,
  };
}

/* --------------------------------------------------- highest-value action */

export interface NextActionCandidate {
  id: string;
  company: string;
  stage: LeadStage;
  potential_cents: number;
  probability: number;
  next_action: string | null;
  next_action_date: string | null;
  last_contact_date: string | null;
}

export interface RankedAction extends NextActionCandidate {
  expectedCents: number;
  urgency: number;
  score: number;
  reason: string;
}

/**
 * Ranks open leads by expected value, weighted by how overdue the next action
 * is. Answers "what is the highest-value thing to do in sales right now".
 */
export function rankNextActions(
  candidates: readonly NextActionCandidate[],
  today: string,
): RankedAction[] {
  return candidates
    .filter((c) => c.stage !== "LOST" && c.stage !== "RETAINED")
    .map((c) => {
      const expectedCents = Math.round((c.potential_cents * c.probability) / 100);
      let urgency = 1;
      let reason = "Open opportunity.";
      if (c.next_action_date) {
        if (c.next_action_date < today) {
          urgency = 2.5;
          reason = "Next action is overdue.";
        } else if (c.next_action_date === today) {
          urgency = 2;
          reason = "Next action due today.";
        } else {
          urgency = 1.2;
          reason = "Next action scheduled.";
        }
      } else if (!c.last_contact_date) {
        urgency = 1.5;
        reason = "Never contacted.";
      } else {
        urgency = 1.3;
        reason = "No next action set.";
      }
      return {
        ...c,
        expectedCents,
        urgency,
        score: expectedCents * urgency,
        reason,
      };
    })
    .sort((a, b) => b.score - a.score);
}
