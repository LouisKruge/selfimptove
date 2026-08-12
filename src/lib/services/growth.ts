import "server-only";

import { all, scalar } from "@/lib/db";
import { byId } from "@/lib/db/repo";
import { addDays, today, type DayString } from "@/lib/core/date";
import { canActivate, scoreIdea, type IdeaScore } from "@/lib/domain/ideas";
import { round } from "@/lib/domain/stats";
import type { Idea, LearningItem, Skill } from "@/lib/types";

/* --------------------------------------------------------------- learning */

export function listSkills(activeOnly = true): Skill[] {
  return all<Skill>(
    `SELECT * FROM skills ${activeOnly ? "WHERE active = 1" : ""} ORDER BY name`,
  );
}

export function getSkill(id: string): Skill | undefined {
  return byId<Skill>("skills", id);
}

export function listLearningItems(limit = 100): LearningItem[] {
  return all<LearningItem>("SELECT * FROM learning_items ORDER BY date DESC, created_at DESC LIMIT ?", [
    limit,
  ]);
}

export function learningForSkill(skillId: string): LearningItem[] {
  return all<LearningItem>(
    "SELECT * FROM learning_items WHERE skill_id = ? ORDER BY date DESC",
    [skillId],
  );
}

export interface SkillView extends Skill {
  hours: number;
  minutes: number;
  applications: number;
  tests: number;
  items: number;
  revenueCents: number;
  gap: number;
  progress: number;
  lastActivity: string | null;
}

export function skillViews(): SkillView[] {
  return listSkills().map((s) => {
    const items = learningForSkill(s.id);
    const minutes = items.reduce((t, i) => t + i.minutes, 0);
    const revenue = items.reduce((t, i) => t + (i.revenue_cents ?? 0), 0);
    return {
      ...s,
      minutes,
      hours: round(minutes / 60, 1),
      applications: items.filter((i) => i.applied === 1 || i.kind === "APPLICATION").length,
      tests: items.filter((i) => i.kind === "TEST").length,
      items: items.length,
      revenueCents: revenue,
      gap: Math.max(0, s.target_level - s.current_level),
      progress:
        s.target_level > 0 ? round((s.current_level / s.target_level) * 100, 0) : 0,
      lastActivity: items.length ? items[0].date : null,
    };
  });
}

export interface LearningStats {
  activeDays7: number;
  minutes7: number;
  minutes30: number;
  applied30: number;
  total30: number;
  applicationRate: number | null;
  revenueAttributedCents: number;
}

export function learningStats(day: DayString = today()): LearningStats {
  const from7 = addDays(day, -6);
  const from30 = addDays(day, -29);
  const items30 = all<LearningItem>(
    "SELECT * FROM learning_items WHERE date BETWEEN ? AND ?",
    [from30, day],
  );
  const items7 = items30.filter((i) => i.date >= from7);
  const applied30 = items30.filter((i) => i.applied === 1 || i.kind === "APPLICATION").length;

  return {
    activeDays7: new Set(items7.map((i) => i.date)).size,
    minutes7: items7.reduce((t, i) => t + i.minutes, 0),
    minutes30: items30.reduce((t, i) => t + i.minutes, 0),
    applied30,
    total30: items30.length,
    applicationRate: items30.length ? round((applied30 / items30.length) * 100, 0) : null,
    revenueAttributedCents: scalar(
      "SELECT COALESCE(SUM(revenue_cents), 0) AS v FROM learning_items",
    ),
  };
}

/* ------------------------------------------------------------------ ideas */

export function listIdeas(): Idea[] {
  return all<Idea>(
    `SELECT * FROM ideas
      ORDER BY CASE stage
        WHEN 'ACTIVE' THEN 0 WHEN 'SCORED' THEN 1 WHEN 'VALIDATE' THEN 2
        WHEN 'RESEARCH' THEN 3 WHEN 'CAPTURE' THEN 4 WHEN 'PARKED' THEN 5 ELSE 6 END,
        created_at DESC`,
  );
}

export function getIdea(id: string): Idea | undefined {
  return byId<Idea>("ideas", id);
}

export interface IdeaView extends Idea {
  score: IdeaScore;
  activation: ReturnType<typeof canActivate>;
}

export function ideaViews(): IdeaView[] {
  return listIdeas().map((idea) => ({
    ...idea,
    score: scoreIdea(idea),
    activation: canActivate(idea),
  }));
}

export function ideaView(id: string): IdeaView | undefined {
  const idea = getIdea(id);
  if (!idea) return undefined;
  return { ...idea, score: scoreIdea(idea), activation: canActivate(idea) };
}
