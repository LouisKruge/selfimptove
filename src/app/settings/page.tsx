import { formatDay, today } from "@/lib/core/date";
import { all } from "@/lib/db";
import { activeSeason, getUser, listSeasons } from "@/lib/services/core";
import {
  Badge,
  DataRow,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  Section,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import {
  ActivateSeasonButton,
  ProfileForm,
  RebuildScoresButton,
  SeasonForm,
  SeasonWeightsForm,
  ThresholdsForm,
} from "@/components/settings/SettingsForms";
import { SignOutButton } from "@/components/shell/SignOutButton";
import { authEnabled as isAuthEnabled } from "@/lib/auth";
import { configuredWorkouts, diagnostics } from "@/lib/services/diagnostics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const day = today();
  const user = await getUser();
  const season = await activeSeason(day);
  const seasons = await listSeasons();
  const authEnabled = isAuthEnabled();
  const diag = await diagnostics();
  const week = await configuredWorkouts();
  const settings = Object.fromEntries(
    (await all<{ key: string; value: string }>("SELECT key, value FROM settings")).map((s) => [s.key, s.value]),
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Growth"
        title="Settings"
        description="Season weighting decides what the overall score is actually measuring. Thresholds decide what counts as on target."
      />

      <Section title="Current season">
        {season ? (
          <Panel>
            <PanelBody className="space-y-6">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <h3 className="headline text-ink">{season.name}</h3>
                  {season.objective ? (
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">
                      {season.objective}
                    </p>
                  ) : null}
                </div>
                <span className="text-xs text-ink-faint">
                  {formatDay(season.start_date)}
                  {season.end_date ? ` → ${formatDay(season.end_date)}` : ""}
                </span>
              </div>
              <div className="hairline pt-5">
                <KpiGrid cols={5}>
                  <Kpi label="Body" value={`${season.weight_body}%`} />
                  <Kpi label="Business" value={`${season.weight_business}%`} />
                  <Kpi label="Character" value={`${season.weight_character}%`} />
                  <Kpi label="Finance" value={`${season.weight_finance}%`} />
                  <Kpi label="Learning" value={`${season.weight_learning}%`} />
                </KpiGrid>
              </div>
            </PanelBody>
          </Panel>
        ) : (
          <EmptyState
            title="No active season"
            description="Without one, the default weighting applies: Body 25, Business 30, Character 25, Finance 10, Learning 10."
          />
        )}
      </Section>

      {season ? (
        <Section title="Adjust the season">
          <Disclosure label="Edit weights and dates">
            <SeasonWeightsForm season={season} />
          </Disclosure>
        </Section>
      ) : null}

      <Section title="Seasons" meta={`${seasons.length} recorded`}>
        {seasons.length === 0 ? (
          <p className="text-xs text-ink-faint">No seasons defined.</p>
        ) : (
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3">
            {seasons.map((s) => (
              <Panel key={s.id}>
                <PanelBody className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm text-ink">{s.name}</span>
                    <Badge tone={s.status === "ACTIVE" ? "positive" : "muted"}>{s.status}</Badge>
                  </div>
                  <div className="numeral mt-2.5 text-[0.625rem] text-ink-faint">
                    {s.weight_body}/{s.weight_business}/{s.weight_character}/{s.weight_finance}/
                    {s.weight_learning}
                  </div>
                  <div className="mt-3 text-[0.6875rem] text-ink-faint">
                    {formatDay(s.start_date)}
                    {s.end_date ? ` → ${formatDay(s.end_date)}` : ""}
                  </div>
                  {s.status !== "ACTIVE" ? (
                    <div className="mt-4">
                      <ActivateSeasonButton seasonId={s.id} />
                    </div>
                  ) : null}
                </PanelBody>
              </Panel>
            ))}
          </div>
        )}
      </Section>

      <Section title="New season">
        <Disclosure label="Create a season">
          <SeasonForm defaultStart={day} />
        </Disclosure>
      </Section>

      <Section title="Thresholds" meta="What COMMAND treats as on target.">
        <ThresholdsForm settings={settings} />
      </Section>

      {user ? (
        <Section title="Profile">
          <ProfileForm user={user} />
        </Section>
      ) : null}

      <Section title="Access">
        <Panel>
          <PanelBody className="space-y-5">
            <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">
              {authEnabled
                ? "COMMAND is locked with a password. Signing out ends this browser's session; changing COMMAND_PASSWORD on the host ends every session everywhere."
                : "COMMAND is running without a password, which is correct on a machine only you can reach. Set COMMAND_PASSWORD before exposing it to a network."}
            </p>
            {authEnabled ? <SignOutButton /> : null}
          </PanelBody>
        </Panel>
      </Section>

      <Section
        title="Data"
        meta="What this server sees in its own database."
      >
        <Panel>
          <PanelBody className="space-y-6">
            <DataRow label="Database" value={diag.source} />

            <div className="hairline pt-5">
              <p className="label mb-3">Configuration</p>
              <p className="mb-4 max-w-2xl text-sm leading-relaxed text-ink-dim">
                {diag.structureTotal > 0
                  ? "Your system is loaded. These are targets and structure, not measurements."
                  : "Nothing is configured on this database. If you expected data here, this server is pointed at a different database than the one that was populated."}
              </p>
              <div className="grid gap-x-8 sm:grid-cols-2">
                {diag.counts
                  .filter((c) => c.kind === "STRUCTURE")
                  .map((c) => (
                    <DataRow key={c.label} label={c.label} value={String(c.count)} />
                  ))}
              </div>
            </div>

            <div className="hairline pt-5">
              <p className="label mb-3">Recorded by you</p>
              <p className="mb-4 max-w-2xl text-sm leading-relaxed text-ink-dim">
                {diag.loggedTotal > 0
                  ? "Measurements and activity you have logged."
                  : "Nothing logged yet. Every one of these is a baseline waiting to be recorded — they are blank on purpose, never assumed to be zero."}
              </p>
              <div className="grid gap-x-8 sm:grid-cols-2">
                {diag.counts
                  .filter((c) => c.kind === "LOGGED")
                  .map((c) => (
                    <DataRow key={c.label} label={c.label} value={String(c.count)} />
                  ))}
              </div>
            </div>

            {week.length > 0 ? (
              <div className="hairline pt-5">
                <p className="label mb-3">Training week on file</p>
                {week.map((w) => (
                  <DataRow
                    key={w.name}
                    label={w.name}
                    value={`${w.exercises} ${w.exercises === 1 ? "exercise" : "exercises"}`}
                  />
                ))}
              </div>
            ) : null}
          </PanelBody>
        </Panel>
      </Section>

      <Section title="Maintenance">
        <Panel>
          <PanelBody className="space-y-5">
            <p className="max-w-2xl text-sm leading-relaxed text-ink-dim">
              Scores are derived, never typed in. If you change a season weighting or edit historical
              data, recompute so the stored daily scores match what the engine would produce today.
            </p>
            <RebuildScoresButton />
            <div className="hairline pt-5">
              <DataRow label="Database" value={process.env.COMMAND_DB_PATH ?? "data/command.db"} />
              <DataRow label="Timezone" value={user?.timezone ?? "—"} />
              <DataRow label="Currency" value={user?.currency ?? "—"} />
            </div>
          </PanelBody>
        </Panel>
      </Section>
    </div>
  );
}
