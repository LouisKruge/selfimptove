import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDayShort } from "@/lib/core/date";
import { money, pct } from "@/lib/core/format";
import { getSkill, learningForSkill, skillViews } from "@/lib/services/growth";
import {
  Badge,
  EmptyState,
  Kpi,
  KpiGrid,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
  ProgressBar,
  Section,
  TableWrap,
} from "@/components/primitives";
import { Disclosure } from "@/components/forms";
import { ApplyForm, DeleteSkillButton, SkillLevelForm } from "@/components/growth/GrowthForms";

export const dynamic = "force-dynamic";

export default async function SkillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const skill = getSkill(id);
  if (!skill) notFound();

  const view = skillViews().find((s) => s.id === id);
  const items = learningForSkill(id);
  const applied = items.filter((i) => i.applied === 1 || i.kind === "APPLICATION");

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Learning"
        title={skill.name}
        description={skill.why ?? undefined}
        actions={
          <>
            <DeleteSkillButton skillId={skill.id} name={skill.name} />
            <Link href="/learning" className="btn btn-ghost">
              Learning
            </Link>
          </>
        }
      />

      <Panel>
        <PanelBody className="space-y-6">
          <div className="flex flex-wrap items-end gap-10">
            <div>
              <div className="label mb-2">Current level</div>
              <div className="numeral text-5xl font-medium leading-none text-ink">
                {skill.current_level}
                <span className="text-2xl text-ink-faint">/10</span>
              </div>
            </div>
            <div>
              <div className="label mb-2">Target</div>
              <div className="numeral text-5xl font-medium leading-none text-ink-dim">
                {skill.target_level}
                <span className="text-2xl text-ink-ghost">/10</span>
              </div>
            </div>
            <div className="min-w-[16rem] flex-1">
              <ProgressBar
                value={view?.progress ?? null}
                label="Progress"
                right={view ? pct(view.progress) : "—"}
                height="lg"
              />
            </div>
          </div>

          <div className="hairline pt-6">
            <KpiGrid cols={4}>
              <Kpi label="Hours" value={view?.hours ?? 0} />
              <Kpi label="Applications" value={view?.applications ?? 0} />
              <Kpi label="Tests" value={view?.tests ?? 0} />
              <Kpi
                label="Revenue attributed"
                value={view && view.revenueCents > 0 ? money(view.revenueCents) : "—"}
              />
            </KpiGrid>
          </div>

          {skill.evidence ? (
            <p className="hairline pt-6 text-sm leading-relaxed text-ink-dim">
              <span className="label mr-2">Evidence of the target level</span>
              {skill.evidence}
            </p>
          ) : null}
        </PanelBody>
      </Panel>

      <Section title="Adjust">
        <Disclosure label="Update level and evidence">
          <Panel>
            <PanelBody>
              <SkillLevelForm skill={skill} />
            </PanelBody>
          </Panel>
        </Disclosure>
      </Section>

      <Section title="Applications" meta={`${applied.length} of ${items.length} entries applied`}>
        {items.length === 0 ? (
          <EmptyState
            title="Nothing logged for this skill"
            description="Study, practice, application, test. The last two are what move the level."
          />
        ) : (
          <Panel>
            <PanelBody className="space-y-6">
              {items.map((i) => (
                <div key={i.id} className="border-b border-line-soft pb-6 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span className="text-sm text-ink">{i.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge tone="muted">{i.kind}</Badge>
                      <span className="numeral text-[0.6875rem] text-ink-faint">
                        {formatDayShort(i.date)} · {i.minutes}m
                      </span>
                    </div>
                  </div>

                  <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                    {i.what_i_learned ? (
                      <div>
                        <dt className="label mb-1">What I learned</dt>
                        <dd className="leading-relaxed text-ink-dim">{i.what_i_learned}</dd>
                      </div>
                    ) : null}
                    {i.why_it_matters ? (
                      <div>
                        <dt className="label mb-1">Why it matters</dt>
                        <dd className="leading-relaxed text-ink-dim">{i.why_it_matters}</dd>
                      </div>
                    ) : null}
                    {i.how_i_will_apply ? (
                      <div>
                        <dt className="label mb-1">How I will apply it</dt>
                        <dd className="leading-relaxed text-ink-dim">{i.how_i_will_apply}</dd>
                      </div>
                    ) : null}
                    {i.result ? (
                      <div>
                        <dt className="label mb-1">Result</dt>
                        <dd className="leading-relaxed text-ink">{i.result}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {!i.applied && i.kind !== "APPLICATION" ? (
                    <div className="mt-4">
                      <ApplyForm itemId={i.id} />
                    </div>
                  ) : null}
                </div>
              ))}
            </PanelBody>
          </Panel>
        )}
      </Section>
    </div>
  );
}
