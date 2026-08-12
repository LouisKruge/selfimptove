import type { Idea } from "@/lib/types";
import { round } from "./stats";

/**
 * IDEA VAULT SCORING
 *
 * CAPTURE → RESEARCH → VALIDATE → SCORE → PARK / ACTIVATE
 *
 * An idea never becomes active by scoring well. Promotion is always deliberate.
 */

export interface IdeaScore {
  total: number | null;
  /** Reward-to-effort ratio; higher is a better use of a limited season. */
  leverage: number | null;
  complete: boolean;
  missing: string[];
}

const DIMENSIONS = [
  { key: "score_potential", label: "Potential", weight: 3, invert: false },
  { key: "score_speed", label: "Speed to revenue", weight: 2, invert: false },
  { key: "score_fit", label: "Strategic fit", weight: 2, invert: false },
  { key: "score_advantage", label: "Advantage", weight: 2, invert: false },
  { key: "score_difficulty", label: "Difficulty", weight: 2, invert: true },
  { key: "score_cost", label: "Cost", weight: 1, invert: true },
] as const;

export function scoreIdea(idea: Pick<Idea, (typeof DIMENSIONS)[number]["key"]>): IdeaScore {
  const missing: string[] = [];
  let total = 0;
  let weight = 0;

  for (const d of DIMENSIONS) {
    const raw = idea[d.key];
    if (raw === null || raw === undefined) {
      missing.push(d.label);
      continue;
    }
    const value = d.invert ? 11 - raw : raw;
    total += value * d.weight;
    weight += d.weight;
  }

  if (weight === 0) {
    return { total: null, leverage: null, complete: false, missing: missing };
  }

  const normalised = round((total / (weight * 10)) * 100, 1);

  const upside =
    (idea.score_potential ?? 0) + (idea.score_speed ?? 0) + (idea.score_advantage ?? 0);
  const effort = (idea.score_difficulty ?? 0) + (idea.score_cost ?? 0);
  const leverage =
    idea.score_potential !== null && idea.score_difficulty !== null && effort > 0
      ? round(upside / effort, 2)
      : null;

  return {
    total: normalised,
    leverage,
    complete: missing.length === 0,
    missing,
  };
}

export const IDEA_DIMENSIONS = DIMENSIONS;

export const IDEA_STAGE_ORDER = [
  "CAPTURE",
  "RESEARCH",
  "VALIDATE",
  "SCORED",
  "PARKED",
  "ACTIVE",
  "KILLED",
] as const;

/** Whether an idea has done the work required to be promoted to a project. */
export function canActivate(idea: Idea): { ok: boolean; reason: string } {
  if (idea.stage === "ACTIVE") return { ok: false, reason: "Already active." };
  if (idea.stage === "KILLED") return { ok: false, reason: "This idea was killed." };
  if (!idea.research_notes) {
    return { ok: false, reason: "Research it before activating — no research notes recorded." };
  }
  if (!idea.validation_notes) {
    return { ok: false, reason: "Validate it before activating — no validation notes recorded." };
  }
  const score = scoreIdea(idea);
  if (!score.complete) {
    return { ok: false, reason: `Score it fully first — missing ${score.missing.join(", ")}.` };
  }
  return { ok: true, reason: "Researched, validated and scored. Activation is a deliberate choice." };
}
