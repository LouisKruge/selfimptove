import Link from "next/link";
import { formatCommandDate, today } from "@/lib/core/date";
import {
  briefing,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  type StrategistRole,
} from "@/lib/services/strategist";
import {
  Badge,
  EmptyState,
  PageHeader,
  Panel,
  PanelBody,
  Section,
} from "@/components/primitives";

export const dynamic = "force-dynamic";
export const metadata = { title: "Strategist" };

const ORDER: StrategistRole[] = ["STRATEGIST", "PLANNER", "ANALYST", "REVIEWER", "ACCOUNTABILITY"];

export default async function StrategistPage() {
  const day = today();
  const b = briefing(day);

  const byRole = new Map<StrategistRole, typeof b.observations>();
  for (const o of b.observations) {
    const list = byRole.get(o.role);
    if (list) list.push(o);
    else byRole.set(o.role, [o]);
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={formatCommandDate(day)}
        title="Strategist"
        description="A strategic layer on top of the data, not the centre of the product. Every observation below is derived from what you recorded and states the figures it rests on."
      />

      {b.dataNote ? (
        <Panel>
          <PanelBody>
            <p className="text-sm leading-relaxed text-ink-dim">{b.dataNote}</p>
          </PanelBody>
        </Panel>
      ) : null}

      {b.observations.length === 0 ? (
        <EmptyState
          title="Nothing to raise"
          description="No bottleneck, no shortfall, no unresolved commitment, nothing behind schedule. Keep executing."
        />
      ) : (
        ORDER.filter((r) => byRole.has(r)).map((role) => (
          <Section
            key={role}
            title={ROLE_LABEL[role]}
            meta={ROLE_DESCRIPTION[role]}
          >
            <div className="space-y-px">
              {byRole.get(role)!.map((o, i) => {
                const card = (
                  <PanelBody className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-base leading-snug text-ink">{o.headline}</h3>
                      {o.pillar ? <Badge tone="muted">{o.pillar}</Badge> : null}
                    </div>
                    <p className="mt-2.5 max-w-3xl text-sm leading-relaxed text-ink-dim">
                      {o.detail}
                    </p>
                  </PanelBody>
                );
                return o.href ? (
                  <Link
                    key={i}
                    href={o.href}
                    className="panel block transition-colors hover:border-line-strong"
                  >
                    {card}
                  </Link>
                ) : (
                  <Panel key={i}>{card}</Panel>
                );
              })}
            </div>
          </Section>
        ))
      )}

      <Panel>
        <PanelBody>
          <div className="label mb-3">How this is produced</div>
          <p className="max-w-3xl text-sm leading-relaxed text-ink-dim">
            These observations are computed from your own records by the same engines that
            produce the scores — conversion from recorded stage history, workload from logged
            sessions, cash projections from scheduled movements, promise rate from resolved
            promises. There is no model generating text here, which is precisely why nothing on
            this page can be invented. Where the data is too thin to conclude something, it says
            so instead of guessing.
          </p>
        </PanelBody>
      </Panel>
    </div>
  );
}
