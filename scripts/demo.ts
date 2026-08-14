/**
 * Demo history generator.
 *
 * Everything this writes is synthetic and exists only so the interface can be
 * evaluated with data in it. It is never produced by the app itself — COMMAND
 * will not invent a number the user did not record. Run `npm run reset` to
 * clear it and start from a real, empty system.
 */

import { randomUUID } from "node:crypto";
import type { Client } from "@libsql/client";

const DAYS = 70;

/* Deterministic PRNG so the demo dataset is reproducible. */
let seed = 0x5eed1234;
function rand(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) % 100000) / 100000;
}
function between(lo: number, hi: number): number {
  return lo + rand() * (hi - lo);
}
function chance(p: number): boolean {
  return rand() < p;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dow(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

export async function generateDemo(db: Client): Promise<string> {
  const now = () => new Date().toISOString();
  const uid = () => randomUUID();

  const insert = async (table: string, values: Record<string, unknown>): Promise<string> => {
    const id = (values.id as string) ?? uid();
    const ts = now();
    const row: Record<string, unknown> = { id, created_at: ts, updated_at: ts, ...values };
    const cols = Object.keys(row).filter((k) => row[k] !== undefined);
    await db.execute({
      sql: `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      args: cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined) return null;
        if (typeof v === "boolean") return v ? 1 : 0;
        return v as string | number;
      }),
    });
    return id;
  };

  const rows = <T>(result: { rows: unknown[]; columns: string[] }): T[] =>
    result.rows.map((row) => {
      const object: Record<string, unknown> = {};
      result.columns.forEach((column, index) => {
        object[column] = (row as unknown[])[index];
      });
      return object as T;
    });

  const many = async <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    rows<T>(await db.execute({ sql, args: params as never[] }));
  const one = async <T>(sql: string, params: unknown[] = []): Promise<T | undefined> =>
    (await many<T>(sql, params))[0];

  const today = todayString();
  const start = addDays(today, -(DAYS - 1));
  const days: string[] = [];
  for (let i = 0; i < DAYS; i++) days.push(addDays(start, i));

  const exerciseId = async (name: string) =>
    (await one<{ id: string }>("SELECT id FROM exercises WHERE name = ?", [name]))?.id;
  const workout = async (name: string) =>
    await one<{ id: string; type: string }>("SELECT id, type FROM workouts WHERE name = ?", [name]);

  const created = {
    sessions: 0,
    sets: 0,
    runs: 0,
    meals: 0,
    tasks: 0,
    leads: 0,
    revenue: 0,
    habits: 0,
  };

  // Run directly rather than in one transaction: libSQL transactions are async
  // and this generator is a local evaluation tool, not a durability-critical path.
  await (async () => {
    /* ------------------------------------------------------------ FINANCE */
    const cheque = await insert("accounts", {
          name: "Cheque account (demo)",
          kind: "CASH",
          balance_cents: 4_250_00,
          include_in_cash: 1,
        });
    await insert("accounts", {
            name: "Savings (demo)",
            kind: "SAVINGS",
            balance_cents: 18_400_00,
            include_in_cash: 1,
          });

    const debtId = await insert("debts", {
          name: "Credit card (demo)",
          kind: "CREDIT_CARD",
          original_cents: 62_000_00,
          balance_cents: 41_500_00,
          interest_rate: 19.5,
          min_payment_cents: 3_200_00,
          due_day: 28,
          status: "ACTIVE",
        });
    await insert("debts", {
            name: "Vehicle finance (demo)",
            kind: "VEHICLE",
            original_cents: 210_000_00,
            balance_cents: 148_300_00,
            interest_rate: 12.25,
            min_payment_cents: 5_400_00,
            due_day: 1,
            status: "ACTIVE",
          });

    await insert("scheduled_cash_items", { name: "Rent", direction: "OUT", amount_cents: 12_500_00, cadence: "MONTHLY", day_of_month: 1, category: "Housing", active: 1 });
    await insert("scheduled_cash_items", { name: "Vehicle finance", direction: "OUT", amount_cents: 5_400_00, cadence: "MONTHLY", day_of_month: 1, category: "Debt", active: 1 });
    await insert("scheduled_cash_items", { name: "Credit card minimum", direction: "OUT", amount_cents: 3_200_00, cadence: "MONTHLY", day_of_month: 28, category: "Debt", debt_id: debtId, active: 1 });
    await insert("scheduled_cash_items", { name: "Groceries", direction: "OUT", amount_cents: 1_800_00, cadence: "WEEKLY", day_of_week: 6, category: "Food", active: 1 });
    await insert("scheduled_cash_items", { name: "Gym", direction: "OUT", amount_cents: 899_00, cadence: "MONTHLY", day_of_month: 3, category: "Health", active: 1 });
    await insert("scheduled_cash_items", { name: "Salary", direction: "IN", amount_cents: 32_000_00, cadence: "MONTHLY", day_of_month: 25, category: "Income", active: 1 });

    await insert("investments", {
            name: "Global equity ETF (demo)",
            asset_class: "ETF",
            objective: "Long-term compounding. Not touched.",
            opened_at: addDays(today, -420),
            cost_basis_cents: 46_000_00,
            current_cents: 52_180_00,
          });
    await insert("investments", {
            name: "Retirement annuity (demo)",
            asset_class: "BOND",
            objective: "Tax-efficient long-term holding.",
            opened_at: addDays(today, -900),
            cost_basis_cents: 88_000_00,
            current_cents: 95_400_00,
          });
    await insert("assets", { name: "Vehicle (demo)", kind: "VEHICLE", value_cents: 176_000_00 });

    /* ----------------------------------------------------------- BUSINESS */
    const business = await one<{ id: string }>("SELECT id FROM businesses LIMIT 1");
    if (business) {
      await db.execute({
      sql: "UPDATE businesses SET target_customer = ?, offer = ?, avg_deal_cents = ?, stage = ?, model = ?, updated_at = ? WHERE id = ?",
      args: ["Owner-run trades businesses in Gauteng doing R200k–R800k/month who lose quotes to slow follow-up.",
        "A done-for-you quoting and follow-up system, installed in 14 days. R5,000 setup then R5,000/month.",
        5_000_00,
        "LAUNCH",
        "Productised service with a monthly retainer.",
        now(),
        business.id],
    });
    }

    const companies = [
      "Meridian Plumbing", "Coastal Electrical", "Vantage Roofing", "Ironclad Fabrication",
      "Northbridge HVAC", "Summit Landscaping", "Cobalt Security", "Harbourline Glass",
      "Ridgeway Paving", "Stonecrest Interiors", "Blackwood Joinery", "Apex Solar",
      "Delta Refrigeration", "Kestrel Signage", "Foundry Metalworks", "Pinnacle Flooring",
      "Verge Cleaning", "Anchor Logistics", "Halcyon Pools", "Brightwater Irrigation",
      "Trellis Painting", "Quarry Stoneworks", "Silverline Windows", "Beacon Alarms",
    ];
    const sources = ["Cold email", "Referral", "LinkedIn", "Networking", "Inbound"];
    const STAGES = ["PROSPECT", "CONTACTED", "RESPONDED", "MEETING", "PROPOSAL", "CUSTOMER", "RETAINED"];

    for (const [i, company] of companies.entries()) {
      // A realistic funnel: most stall early, a few convert.
      const roll = rand();
      let depth: number;
      if (roll < 0.28) depth = 0;
      else if (roll < 0.52) depth = 1;
      else if (roll < 0.7) depth = 2;
      else if (roll < 0.84) depth = 3;
      else if (roll < 0.93) depth = 4;
      else depth = 5;

      const lost = depth < 5 && chance(0.3);
      const finalStage = lost ? "LOST" : STAGES[depth];
      const startedOn = days[Math.floor(between(0, DAYS - 12))];
      const potential = Math.round(between(3500, 12000)) * 100;

      const leadId = await insert("leads", {
              company,
              contact_name: null,
              source: sources[i % sources.length],
              stage: finalStage,
              potential_cents: potential,
              probability: lost ? 0 : [5, 10, 25, 40, 60, 100][depth],
              last_contact_date: addDays(startedOn, depth * 3),
              next_action:
                lost || depth >= 5
                  ? null
                  : ["Send first email", "Follow up", "Book the call", "Run the call", "Send proposal"][depth],
              next_action_date:
                lost || depth >= 5 ? null : addDays(today, Math.round(between(-4, 6))),
              lost_reason: lost ? "Went quiet after follow-up." : null,
              closed_at: lost ? now() : null,
            });
      created.leads++;

      for (let s = 0; s <= depth; s++) {
        await insert("lead_stage_events", {
                    lead_id: leadId,
                    from_stage: s === 0 ? null : STAGES[s - 1],
                    to_stage: STAGES[s],
                    date: addDays(startedOn, s * 3),
                  });
      }
      if (lost) {
        await insert("lead_stage_events", {
                    lead_id: leadId,
                    from_stage: STAGES[depth],
                    to_stage: "LOST",
                    date: addDays(startedOn, (depth + 1) * 3),
                  });
      }

      if (!lost && depth >= 5) {
        const startedAt = addDays(startedOn, 15);
        await insert("customers", {
                    lead_id: leadId,
                    business_id: business?.id ?? null,
                    name: company,
                    status: "ACTIVE",
                    mrr_cents: 5_000_00,
                    started_at: startedAt,
                  });
        // Setup fee, then a monthly retainer for each month since.
        await insert("revenue_entries", {
                    business_id: business?.id ?? null,
                    date: startedAt,
                    amount_cents: 5_000_00,
                    kind: "ONE_OFF",
                    description: `${company} — setup`,
                    received: 1,
                  });
        created.revenue++;
        let billing = addDays(startedAt, 30);
        while (billing <= today) {
          await insert("revenue_entries", {
                        business_id: business?.id ?? null,
                        date: billing,
                        amount_cents: 5_000_00,
                        kind: "RECURRING",
                        description: `${company} — retainer`,
                        received: 1,
                      });
          created.revenue++;
          billing = addDays(billing, 30);
        }
      }
    }

    for (const [name, amount] of [
      ["Hosting & tooling", 1_450_00],
      ["Email outreach software", 890_00],
      ["Design contractor", 4_200_00],
    ] as Array<[string, number]>) {
      await insert("business_expenses", {
                business_id: business?.id ?? null,
                date: addDays(today, -Math.round(between(2, 50))),
                amount_cents: amount,
                category: "Operations",
                description: name,
                recurring: 0,
              });
    }

    /* ----------------------------------------------------------- PROJECTS */
    const mission = await one<{ id: string }>(
          "SELECT id FROM missions WHERE kind = 'PRIMARY' AND status = 'ACTIVE'",
        );
    const projects = [
      { title: "Launch MVP", objective: "Ship the quoting workflow customers can actually use.", status: "ACTIVE", next: "Complete billing integration", impact: 30_000_00 },
      { title: "Outbound engine", objective: "A repeatable way to put 20 qualified prospects into the pipeline weekly.", status: "ACTIVE", next: "Rewrite the second-touch email", impact: 25_000_00 },
      { title: "Onboarding playbook", objective: "Get a new customer live in 14 days without me improvising.", status: "BLOCKED", next: "Decide on the handover template", impact: 8_000_00 },
    ];
    const projectIds: string[] = [];
    for (const p of projects) {
      projectIds.push(
        await insert("projects", {
                    mission_id: mission?.id ?? null,
                    business_id: business?.id ?? null,
                    pillar: "BUSINESS",
                    title: p.title,
                    objective: p.objective,
                    expected_outcome: null,
                    revenue_impact: p.impact,
                    deadline: addDays(today, Math.round(between(10, 45))),
                    status: p.status,
                    next_action: p.next,
                  }),
      );
    }

    await insert("risks", {
            mission_id: mission?.id ?? null,
            project_id: projectIds[0],
            title: "Billing integration is the single point of failure for launch",
            detail: "Nothing can be charged until it works, and it is the only unfinished piece.",
            severity: "HIGH",
            likelihood: "LIKELY",
            mitigation: "Timebox to three days, then fall back to manual invoicing.",
            status: "OPEN",
          });

    // Milestones progress in step with the demo funnel.
    const milestones = await many<{ id: string; sort_order: number }>(
          "SELECT id, sort_order FROM milestones WHERE mission_id = ? ORDER BY sort_order",
          [mission?.id ?? ""],
        );
    for (const [i, m] of milestones.entries()) {
      const status = i < 4 ? "COMPLETE" : i === 4 ? "IN_PROGRESS" : "PENDING";
      await db.execute({
        sql: "UPDATE milestones SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?",
        args: [status, status === "COMPLETE" ? now() : null, now(), m.id],
      });
    }

    const customerCount = ((await one<{ v: number }>("SELECT COUNT(*) AS v FROM customers"))?.v ?? 0);
    const revenueTotal = ((await one<{ v: number }>("SELECT COALESCE(SUM(amount_cents),0) AS v FROM revenue_entries"))?.v ?? 0);
    const kpiUpdates: Array<[string, number]> = [
      ["Paying customers", customerCount],
      ["Monthly revenue", Math.round(revenueTotal / 100 / 3)],
      ["Qualified leads generated", companies.length],
      ["Sales conversations held", 9],
    ];
    for (const [name, value] of kpiUpdates) {
      await db.execute({
      sql: "UPDATE mission_kpis SET current_value = ?, updated_at = ? WHERE mission_id = ? AND name = ?",
      args: [value, now(), mission?.id ?? "", name],
    });
    }

    /* Backdate the season and mission so elapsed time reflects the demo window. */
    await db.execute({
      sql: "UPDATE seasons SET start_date = ?, updated_at = ? WHERE status = 'ACTIVE'",
      args: [start,
      now()],
    });
    if (mission) {
      await db.execute({
      sql: "UPDATE missions SET start_date = ?, end_date = ?, current_value = ?, updated_at = ? WHERE id = ?",
      args: [start,
        addDays(start, 89),
        Math.round(revenueTotal / 100 / 3),
        now(),
        mission.id],
    });
    }

    /* ------------------------------------------------------------ TRAINING */
    const templates = (
      await Promise.all(["PUSH A", "PULL A", "LEGS A", "UPPER", "LOWER"].map(workout))
    ).filter((w): w is { id: string; type: string } => Boolean(w));

    // Starting loads for the demo lifter, progressed by the same rules the app uses.
    const loads = new Map<string, number>([
      ["Barbell Bench Press", 80],
      ["Overhead Press", 47.5],
      ["Incline Dumbbell Press", 28],
      ["Lateral Raise", 10],
      ["Triceps Rope Pushdown", 25],
      ["Barbell Row", 70],
      ["Seated Cable Row", 60],
      ["Face Pull", 22.5],
      ["Barbell Curl", 30],
      ["Back Squat", 105],
      ["Romanian Deadlift", 90],
      ["Bulgarian Split Squat", 20],
      ["Leg Curl", 45],
      ["Standing Calf Raise", 70],
      ["Deadlift", 130],
      ["Front Squat", 75],
      ["Walking Lunge", 20],
      ["Dumbbell Shoulder Press", 24],
      ["Lat Pulldown", 65],
      ["Hammer Curl", 14],
    ]);
    const repProgress = new Map<string, number>();

    let templateIndex = 0;

    for (const day of days) {
      const weekday = dow(day);
      // Mon/Wed/Fri lift · Tue/Sat run · Thu HYROX conditioning · Sun rest.
      const isLiftDay = weekday === 1 || weekday === 3 || weekday === 5;
      const isRunDay = weekday === 2 || weekday === 6;
      const isHyroxDay = weekday === 4;
      const skipped = chance(0.12);

      if (isLiftDay) {
        const template = templates[templateIndex % templates.length];
        templateIndex++;
        const rows = await many<{
                  exercise_id: string;
                  target_sets: number;
                  rep_min: number | null;
                  rep_max: number | null;
                  rest_sec: number | null;
                }>(
                  "SELECT exercise_id, target_sets, rep_min, rep_max, rest_sec FROM workout_exercises WHERE workout_id = ? ORDER BY sort_order",
                  [template.id],
                );
        const name = (await one<{ name: string }>("SELECT name FROM workouts WHERE id = ?", [template.id]))!.name;

        const sessionId = await insert("workout_sessions", {
                  workout_id: template.id,
                  date: day,
                  name,
                  type: "STRENGTH",
                  status: skipped ? "SKIPPED" : "COMPLETED",
                  duration_min: skipped ? null : Math.round(between(52, 78)),
                  session_rpe: skipped ? null : Math.round(between(6, 9) * 2) / 2,
                  completed_at: skipped ? null : `${day}T18:30:00.000Z`,
                });
        created.sessions++;

        for (const [i, row] of rows.entries()) {
          const exName = await one<{ name: string; increment_kg: number }>(
                      "SELECT name, increment_kg FROM exercises WHERE id = ?",
                      [row.exercise_id],
                    );
          if (!exName) continue;

          const sxId = await insert("session_exercises", {
                      session_id: sessionId,
                      exercise_id: row.exercise_id,
                      sort_order: i,
                      target_sets: row.target_sets,
                      rep_min: row.rep_min,
                      rep_max: row.rep_max,
                      target_weight_kg: loads.get(exName.name) ?? null,
                      rest_sec: row.rest_sec,
                      target_source: "PROGRESSION",
                      target_rationale: "Demo history.",
                    });

          if (skipped) continue;

          const repMin = row.rep_min ?? 8;
          const repMax = row.rep_max ?? 10;
          const weight = loads.get(exName.name) ?? 0;
          const key = exName.name;
          const progress = repProgress.get(key) ?? 0;

          let cleared = true;
          for (let s = 1; s <= row.target_sets; s++) {
            // Reps climb toward the top of the range, then the load moves up.
            const base = Math.min(repMax, repMin + progress + (s <= 1 ? 1 : 0));
            const reps = Math.max(repMin - 1, Math.round(base - (s - 1) * (chance(0.5) ? 1 : 0)));
            if (reps < repMax) cleared = false;
            await insert("workout_sets", {
                            session_exercise_id: sxId,
                            session_id: sessionId,
                            exercise_id: row.exercise_id,
                            date: day,
                            set_index: s,
                            weight_kg: weight > 0 ? weight : null,
                            reps,
                            rpe: Math.round(between(7, 9.5) * 2) / 2,
                            rir: Math.round(between(0, 2)),
                            is_warmup: 0,
                          });
            created.sets++;
          }

          if (cleared) {
            loads.set(key, Math.round((weight + exName.increment_kg) * 100) / 100);
            repProgress.set(key, 0);
          } else {
            repProgress.set(key, Math.min(repMax - repMin, progress + (chance(0.55) ? 1 : 0)));
          }
        }
      }

      if (isRunDay && !chance(0.15)) {
        const long = weekday === 6;
        const intervals = !long && chance(0.4);
        const distance = long
          ? Math.round(between(11000, 16000))
          : intervals
            ? 6400
            : Math.round(between(5000, 8500));
        // Pace improves gradually across the window.
        const dayIndex = days.indexOf(day);
        const drift = (dayIndex / DAYS) * 18;
        const basePace = long ? 348 : intervals ? 268 : 322;
        const pace = Math.round(basePace - drift + between(-8, 8));
        const duration = Math.round((distance / 1000) * pace);

        const runSessionId = await insert("workout_sessions", {
                  date: day,
                  name: long ? "LONG RUN" : intervals ? "INTERVALS" : "ZONE 2",
                  type: "RUN",
                  status: "COMPLETED",
                  duration_min: Math.round(duration / 60),
                  session_rpe: intervals ? 8.5 : long ? 7 : 5,
                  completed_at: `${day}T06:15:00.000Z`,
                });
        created.sessions++;

        const runId = await insert("runs", {
                  session_id: runSessionId,
                  date: day,
                  type: long ? "LONG" : intervals ? "INTERVALS" : "ZONE2",
                  distance_m: distance,
                  duration_sec: duration,
                  avg_pace_sec: pace,
                  avg_hr: Math.round(between(138, 168)),
                  rpe: intervals ? 8.5 : long ? 7 : 5,
                  target_pace_sec: intervals ? 270 : null,
                });
        created.runs++;

        if (intervals) {
          for (let i = 1; i <= 6; i++) {
            const splitPace = Math.round(between(258, 278));
            await insert("run_intervals", {
                            run_id: runId,
                            interval_index: i,
                            distance_m: 800,
                            duration_sec: Math.round(splitPace * 0.8),
                            pace_sec: splitPace,
                            target_pace_sec: 270,
                            recovery_sec: 90,
                          });
          }
        }
      }

      if (isHyroxDay && !chance(0.2)) {
        const w = await workout("HYROX CONDITIONING");
        await insert("workout_sessions", {
                    workout_id: w?.id ?? null,
                    date: day,
                    name: "HYROX CONDITIONING",
                    type: "HYROX",
                    status: "COMPLETED",
                    duration_min: Math.round(between(48, 66)),
                    session_rpe: Math.round(between(7.5, 9) * 2) / 2,
                    completed_at: `${day}T18:00:00.000Z`,
                  });
        created.sessions++;
      }

      /* --------------------------------------------------------- NUTRITION */
      if (!chance(0.1)) {
        const calories = Math.round(between(2650, 3250));
        const protein = Math.round(between(150, 200));
        const logId = await insert("nutrition_logs", {
                  date: day,
                  calories,
                  protein_g: protein,
                  carbs_g: Math.round(between(280, 380)),
                  fat_g: Math.round(between(70, 100)),
                  fiber_g: Math.round(between(22, 40)),
                  water_ml: Math.round(between(2200, 4000)),
                });
        const mealCount = 3 + (chance(0.5) ? 1 : 0);
        for (let m = 0; m < mealCount; m++) {
          await insert("meals", {
                        nutrition_log_id: logId,
                        date: day,
                        name: ["Oats & whey", "Chicken, rice & veg", "Beef mince & potato", "Whey shake"][m % 4],
                        slot: ["BREAKFAST", "LUNCH", "DINNER", "SHAKE"][m % 4],
                        calories: Math.round(calories / mealCount),
                        protein_g: Math.round(protein / mealCount),
                        carbs_g: Math.round(between(50, 90)),
                        fat_g: Math.round(between(15, 30)),
                        fiber_g: Math.round(between(4, 10)),
                        logged_at: `${day}T12:00:00.000Z`,
                      });
          created.meals++;
        }
      }

      /* ---------------------------------------------------------- RECOVERY */
      if (!chance(0.15)) {
        await insert("recovery_logs", {
                    date: day,
                    sleep_hours: Math.round(between(5.8, 8.4) * 10) / 10,
                    sleep_quality: Math.round(between(2, 5)),
                    energy: Math.round(between(2, 5)),
                    stress: Math.round(between(1, 4)),
                    soreness: Math.round(between(1, 4)),
                    motivation: Math.round(between(2, 5)),
                    is_rest_day: weekday === 0 ? 1 : 0,
                  });
      }

      /* ------------------------------------------------------ MEASUREMENTS */
      if (weekday === 1 || weekday === 4) {
        const idx = days.indexOf(day);
        await insert("body_measurements", {
                    date: day,
                    weight_kg: Math.round((84.2 + (idx / DAYS) * 2.1 + between(-0.5, 0.5)) * 10) / 10,
                    waist_cm: Math.round((84 - (idx / DAYS) * 1.2 + between(-0.4, 0.4)) * 10) / 10,
                    chest_cm: Math.round((105 + (idx / DAYS) * 1.6) * 10) / 10,
                    arm_cm: Math.round((37.5 + (idx / DAYS) * 0.9) * 10) / 10,
                    body_fat_pct: Math.round((16.8 - (idx / DAYS) * 1.1 + between(-0.3, 0.3)) * 10) / 10,
                  });
      }

      /* -------------------------------------------------------------- WORK */
      const isWeekend = weekday === 0 || weekday === 6;
      if (!isWeekend) {
        const mustWinDone = chance(0.74);
        await insert("tasks", {
                    project_id: projectIds[Math.floor(rand() * projectIds.length)],
                    mission_id: mission?.id ?? null,
                    pillar: "BUSINESS",
                    title: pickTask(),
                    expected_outcome: null,
                    priority: "MUST_WIN",
                    scheduled_date: day,
                    estimated_minutes: 90,
                    status: mustWinDone ? "COMPLETE" : chance(0.5) ? "TODO" : "CANCELLED",
                    completed_at: mustWinDone ? `${day}T14:00:00.000Z` : null,
                  });
        created.tasks++;

        for (let t = 0; t < 2; t++) {
          const done = chance(0.62);
          await insert("tasks", {
                        project_id: projectIds[Math.floor(rand() * projectIds.length)],
                        mission_id: mission?.id ?? null,
                        pillar: chance(0.75) ? "BUSINESS" : "FINANCE",
                        title: pickTask(),
                        priority: "SUPPORT",
                        scheduled_date: day,
                        estimated_minutes: 45,
                        status: done ? "COMPLETE" : "TODO",
                        completed_at: done ? `${day}T16:00:00.000Z` : null,
                      });
          created.tasks++;
        }
      }

      /* ------------------------------------------------------------ HABITS */
      for (const habit of await many<{ id: string; target_per_week: number }>(
              "SELECT id, target_per_week FROM habits WHERE active = 1",
            )) {
        const likelihood = habit.target_per_week / 7 - 0.08;
        if (chance(likelihood)) {
          await insert("habit_logs", { habit_id: habit.id, date: day, done: 1 });
          created.habits++;
        }
      }

      /* ---------------------------------------------------------- PROMISES */
      if (chance(0.55)) {
        const kept = chance(0.82);
        await insert("promises", {
                    text: pickPromise(),
                    pillar: chance(0.5) ? "BODY" : "BUSINESS",
                    date: day,
                    due_time: "18:00",
                    status: day === today ? "OPEN" : kept ? "KEPT" : "BROKEN",
                    resolved_at: day === today ? null : now(),
                  });
      }

      /* ---------------------------------------------------------- LEARNING */
      if (!isWeekend && chance(0.6)) {
        const applied = chance(0.45);
        const skill = await one<{ id: string }>("SELECT id FROM skills ORDER BY RANDOM() LIMIT 1");
        await insert("learning_items", {
                    skill_id: skill?.id ?? null,
                    title: pickLearning(),
                    kind: applied ? "APPLICATION" : "STUDY",
                    date: day,
                    minutes: Math.round(between(25, 75)),
                    what_i_learned: "Demo entry.",
                    applied: applied ? 1 : 0,
                    applied_at: applied ? now() : null,
                  });
      }

      /* ------------------------------------------------------------- MONEY */
      if (chance(0.7)) {
        await insert("personal_expenses", {
                    date: day,
                    amount_cents: Math.round(between(80, 900)) * 100,
                    category: ["Food", "Transport", "Household", "Health", "Other"][Math.floor(rand() * 5)],
                    description: null,
                    essential: chance(0.7) ? 1 : 0,
                    recurring: 0,
                  });
      }
      if (Number(day.slice(8, 10)) === 25) {
        await insert("income_entries", {
                    date: day,
                    amount_cents: 32_000_00,
                    source: "SALARY",
                    description: "Salary",
                    recurring: 1,
                  });
      }
    }

    /* --------------------------------------------------------- HYROX SIM */
    const simDay = addDays(today, -12);
    const hyroxId = await insert("hyrox_sessions", {
          date: simDay,
          kind: "FULL_SIM",
          division: "OPEN",
          notes: "First full simulation. Wall balls fell apart at the end.",
        });
    const sim: Array<[string, number, Record<string, number>]> = [
      ["SKIERG", 258, { distance_m: 1000 }],
      ["SLED_PUSH", 172, { distance_m: 50, weight_kg: 152 }],
      ["SLED_PULL", 205, { distance_m: 50, weight_kg: 103 }],
      ["BURPEE_BROAD_JUMP", 331, { distance_m: 80 }],
      ["ROW", 249, { distance_m: 1000 }],
      ["FARMERS_CARRY", 118, { distance_m: 200, weight_kg: 24 }],
      ["SANDBAG_LUNGES", 288, { distance_m: 100, weight_kg: 20 }],
      ["WALL_BALLS", 424, { reps: 100, weight_kg: 6 }],
    ];
    let seq = 1;
    for (const [i, [station, seconds, extra]] of sim.entries()) {
      await insert("hyrox_stations", {
        hyrox_session_id: hyroxId,
        station: "RUN",
        sequence: seq++,
        duration_sec: Math.round(298 + i * 6 + between(-6, 6)),
        distance_m: 1000,
        transition_sec: 12,
      });
      await insert("hyrox_stations", {
        hyrox_session_id: hyroxId,
        station,
        sequence: seq++,
        duration_sec: seconds,
        transition_sec: 14,
        ...extra,
      });
    }
    const totals = await one<{ run: number; work: number; trans: number }>(
          `SELECT
         COALESCE(SUM(CASE WHEN station = 'RUN' THEN duration_sec ELSE 0 END), 0) AS run,
         COALESCE(SUM(CASE WHEN station <> 'RUN' THEN duration_sec ELSE 0 END), 0) AS work,
         COALESCE(SUM(transition_sec), 0) AS trans
       FROM hyrox_stations WHERE hyrox_session_id = ?`,
          [hyroxId],
        );
    await db.execute({
      sql: "UPDATE hyrox_sessions SET run_total_sec = ?, station_total_sec = ?, transition_sec = ?, total_sec = ?, updated_at = ? WHERE id = ?",
      args: [totals?.run ?? 0,
      totals?.work ?? 0,
      totals?.trans ?? 0,
      (totals?.run ?? 0) + (totals?.work ?? 0) + (totals?.trans ?? 0),
      now(),
      hyroxId],
    });

    /* ------------------------------------------------------------- IDEAS */
    await insert("ideas", {
            title: "Quoting templates as a standalone product",
            summary: "Sell the templates without the service for a lower price point.",
            stage: "VALIDATE",
            score_potential: 6,
            score_difficulty: 3,
            score_cost: 2,
            score_speed: 8,
            score_fit: 7,
            score_advantage: 5,
            research_notes: "Three customers asked whether they could buy just the templates.",
            validation_notes: null,
          });
    await insert("ideas", {
            title: "Trades-specific CRM",
            summary: "A full CRM rather than a service layer on top of what they already use.",
            stage: "PARKED",
            score_potential: 9,
            score_difficulty: 9,
            score_cost: 8,
            score_speed: 2,
            score_fit: 4,
            score_advantage: 4,
            research_notes: "Crowded market, long build.",
            validation_notes: "Not now. Wrong season for a product this heavy.",
          });
    await insert("ideas", { title: "Weekly newsletter for trades owners", stage: "CAPTURE" });

    /* ---------------------------------------------------------- DECISIONS */
    await insert("decisions", {
            title: "Hire a part-time setter",
            problem: "Outreach is the bottleneck and it is all manual.",
            objective: "More qualified conversations without losing build time.",
            level: "YELLOW",
            pillar: "BUSINESS",
            reversibility: "COSTLY",
            emotional_intensity: 2,
            amount_cents: 8_000_00,
            cooling_until: new Date(Date.now() + 9 * 3_600_000).toISOString(),
            status: "COOLING",
          });
    await insert("decisions", {
            title: "Drop the lower-priced tier",
            problem: "The cheap tier attracts customers who need the most support.",
            objective: "Protect delivery capacity.",
            level: "GREEN",
            pillar: "BUSINESS",
            reversibility: "REVERSIBLE",
            emotional_intensity: 1,
            status: "DECIDED",
            decision: "Dropped it. One price, one promise.",
            decided_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
            outcome: "Support load fell and close rate did not change.",
            outcome_rating: 4,
            outcome_recorded_at: now(),
            lesson: "Cheap tiers cost more than they earn.",
          });

    /* -------------------------------------------------------- NET WORTH */
    for (let w = 8; w >= 0; w--) {
      const day = addDays(today, -w * 7);
      const drift = (8 - w) * 1400_00;
      const cash = 22_650_00 + drift / 3;
      const investments = 147_580_00 + drift;
      const liabilities = 189_800_00 - (8 - w) * 2_100_00;
      await insert("net_worth_snapshots", {
                date: day,
                cash_cents: Math.round(cash),
                investments_cents: Math.round(investments),
                property_cents: 0,
                business_cents: 0,
                other_assets_cents: 176_000_00,
                liabilities_cents: Math.round(liabilities),
                net_worth_cents: Math.round(cash + investments + 176_000_00 - liabilities),
              });
    }
  })();

  return [
    `  demo history spans ${DAYS} days (${start} → ${today})`,
    `  sessions ${created.sessions} · sets ${created.sets} · runs ${created.runs}`,
    `  meals ${created.meals} · tasks ${created.tasks} · habit logs ${created.habits}`,
    `  leads ${created.leads} · revenue entries ${created.revenue}`,
    "",
    "  This data is synthetic. Run `npm run reset` to clear it.",
  ].join("\n");
}

const TASKS = [
  "Write the second-touch outreach email",
  "Complete billing integration",
  "Record the 3-minute demo video",
  "Rewrite the landing-page hero section",
  "Call the five leads that went quiet",
  "Build the onboarding checklist",
  "Fix the quote PDF layout",
  "Send proposal to the roofing lead",
  "Draft the pricing page copy",
  "Set up the CRM follow-up sequence",
  "Review last week's conversion numbers",
  "Ship the customer dashboard filter",
];
const PROMISES = [
  "Train at 18:00",
  "No phone before the must-win is done",
  "In bed by 22:30",
  "Hit protein target",
  "Twenty outreach messages before lunch",
  "No spending outside the plan today",
];
const LEARNING = [
  "Objection handling — price",
  "Cold email structure teardown",
  "Reading: offer construction",
  "Discovery call framework",
  "Practice: writing the guarantee",
  "Cash-flow forecasting basics",
];

function pickTask() {
  return TASKS[Math.floor(rand() * TASKS.length)];
}
function pickPromise() {
  return PROMISES[Math.floor(rand() * PROMISES.length)];
}
function pickLearning() {
  return LEARNING[Math.floor(rand() * LEARNING.length)];
}
