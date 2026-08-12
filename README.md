# COMMAND

A private, data-driven personal operating system for one person.

COMMAND is not a productivity app, a fitness tracker, a CRM or a budget tool. It
is the system that connects them — 46 screens over one relational model, built
around a single loop:

```
GOAL → PLAN → TARGET → EXECUTE → MEASURE → ANALYZE → ADJUST → IMPROVE
```

Every screen exists to answer one of six questions: what am I trying to achieve,
what am I supposed to do now, what target am I chasing, what actually happened,
am I improving, and what should I do next.

---

## Running it

```bash
npm install
npm run seed        # create the starting structure
npm run dev         # http://localhost:3000
```

Then open the app. `⌘K` (or `Ctrl+K`) opens the command palette; `g` followed by
a letter jumps to any section.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Domain engines (68 unit tests) and end-to-end service/action tests (21) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run seed` | Create the starting structure if the database is empty |
| `npm run seed -- --force` | Rewrite the starting structure over an existing database |
| `npm run reset` | Delete the database and start again |
| `npm run demo` | Reset, then generate 70 days of clearly-labelled synthetic history |

`npm run demo` exists only so the interface can be evaluated with data in it.
Everything it writes is synthetic. Run `npm run reset` to get back to a real,
empty system.

### Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `COMMAND_DB_PATH` | `data/command.db` | SQLite database location |
| `COMMAND_TZ` | `Africa/Johannesburg` | Timezone that defines a calendar day |

---

## The one rule

**COMMAND never fabricates a number.**

This is the constraint that shapes the whole codebase, not a slogan:

- A pillar with nothing logged scores `null`, rendered as `—`. It does not score zero.
- A day the user never touched has no score at all and is excluded from every
  average and trend, because an unused day is unknown, not failed.
- A trend needs four scored days before it will name a direction. Below that it
  says "needs 4 scored days", not "flat".
- A conversion rate needs at least three leads to have reached a stage. Below
  that the rate is `null` and every calculation depending on it is `null` too —
  the revenue funnel will not be back-solved off a guessed rate.
- A training target is never invented. With no history the engine returns the
  template prescription and says so; what it does return is a recommendation the
  user can overwrite in the session.
- A personal record is only recorded when it genuinely beats every value logged
  before it. The first session is a baseline, not a record.
- A HYROX race projection requires all nine components to have been recorded. A
  projection built on guessed splits is worse than none.
- The cash-flow forecast projects only from scheduled movements. Nothing is
  extrapolated from historical averages; an unpredicted expense is simply absent.

Where the system does interpret, it says what the interpretation rests on —
readiness is "a summary of self-reported inputs", never a diagnosis, and
nutrition analysis describes the trend without making medical claims.

---

## Architecture

```
src/
  app/                     Next.js App Router — one directory per surface
  components/
    primitives.tsx         Panel, Kpi, ProgressBar, LineChart, Badge, EmptyState…
    forms.tsx              ActionForm, fields, submit/pending handling
    shell/                 Sidebar, command palette, keyboard shortcuts, theme
    training/ business/ …  Feature components, all client-side write surfaces
  lib/
    core/                  Dates, formatting, ids — no dependencies
    domain/                Pure decision logic. No database, fully unit-tested.
    db/                    schema.sql, connection, insert/update helpers
    services/              Reads: DB → domain → view models
    actions/               Writes: "use server", zod-validated, score-recomputing
    nav.ts, types.ts       Shared navigation map and row types
