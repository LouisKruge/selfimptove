import "server-only";

import { all } from "@/lib/db";

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  href: string;
}

/** Global search across the entities a person actually looks for by name. */
export function search(query: string, limit = 40): SearchResult[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const results: SearchResult[] = [];

  const push = (rows: Array<Record<string, unknown>>, map: (r: never) => SearchResult) => {
    for (const row of rows) results.push(map(row as never));
  };

  push(
    all(
      "SELECT id, title, priority, status, scheduled_date FROM tasks WHERE title LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT 10",
      [like],
    ),
    (r: { id: string; title: string; status: string; scheduled_date: string | null }) => ({
      id: r.id,
      type: "Task",
      title: r.title,
      subtitle: `${r.status}${r.scheduled_date ? ` · ${r.scheduled_date}` : ""}`,
      href: "/today",
    }),
  );

  push(
    all("SELECT id, title, status, pillar FROM goals WHERE title LIKE ? ESCAPE '\\' LIMIT 10", [like]),
    (r: { id: string; title: string; status: string; pillar: string }) => ({
      id: r.id,
      type: "Goal",
      title: r.title,
      subtitle: `${r.pillar} · ${r.status}`,
      href: `/goals/${r.id}`,
    }),
  );

  push(
    all("SELECT id, title, status FROM missions WHERE title LIKE ? ESCAPE '\\' LIMIT 5", [like]),
    (r: { id: string; title: string; status: string }) => ({
      id: r.id,
      type: "Mission",
      title: r.title,
      subtitle: r.status,
      href: `/missions/${r.id}`,
    }),
  );

  push(
    all("SELECT id, title, status, pillar FROM projects WHERE title LIKE ? ESCAPE '\\' LIMIT 10", [
      like,
    ]),
    (r: { id: string; title: string; status: string; pillar: string }) => ({
      id: r.id,
      type: "Project",
      title: r.title,
      subtitle: `${r.pillar} · ${r.status}`,
      href: `/business/projects/${r.id}`,
    }),
  );

  push(
    all("SELECT id, name, category, muscle_group FROM exercises WHERE name LIKE ? ESCAPE '\\' LIMIT 10", [
      like,
    ]),
    (r: { id: string; name: string; category: string; muscle_group: string | null }) => ({
      id: r.id,
      type: "Exercise",
      title: r.name,
      subtitle: [r.category, r.muscle_group].filter(Boolean).join(" · "),
      href: `/body/strength/${r.id}`,
    }),
  );

  push(
    all("SELECT id, name, type FROM workouts WHERE name LIKE ? ESCAPE '\\' LIMIT 8", [like]),
    (r: { id: string; name: string; type: string }) => ({
      id: r.id,
      type: "Workout",
      title: r.name,
      subtitle: r.type,
      href: `/body/training/library/${r.id}`,
    }),
  );

  push(
    all(
      "SELECT id, company, contact_name, stage FROM leads WHERE company LIKE ? ESCAPE '\\' OR contact_name LIKE ? ESCAPE '\\' LIMIT 10",
      [like, like],
    ),
    (r: { id: string; company: string; contact_name: string | null; stage: string }) => ({
      id: r.id,
      type: "Lead",
      title: r.company,
      subtitle: [r.contact_name, r.stage].filter(Boolean).join(" · "),
      href: `/business/sales/${r.id}`,
    }),
  );

  push(
    all("SELECT id, name, status FROM customers WHERE name LIKE ? ESCAPE '\\' LIMIT 8", [like]),
    (r: { id: string; name: string; status: string }) => ({
      id: r.id,
      type: "Customer",
      title: r.name,
      subtitle: r.status,
      href: "/business/revenue",
    }),
  );

  push(
    all("SELECT id, title, stage FROM ideas WHERE title LIKE ? ESCAPE '\\' LIMIT 8", [like]),
    (r: { id: string; title: string; stage: string }) => ({
      id: r.id,
      type: "Idea",
      title: r.title,
      subtitle: r.stage,
      href: `/ideas/${r.id}`,
    }),
  );

  push(
    all("SELECT id, title, status, level FROM decisions WHERE title LIKE ? ESCAPE '\\' LIMIT 8", [
      like,
    ]),
    (r: { id: string; title: string; status: string; level: string }) => ({
      id: r.id,
      type: "Decision",
      title: r.title,
      subtitle: `${r.level} · ${r.status}`,
      href: `/character/decisions/${r.id}`,
    }),
  );

  push(
    all("SELECT id, name, current_level, target_level FROM skills WHERE name LIKE ? ESCAPE '\\' LIMIT 8", [
      like,
    ]),
    (r: { id: string; name: string; current_level: number; target_level: number }) => ({
      id: r.id,
      type: "Skill",
      title: r.name,
      subtitle: `${r.current_level}/10 → ${r.target_level}/10`,
      href: `/learning/${r.id}`,
    }),
  );

  push(
    all(
      "SELECT id, title, body FROM notes WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' LIMIT 8",
      [like, like],
    ),
    (r: { id: string; title: string | null; body: string }) => ({
      id: r.id,
      type: "Note",
      title: r.title ?? r.body.slice(0, 60),
      subtitle: null,
      href: "/ideas",
    }),
  );

  return results.slice(0, limit);
}
