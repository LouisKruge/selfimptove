"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  activateIdea,
  captureIdea,
  deleteIdea,
  deleteLearningItem,
  deleteSkill,
  logLearning,
  markLearningApplied,
  setIdeaStage,
  updateIdea,
  upsertSkill,
} from "@/lib/actions/self";
import { IDEA_DIMENSIONS } from "@/lib/domain/ideas";
import {
  ActionForm,
  CheckboxField,
  FieldRow,
  SelectField,
  SubmitButton,
  TextArea,
  TextField,
} from "../forms";
import { cx } from "../primitives";

/* -------------------------------------------------------------- LEARNING */

export function SkillForm() {
  return (
    <ActionForm action={upsertSkill} resetOnSuccess className="panel p-4 sm:p-5">
      <TextField label="Skill" name="name" required placeholder="Sales" />
      <TextArea label="Why it matters" name="why" rows={2} placeholder="What does this skill unlock?" />
      <FieldRow cols={2}>
        <TextField label="Current level (0–10)" name="current_level" type="number" min="0" max="10" defaultValue={3} />
        <TextField label="Target level (0–10)" name="target_level" type="number" min="0" max="10" defaultValue={8} />
      </FieldRow>
      <TextField label="Evidence" name="evidence" placeholder="What would prove you are at the target level?" />
      <div className="flex justify-end">
        <SubmitButton>Add skill</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SkillLevelForm({
  skill,
}: {
  skill: {
    id: string;
    name: string;
    current_level: number;
    target_level: number;
    evidence: string | null;
    why: string | null;
  };
}) {
  return (
    <ActionForm action={upsertSkill}>
      <input type="hidden" name="id" value={skill.id} />
      <input type="hidden" name="name" value={skill.name} />
      <input type="hidden" name="active" value="on" />
      <FieldRow cols={2}>
        <TextField
          label="Current level"
          name="current_level"
          type="number"
          min="0"
          max="10"
          defaultValue={skill.current_level}
        />
        <TextField
          label="Target level"
          name="target_level"
          type="number"
          min="0"
          max="10"
          defaultValue={skill.target_level}
        />
      </FieldRow>
      <TextArea label="Why it matters" name="why" rows={2} defaultValue={skill.why} />
      <TextField label="Evidence" name="evidence" defaultValue={skill.evidence} />
      <div className="flex justify-end">
        <SubmitButton variant="default">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function LearningForm({
  date,
  skills,
}: {
  date: string;
  skills: Array<{ value: string; label: string }>;
}) {
  return (
    <ActionForm action={logLearning} resetOnSuccess className="panel p-4 sm:p-5">
      <FieldRow cols={4}>
        <TextField label="What" name="title" required placeholder="Objection handling — price" />
        <SelectField label="Skill" name="skill_id" includeBlank blankLabel="Unassigned" options={skills} />
        <SelectField
          label="Kind"
          name="kind"
          defaultValue="STUDY"
          options={[
            { value: "STUDY", label: "Study" },
            { value: "PRACTICE", label: "Practice" },
            { value: "APPLICATION", label: "Application" },
            { value: "TEST", label: "Test" },
          ]}
        />
        <TextField label="Minutes" name="minutes" type="number" min="0" defaultValue={30} />
      </FieldRow>
      <FieldRow cols={2}>
        <TextField label="Source" name="source" placeholder="Book, course, call recording…" />
        <TextField label="Date" name="date" type="date" defaultValue={date} />
      </FieldRow>
      <TextArea label="What I learned" name="what_i_learned" rows={2} />
      <TextArea label="Why it matters" name="why_it_matters" rows={2} />
      <TextArea
        label="How I will apply it"
        name="how_i_will_apply"
        rows={2}
        placeholder="Naming this is what separates learning from consumption."
      />
      <FieldRow cols={2}>
        <CheckboxField label="Already applied" name="applied" />
        <TextField label="Revenue attributed (R)" name="revenue" type="number" step="1" />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton>Log learning</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ApplyForm({ itemId }: { itemId: string }) {
  return (
    <ActionForm action={markLearningApplied}>
      <input type="hidden" name="id" value={itemId} />
      <div className="flex items-end gap-2">
        <TextField label="Result" name="result" placeholder="What happened when you used it?" className="flex-1" />
        <TextField label="Revenue (R)" name="revenue" type="number" step="1" className="w-32" />
        <SubmitButton variant="default">Applied</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function DeleteLearningButton({ itemId }: { itemId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Delete learning item"
      onClick={() => startTransition(() => void deleteLearningItem(itemId))}
      className="text-ink-ghost transition-colors hover:text-critical"
    >
      ×
    </button>
  );
}

export function DeleteSkillButton({ skillId, name }: { skillId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Remove the ${name} skill? Logged learning stays.`)) return;
        startTransition(async () => {
          await deleteSkill(skillId);
          router.push("/learning");
        });
      }}
      className="btn btn-ghost"
    >
      Delete
    </button>
  );
}

/* ----------------------------------------------------------------- IDEAS */

export function IdeaCaptureForm() {
  return (
    <ActionForm action={captureIdea} resetOnSuccess className="panel p-4 sm:p-5">
      <TextField
        label="Idea"
        name="title"
        required
        placeholder="Quoting templates as a standalone product"
      />
      <TextArea
        label="Summary"
        name="summary"
        rows={2}
        placeholder="One or two lines. Capture is not commitment."
      />
      <div className="flex justify-end">
        <SubmitButton>Capture</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function IdeaScoreForm({
  idea,
}: {
  idea: {
    id: string;
    score_potential: number | null;
    score_difficulty: number | null;
    score_cost: number | null;
    score_speed: number | null;
    score_fit: number | null;
    score_advantage: number | null;
    research_notes: string | null;
    validation_notes: string | null;
  };
}) {
  return (
    <ActionForm action={updateIdea} className="panel p-4 sm:p-5">
      <input type="hidden" name="id" value={idea.id} />
      <FieldRow cols={3}>
        {IDEA_DIMENSIONS.map((d) => (
          <TextField
            key={d.key}
            label={`${d.label} (1–10)`}
            name={d.key}
            type="number"
            min="1"
            max="10"
            defaultValue={idea[d.key]}
            hint={d.invert ? "Lower is better" : undefined}
          />
        ))}
      </FieldRow>
      <TextArea
        label="Research notes"
        name="research_notes"
        rows={3}
        defaultValue={idea.research_notes}
        placeholder="What did you find out? Who else is doing this?"
      />
      <TextArea
        label="Validation notes"
        name="validation_notes"
        rows={3}
        defaultValue={idea.validation_notes}
        placeholder="What evidence exists that someone wants this — ideally with money?"
      />
      <div className="flex justify-end">
        <SubmitButton>Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function IdeaStageControls({
  ideaId,
  stage,
  canActivate,
  activationReason,
}: {
  ideaId: string;
  stage: string;
  canActivate: boolean;
  activationReason: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const stages = ["CAPTURE", "RESEARCH", "VALIDATE", "SCORED", "PARKED", "KILLED"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {stages.map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || s === stage}
            onClick={() => startTransition(() => void setIdeaStage(ideaId, s))}
            className={cx(
              "border px-2 py-1 text-[0.5625rem] uppercase tracking-[0.1em] transition-colors",
              s === stage
                ? "border-ink bg-ink text-inverse"
                : "border-line text-ink-ghost hover:border-line-strong hover:text-ink-dim",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || !canActivate}
          onClick={() =>
            startTransition(async () => {
              const result = await activateIdea(ideaId);
              if (result.ok) router.push(`/business/projects/${result.data.projectId}`);
            })
          }
          className="btn btn-primary"
        >
          Activate as a project
        </button>
        <p className="max-w-md text-[0.6875rem] leading-relaxed text-ink-faint">{activationReason}</p>
      </div>
    </div>
  );
}

export function DeleteIdeaButton({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("Delete this idea?")) return;
        startTransition(async () => {
          await deleteIdea(ideaId);
          router.push("/ideas");
        });
      }}
      className="btn btn-ghost"
    >
      Delete
    </button>
  );
}