scripts/                   Schema codegen, seed, demo generator
tests/                     Unit tests for domain, integration tests for the rest
```

The layering is strict and worth preserving:

**`domain/` is pure.** Progression, scoring, trajectory, balance, the cash
forecast, pipeline maths, the impulse firewall, readiness, training load, idea
scoring, HYROX analysis and mission progress are all plain functions over plain
data. They import nothing but each other. This is why they can be tested
exhaustively and why the rules are auditable in one place.

**`services/` read.** They fetch rows, hand them to `domain/`, and return view
models. No writes.

**`actions/` write.** Every mutation is a server action that validates with zod,
returns a readable `ActionResult`, recomputes the affected day's score, and
revalidates the affected paths. Cache revalidation is guarded so a write never
fails because there is no request context (scripts, tests).

### Data

SQLite via `better-sqlite3`, with the schema in `src/lib/db/schema.sql` as the
single source of truth. It is compiled into a TypeScript constant by
`scripts/gen-schema.mjs` (run automatically before dev, build, test and seed) so
the runtime never depends on filesystem layout. `CREATE TABLE IF NOT EXISTS`
handles new tables; columns added to existing tables are listed in
`src/lib/db/migrations.ts` and applied additively on every connection, so a
database with real data in it picks up schema changes without losing anything.

Fifty-six tables with real foreign keys and `CHECK` constraints — RPE is bounded
1–10 in the database, not just the form; pillar weights must total 100; a
bodyweight measurement outside 20–400kg is rejected at the storage layer. Money
is integer cents everywhere. Dates are `YYYY-MM-DD` strings in the app timezone,
so a session logged at 23:50 belongs to that day.

A unique partial index enforces the product rule that only one PRIMARY mission
may be ACTIVE. Lead stage movements are written to an append-only
`lead_stage_events` table, which is the only source of conversion rates.

---

## What each engine does

| Engine | File | Behaviour |
| --- | --- | --- |
| Progressive overload | `domain/progression.ts` | Double progression — hold the load until every working set clears the top of the rep range, then add one increment and drop back to the bottom. Linear and disabled rules supported; increments configurable per exercise. |
| Personal records | `services/records.ts` | Weight, reps, volume, estimated 1RM, run distance and pace (bucketed by distance so 1km is not compared to 21km), and HYROX station times. |
| Scoring | `domain/scoring.ts` | Five pillar scores from weighted components; missing components drop out and the remaining weights renormalise. |
| Trajectory | `domain/trajectory.ts` | Least-squares direction over the score series, with an explicit "insufficient data" state. |
| Balance | `domain/balance.ts` | Names the trade-off when one pillar climbs while another falls. |
| Mission | `domain/mission.ts` | Progress derived from milestones, linked tasks and KPIs, compared against elapsed time to produce ahead / on track / behind / at risk. |
| Cash forecast | `domain/forecast.ts` | 7/30/90-day projection from scheduled items; monthly items clamp to the last day of short months. |
| Pipeline | `domain/pipeline.ts` | Conversion from recorded stage history, bottleneck detection, and backward planning from a revenue target through the real funnel. |
| Impulse firewall | `domain/firewall.ts` | Green / yellow (24h) / red (72h). Borrowing, irreversibility, high emotional intensity, large spend and business pivots escalate. The cooling period cannot be skipped from the interface or the action. |
| Strategist | `services/strategist.ts` | Aggregates every engine into a ranked briefing across five roles — analyst, reviewer, strategist, planner, accountability. |
| Nutrition trend | `domain/nutrition.ts` | Compares logged intake against the actual bodyweight slope and reports whether the two agree. |
| Readiness | `domain/recovery.ts` | Composite of sleep, energy, stress, soreness, recent session RPE and consecutive training days. Requires at least two inputs. |
| Training load | `domain/load.ts` | Acute versus chronic workload, with a baseline-building state until 14 days exist. |
| Idea vault | `domain/ideas.ts` | Weighted score with difficulty and cost inverted; activation gated on research, validation and a complete score. |

---

## The Strategist

`/strategist` is the strategic layer the spec calls for, and it is deliberately
**not** a language model. It runs the same engines that produce the scores and
turns their output into a ranked briefing across five roles — analyst, reviewer,
strategist, planner, accountability — with the figures stated inline:

> **CUSTOMER → RETAINED is the bottleneck** — 0 of 5 leads that reached CUSTOMER
> moved on, 0%. Improving that one step moves more revenue than adding leads at
> the top of the funnel.

> **Learning is being consumed, not applied** — 5 of 13 items over 30 days were
> applied, 38%. Hours only compound once something changed because of them.

Being rule-based is the point. There is no model generating this text, so there
is nowhere for an invented number to come from. Where the data is too thin to
conclude anything, the page says so and stays short.

---

## Interconnection

Nothing here is a standalone dashboard. A single write propagates:

- **Completing a training session** updates the body score, training load,
  strength history, the exercise's records and the day's overall performance.
- **Moving a lead to CUSTOMER** writes a stage event (changing conversion
  rates), creates the customer record, updates MRR, and feeds the business score
  and the backward-planning maths.
- **Logging revenue** optionally mirrors into the finance ledger, so business
  earnings and personal cash stay in step.
- **Resolving a promise** moves the promise rate, the character score and the
  day's overall performance.
- **Changing the season's pillar weights** changes what the overall score
  measures from that day forward.
- **Delegating a task** keeps the outcome linked to its goal and mission while
  removing it from the day's own load.

---

## Design

Monochromatic: black, near-black, graphite, white, off-white, grey. Status
colour appears only where a human needs to act — a projected shortfall, a
blocked task, a broken promise — and never for decoration. No gradients, no
glassmorphism, no neon. Tabular numerals throughout, because this is an
instrument panel.

Dark by default. Light exists for daylight use and is an explicit, persisted
choice.

Mobile prioritises the execution surfaces: Overview, Today, Training and
Nutrition sit in the bottom bar; everything else is a drawer away. Live workout
mode is built for a phone in a gym — large inputs, one primary button, an
automatic rest timer with pause, skip and ±15 seconds.

---

## Testing

```bash
npm test
```

- **68 unit tests** over the domain engines: progression across a full
  double-progression cycle, e1RM bounds, scoring with missing components,
  trajectory thresholds, cash-forecast month clamping, conversion sample floors,
  backward funnel planning, firewall escalation, HYROX projection gating,
  interval analysis, habit consistency scaled to habit age, and more.
- **21 integration tests** over a throwaway database exercising the real
  services and server actions: schema constraints, the schedule → log → complete
  → record → progress cycle, the one-must-win-per-day rule, empty-day scoring,
  conversion rates from stage history, forecast shortfalls, the firewall
  refusing a decision inside its cooling period, the habit ceiling, and idea
  activation gating.

Every route was smoke-tested for a 200, every page checked for horizontal
overflow at 390px, and the live workout loop driven end to end in a real browser.

---

## Starting state

`npm run seed` creates structure only — the FOUNDATION season, the BUILD THE
MACHINE 90-day mission with its eight milestones and four KPIs, a goal hierarchy
from life vision down to one-year targets, 41 exercises, 12 workout templates,
seven habits, five skills and a nutrition target.

It creates no history. Scores, trends and records begin the moment something
real is logged.
