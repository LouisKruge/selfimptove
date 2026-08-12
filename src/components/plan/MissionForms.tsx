"use client";

import { useTransition } from "react";
import {
  createMilestone,
  createMission,
  createMissionKpi,
  createRisk,
  deleteMilestone,
  deleteMissionKpi,
  promoteMission,
  setMilestoneStatus,
  setRiskStatus,
  updateMissionKpi,
} from "@/lib/actions/plan";
import type { Milestone, MissionKpi, Risk } from "@/lib/types";
import { formatDayShort } from "@/lib/core/date";
import { ActionForm, FieldRow, SelectField, SubmitButton, TextArea, TextField } from "../forms";
import { Badge, cx } from "../primitives";

export function MissionForm({
  defaultStart,
  defaultEnd,
  goals,
}: {
  defaultStart: string;
  defaultEnd: string;
  goals: Array<{ value: string; label: string }>;
}) {
  return (
    <ActionForm action={createMission} className="panel p-4 sm:p-5">
      <TextField
        label="Mission"
        name="title"
        required
        placeholder="BUILD THE MACHINE"
        hint="A 90-day mission is a single, nameable outcome — not a theme."
      />
      <TextArea
        label="Objective"
        name="objective"
        rows={3}
        placeholder="What must be true at the end of the window?"
      />
      <TextArea label="Why" name="why" rows={2} />

      <FieldRow cols={3}>
        <TextField label="Start" name="start_date" type="date" defaultValue={defaultStart} required />
        <TextField label="End" name="end_date" type="date" defaultValue={defaultEnd} required />
        <SelectField
          label="Kind"
          name="kind"
          defaultValue="PRIMARY"
          options={[
            { value: "PRIMARY", label: "Primary" },
            { value: "SECONDARY", label: "Secondary" },
          ]}
          hint="Promoting a new primary stands the current one down."
        />
      </FieldRow>

      <FieldRow cols={3}>
        <TextField label="Target value" name="target_value" type="number" step="any" />
        <TextField label="Unit" name="unit" placeholder="ZAR monthly revenue" />
        <SelectField label="Goal" name="goal_id" includeBlank blankLabel="Not linked" options={goals} />
      </FieldRow>

      <div className="flex justify-end">
        <SubmitButton>Create mission</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function MilestoneList({ milestones }: { milestones: Milestone[] }) {
  const [pending, startTransition] = useTransition();

  if (milestones.length === 0) {
    return (
      <p className="text-xs text-ink-faint">
        No milestones. Mission progress cannot be calculated without them.
      </p>
    );
  }

  const cycle = (status: string) =>
    status === "PENDING" ? "IN_PROGRESS" : status === "IN_PROGRESS" ? "COMPLETE" : "PENDING";

  return (
    <ol className="space-y-px">
      {milestones.map((m, i) => (
        <li key={m.id} className="flex items-start gap-3.5 border-b border-line-soft py-3 last:border-b-0">
          <button
            type="button"
            disabled={pending}
            title="Cycle status"
            onClick={() => startTransition(() => void setMilestoneStatus(m.id, cycle(m.status)))}
            className={cx(
              "mt-0.5 flex h-4 w-4 flex-none items-center justify-center border text-[0.5rem] transition-colors",
              m.status === "COMPLETE"
                ? "border-ink bg-ink text-inverse"
                : m.status === "IN_PROGRESS"
                  ? "border-ink text-ink"
                  : "border-line-strong text-transparent",
            )}
          >
            {m.status === "COMPLETE" ? "✓" : m.status === "IN_PROGRESS" ? "•" : ""}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="numeral text-[0.6875rem] text-ink-ghost">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cx(
                  "text-sm",
                  m.status === "COMPLETE" ? "text-ink-faint" : "text-ink",
                )}
              >
                {m.title}
              </span>
              {m.status === "IN_PROGRESS" ? <Badge>In progress</Badge> : null}
            </div>
            {m.description ? (
              <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{m.description}</p>
            ) : null}
          </div>

          <div className="flex flex-none items-center gap-3">
            {m.target_date ? (
              <span className="text-[0.6875rem] text-ink-faint">{formatDayShort(m.target_date)}</span>
            ) : null}
            <button
              type="button"
              disabled={pending}
              aria-label="Delete milestone"
              onClick={() => startTransition(() => void deleteMilestone(m.id))}
              className="text-ink-ghost transition-colors hover:text-critical"
            >
              ×
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function MilestoneForm({ missionId }: { missionId: string }) {
  return (
    <ActionForm action={createMilestone} resetOnSuccess>
      <input type="hidden" name="mission_id" value={missionId} />
      <FieldRow cols={3}>
        <TextField label="Milestone" name="title" required placeholder="First customer" />
        <TextField label="Target date" name="target_date" type="date" />
        <TextField label="Weight" name="weight" type="number" min="1" defaultValue={1} />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Add milestone</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function KpiList({ kpis }: { kpis: MissionKpi[] }) {
  const [pending, startTransition] = useTransition();

  if (kpis.length === 0) {
    return <p className="text-xs text-ink-faint">No KPIs defined for this mission.</p>;
  }

  return (
    <ul className="space-y-4">
      {kpis.map((k) => {
        const pct =
          k.current_value !== null && k.target_value !== null && k.target_value !== 0
            ? Math.min(100, Math.round((k.current_value / k.target_value) * 100))
            : null;
        return (
          <li key={k.id} className="border-b border-line-soft pb-4 last:border-b-0 last:pb-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink">{k.name}</span>
              <span className="numeral text-xs text-ink-dim">
                {k.current_value ?? "—"} / {k.target_value ?? "—"}
                {k.unit ? ` ${k.unit}` : ""}
                {pct !== null ? ` · ${pct}%` : ""}
              </span>
            </div>
            <form
              action={async (fd) => {
                await updateMissionKpi(fd);
              }}
              className="mt-2.5 flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="id" value={k.id} />
              <label className="flex-1">
                <span className="label mb-1 block">Current</span>
                <input name="current_value" type="number" step="any" defaultValue={k.current_value ?? ""} />
              </label>
              <label className="flex-1">
                <span className="label mb-1 block">Target</span>
                <input name="target_value" type="number" step="any" defaultValue={k.target_value ?? ""} />
              </label>
              <button type="submit" className="btn">
                Save
              </button>
              <button
                type="button"
                disabled={pending}
                aria-label="Delete KPI"
                onClick={() => startTransition(() => void deleteMissionKpi(k.id))}
                className="btn btn-ghost"
              >
                ×
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}

export function KpiForm({ missionId }: { missionId: string }) {
  return (
    <ActionForm action={createMissionKpi} resetOnSuccess>
      <input type="hidden" name="mission_id" value={missionId} />
      <FieldRow cols={4}>
        <TextField label="KPI" name="name" required placeholder="Paying customers" />
        <TextField label="Unit" name="unit" placeholder="count" />
        <TextField label="Current" name="current_value" type="number" step="any" />
        <TextField label="Target" name="target_value" type="number" step="any" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton variant="default">Add KPI</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function RiskList({ risks }: { risks: Risk[] }) {
  const [pending, startTransition] = useTransition();

  if (risks.length === 0) {
    return <p className="text-xs text-ink-faint">No risks recorded.</p>;
  }

  return (
    <ul className="space-y-px">
      {risks.map((r) => (
        <li key={r.id} className="border-b border-line-soft py-3 last:border-b-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className={cx("text-sm", r.status === "OPEN" ? "text-ink" : "text-ink-faint")}>
              {r.title}
            </span>
            <div className="flex items-center gap-2">
              <Badge
                tone={
                  r.severity === "CRITICAL" || r.severity === "HIGH"
                    ? "critical"
                    : r.severity === "MEDIUM"
                      ? "attention"
                      : "muted"
                }
              >
                {r.severity}
              </Badge>
              <Badge tone="muted">{r.likelihood.replace("_", " ")}</Badge>
              {r.status === "OPEN" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(() => void setRiskStatus(r.id, "MITIGATED"))}
                  className="btn btn-ghost"
                >
                  Mitigated
                </button>
              ) : (
                <Badge tone="positive">{r.status}</Badge>
              )}
            </div>
          </div>
          {r.detail ? (
            <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">{r.detail}</p>
          ) : null}
          {r.mitigation ? (
            <p className="mt-1.5 text-xs leading-relaxed text-ink-dim">
              <span className="label mr-2">Mitigation</span>
              {r.mitigation}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function RiskForm({ missionId, projectId }: { missionId?: string; projectId?: string }) {
  return (
    <ActionForm action={createRisk} resetOnSuccess>
      {missionId ? <input type="hidden" name="mission_id" value={missionId} /> : null}
      {projectId ? <input type="hidden" name="project_id" value={projectId} /> : null}
      <TextField label="Risk" name="title" required placeholder="Billing integration blocks launch" />
      <FieldRow cols={2}>
        <SelectField
          label="Severity"
          name="severity"
          defaultValue="MEDIUM"
          options={["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => ({ value: v, label: v }))}
        />
        <SelectField
          label="Likelihood"
          name="likelihood"
          defaultValue="POSSIBLE"
          options={["UNLIKELY", "POSSIBLE", "LIKELY", "ALMOST_CERTAIN"].map((v) => ({
            value: v,
            label: v.replace("_", " "),
          }))}
        />
      </FieldRow>
      <TextArea label="Mitigation" name="mitigation" rows={2} />
      <div className="flex justify-end">
        <SubmitButton variant="default">Record risk</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PromoteMissionButton({ missionId }: { missionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void promoteMission(missionId))}
      className="btn"
    >
      Make primary
    </button>
  );
}
