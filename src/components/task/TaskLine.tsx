import type { Task } from "@/lib/types";
import { formatDayShort } from "@/lib/core/date";
import { Badge, cx } from "../primitives";
import { TaskToggle, TaskMenu } from "./TaskControls";

/**
 * A task as it appears everywhere in COMMAND: the outcome first, the links that
 * justify it second, and the controls that change its state on the right.
 */
export function TaskLine({
  task,
  dominant,
  showDate,
  context,
}: {
  task: Task;
  /** The must-win is visually dominant — it is the day's single obligation. */
  dominant?: boolean;
  showDate?: boolean;
  context?: string | null;
}) {
  const done = task.status === "COMPLETE";
  const cancelled = task.status === "CANCELLED";

  return (
    <div className="flex items-start gap-3.5">
      <TaskToggle id={task.id} done={done} />

      <div className="min-w-0 flex-1">
        <div
          className={cx(
            "leading-snug",
            dominant ? "text-lg sm:text-xl" : "text-sm",
            done || cancelled ? "text-ink-faint line-through decoration-ink-ghost" : "text-ink",
          )}
        >
          {task.title}
        </div>

        {task.expected_outcome ? (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{task.expected_outcome}</p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="label">{task.pillar}</span>
          {context ? (
            <span className="max-w-full truncate text-[0.6875rem] text-ink-faint">{context}</span>
          ) : null}
          {showDate && task.scheduled_date ? (
            <span className="text-[0.6875rem] text-ink-faint">
              {formatDayShort(task.scheduled_date)}
            </span>
          ) : null}
          {task.deadline ? (
            <span className="text-[0.6875rem] text-ink-faint">
              due {formatDayShort(task.deadline)}
            </span>
          ) : null}
          {task.estimated_minutes ? (
            <span className="numeral text-[0.6875rem] text-ink-faint">
              {task.estimated_minutes}m
            </span>
          ) : null}
          {task.delegated_to ? <Badge tone="muted">Delegated · {task.delegated_to}</Badge> : null}
          {task.status === "BLOCKED" ? <Badge tone="critical">Blocked</Badge> : null}
          {task.status === "IN_PROGRESS" ? <Badge>In progress</Badge> : null}
          {!task.goal_id && !task.mission_id && !task.project_id ? (
            <Badge tone="muted">Unlinked</Badge>
          ) : null}
        </div>

        {task.blocked_reason ? (
          <p className="mt-2 border-l border-critical pl-2.5 text-[0.6875rem] leading-relaxed text-critical">
            {task.blocked_reason}
          </p>
        ) : null}
      </div>

      <TaskMenu task={task} />
    </div>
  );
}
