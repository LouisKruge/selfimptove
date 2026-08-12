"use client";

import { useTransition } from "react";
import { activateSeason, createSeason, updateSeason } from "@/lib/actions/plan";
import { rebuildScores, saveProfile, saveSettings } from "@/lib/actions/system";
import { ActionForm, CheckboxField, FieldRow, SubmitButton, TextArea, TextField } from "../forms";

export function ProfileForm({
  user,
}: {
  user: { id: string; name: string; email: string | null; life_vision: string | null };
}) {
  return (
    <ActionForm action={saveProfile} className="panel p-4 sm:p-5">
      <input type="hidden" name="id" value={user.id} />
      <FieldRow cols={2}>
        <TextField label="Name" name="name" defaultValue={user.name} required />
        <TextField label="Email" name="email" type="email" defaultValue={user.email} />
      </FieldRow>
      <TextArea
        label="Life vision"
        name="life_vision"
        rows={3}
        defaultValue={user.life_vision}
        hint="The sentence every other goal in this system exists to serve."
      />
      <div className="flex justify-end">
        <SubmitButton>Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ThresholdsForm({ settings }: { settings: Record<string, string> }) {
  return (
    <ActionForm action={saveSettings} className="panel p-4 sm:p-5">
      <FieldRow cols={3}>
        <TextField
          label="Sleep target (hours)"
          name="sleep_target_hours"
          type="number"
          step="0.5"
          defaultValue={settings.sleep_target_hours ?? "8"}
        />
        <TextField
          label="Savings rate target"
          name="savings_rate_target"
          type="number"
          step="0.01"
          defaultValue={settings.savings_rate_target ?? "0.2"}
          hint="0.2 means 20% of income saved"
        />
        <TextField
          label="Major spend threshold (cents)"
          name="major_spend_cents"
          type="number"
          step="1"
          defaultValue={settings.major_spend_cents ?? "500000"}
          hint="Spending above this escalates a decision in the firewall"
        />
      </FieldRow>
      <FieldRow cols={3}>
        <TextField
          label="Learning days per week"
          name="learning_days_target"
          type="number"
          min="1"
          max="7"
          defaultValue={settings.learning_days_target ?? "5"}
        />
        <TextField
          label="Learning minutes per week"
          name="learning_minutes_target"
          type="number"
          min="0"
          defaultValue={settings.learning_minutes_target ?? "300"}
        />
        <TextField
          label="Streak threshold"
          name="streak_threshold"
          type="number"
          min="0"
          max="100"
          defaultValue={settings.streak_threshold ?? "60"}
          hint="Overall score a day must beat to extend the streak"
        />
      </FieldRow>
      <div className="flex justify-end">
        <SubmitButton>Save thresholds</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SeasonForm({ defaultStart }: { defaultStart: string }) {
  return (
    <ActionForm action={createSeason} resetOnSuccess className="panel p-4 sm:p-5">
      <FieldRow cols={3}>
        <TextField label="Season" name="name" required placeholder="HYROX PERFORMANCE" />
        <TextField label="Start" name="start_date" type="date" defaultValue={defaultStart} />
        <TextField label="End" name="end_date" type="date" />
      </FieldRow>
      <TextArea label="Objective" name="objective" rows={2} />
      <TextArea label="Why" name="why" rows={2} />
      <div>
        <div className="label mb-3">Pillar weights — must total 100</div>
        <FieldRow cols={4}>
          <TextField label="Body" name="weight_body" type="number" min="0" max="100" defaultValue={25} />
          <TextField label="Business" name="weight_business" type="number" min="0" max="100" defaultValue={30} />
          <TextField label="Character" name="weight_character" type="number" min="0" max="100" defaultValue={25} />
          <TextField label="Finance" name="weight_finance" type="number" min="0" max="100" defaultValue={10} />
        </FieldRow>
        <div className="mt-4 max-w-[12rem]">
          <TextField label="Learning" name="weight_learning" type="number" min="0" max="100" defaultValue={10} />
        </div>
      </div>
      <CheckboxField
        label="Make this the active season"
        name="activate"
        hint="Closes the current season and re-weights the overall score from today."
      />
      <div className="flex justify-end">
        <SubmitButton>Create season</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function SeasonWeightsForm({
  season,
}: {
  season: {
    id: string;
    name: string;
    objective: string | null;
    end_date: string | null;
    weight_body: number;
    weight_business: number;
    weight_character: number;
    weight_finance: number;
    weight_learning: number;
  };
}) {
  return (
    <ActionForm action={updateSeason} className="panel p-4 sm:p-5">
      <input type="hidden" name="id" value={season.id} />
      <FieldRow cols={2}>
        <TextField label="Season" name="name" defaultValue={season.name} />
        <TextField label="End" name="end_date" type="date" defaultValue={season.end_date} />
      </FieldRow>
      <TextArea label="Objective" name="objective" rows={2} defaultValue={season.objective} />
      <div>
        <div className="label mb-3">Pillar weights — must total 100</div>
        <FieldRow cols={4}>
          <TextField label="Body" name="weight_body" type="number" min="0" max="100" defaultValue={season.weight_body} />
          <TextField label="Business" name="weight_business" type="number" min="0" max="100" defaultValue={season.weight_business} />
          <TextField label="Character" name="weight_character" type="number" min="0" max="100" defaultValue={season.weight_character} />
          <TextField label="Finance" name="weight_finance" type="number" min="0" max="100" defaultValue={season.weight_finance} />
        </FieldRow>
        <div className="mt-4 max-w-[12rem]">
          <TextField label="Learning" name="weight_learning" type="number" min="0" max="100" defaultValue={season.weight_learning} />
        </div>
      </div>
      <div className="flex justify-end">
        <SubmitButton>Save season</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function ActivateSeasonButton({ seasonId }: { seasonId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void activateSeason(seasonId))}
      className="btn"
    >
      Activate
    </button>
  );
}

export function RebuildScoresButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void rebuildScores(90))}
      className="btn"
    >
      {pending ? "Recomputing…" : "Recompute 90 days of scores"}
    </button>
  );
}
