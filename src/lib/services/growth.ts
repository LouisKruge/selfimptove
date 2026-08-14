import "server-only";

import { all, scalar } from "@/lib/db";
import { byId } from "@/lib/db/repo";
import { addDays, today, type DayString } from "@/lib/core/date";
import { canActivate, scoreIdea, type IdeaScore } from "@/lib/domain/ideas";
import { round } from "@/lib/domain/stats";
import type { Idea, LearningItem, Skill } from "@/lib/types";

/* --------------------------------------------------------------- learning */

export async function listSkills(activeOnly = true): Promise<Skill[]> {
  return await all<Skill>(
      `SELECT * FROM skills ${activeOnly ? "WHERE active = 1" : ""} ORDER BY name`,
    );
}

export async function getSkill(id: string): Promise<Skill | undefined> {
  return await byId<Skill>("skills", id);
}

export async function listLearningItems(limit = 100): Promise<LearningItem[]> {
  return await all<LearningItem>("SELECT * FROM learning_items ORDER BY date DESC, created_at DESC LIMIT ?", [
      limit,
    ]);
}

export async function learningForSkill(skillId: string): Promise<LearningItem[]> {
  return await all<LearningItem>(
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

export async function skillViews(): Promise<SkillView[]> {
  const skills = await listSkills();
  return Promise.all(
    skills.map(async (s) => {
      const items = await learningForSkill(s.id);
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
        progress: s.target_level > 0 ? round((s.current_level / s.target_level) * 100, 0) : 0,
        lastActivity: items.length ? items[0].date : null,
      };
    }),
  );
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

export async function learningStats(day: DayString = today()): Promise<LearningStats> {
  const from7 = addDays(day, -6);
  const from30 = addDays(day, -29);
  const items30 = await all<LearningItem>(
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
    revenueAttributedCents: await scalar(
          "SELECT COALESCE(SUM(revenue_cents), 0) AS v FROM learning_items",
        ),
  };
}

/* ------------------------------------------------------------------ ideas */

export async function listIdeas(): Promise<Idea[]> {
  return await all<Idea>(
      `SELECT * FROM ideas
      ORDER BY CASE stage
        WHEN 'ACTIVE' THEN 0 WHEN 'SCORED' THEN 1 WHEN 'VALIDATE' THEN 2
        WHEN 'RESEARCH' THEN 3 WHEN 'CAPTURE' THEN 4 WHEN 'PARKED' THEN 5 ELSE 6 END,
        created_at DESC`,
    );
}

export async function getIdea(id: string): Promise<Idea | undefined> {
  return await byId<Idea>("ideas", id);
}

export interface IdeaView extends Idea {
  score: IdeaScore;
  activation: Awaited<ReturnType<typeof canActivate>>;
}

export async function ideaViews(): Promise<IdeaView[]> {
  return (await listIdeas()).map((idea) => ({
    ...idea,
    score: scoreIdea(idea),
    activation: canActivate(idea),
  }));
}

export async function ideaView(id: string): Promise<IdeaView | undefined> {
  const idea = await getIdea(id);
  if (!idea) return undefined;
  return { ...idea, score: scoreIdea(idea), activation: canActivate(idea) };
}
