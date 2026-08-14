import "server-only";

import { all, get } from "@/lib/db";
import type { Goal, Mission, Note, Project, Task } from "@/lib/types";

/**
 * A single task, in full.
 *
 * The list views answer "what am I supposed to do"; this answers "what is this,
 * what was it meant to produce, what have I actually done about it, and what
 * came out of it". The work log is the part the lists cannot show.
 */

export interface TaskDetail {
  task: Task;
  project: Project | undefined;
  mission: Mission | undefined;
  goal: Goal | undefined;
  /** Working notes, newest first. */
  log: Note[];
  /** Estimated versus actual, once both exist. */
  varianceMinutes: number | null;
}

export const TASK_NOTE_ENTITY = "task";

export async function getTask(id: string): Promise<Task | undefined> {
  return get<Task>("SELECT * FROM tasks WHERE id = ?", [id]);
}

export async function taskLog(taskId: string): Promise<Note[]> {
  return all<Note>(
    "SELECT * FROM notes WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC",
    [TASK_NOTE_ENTITY, taskId],
  );
}

export async function taskDetail(id: string): Promise<TaskDetail | undefined> {
  const task = await getTask(id);
  if (!task) return undefined;

  const project = task.project_id
    ? await get<Project>("SELECT * FROM projects WHERE id = ?", [task.project_id])
    : undefined;
  const mission = task.mission_id
    ? await get<Mission>("SELECT * FROM missions WHERE id = ?", [task.mission_id])
    : undefined;
  const goal = task.goal_id
    ? await get<Goal>("SELECT * FROM goals WHERE id = ?", [task.goal_id])
    : undefined;

  const varianceMinutes =
    task.estimated_minutes !== null && task.actual_minutes !== null
      ? task.actual_minutes - task.estimated_minutes
      : null;

  return { task, project, mission, goal, log: await taskLog(id), varianceMinutes };
}

/** The task immediately before and after this one in the same project. */
export async function taskNeighbours(
  task: Task,
): Promise<{ previous: Task | undefined; next: Task | undefined }> {
  if (!task.project_id) return { previous: undefined, next: undefined };
  const previous = await get<Task>(
    `SELECT * FROM tasks WHERE project_id = ? AND sort_order < ?
      ORDER BY sort_order DESC LIMIT 1`,
    [task.project_id, task.sort_order],
  );
  const next = await get<Task>(
    `SELECT * FROM tasks WHERE project_id = ? AND sort_order > ?
      ORDER BY sort_order ASC LIMIT 1`,
    [task.project_id, task.sort_order],
  );
  return { previous, next };
}
