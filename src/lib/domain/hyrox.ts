import { HYROX_STATIONS, type HyroxStationName } from "@/lib/types";
import { mean, round, stdev } from "./stats";

/**
 * HYROX ENGINE
 *
 * A HYROX race is 8 × 1km runs alternating with 8 stations. This module
 * analyses recorded sessions and simulations against the athlete's own history —
 * there are no imported benchmark tables, so every comparison is to themself.
 */

export const RACE_STATIONS: HyroxStationName[] = [
  "SKIERG",
  "SLED_PUSH",
  "SLED_PULL",
  "BURPEE_BROAD_JUMP",
  "ROW",
  "FARMERS_CARRY",
  "SANDBAG_LUNGES",
  "WALL_BALLS",
];

export const STATION_LABEL: Record<HyroxStationName, string> = {
  RUN: "1km Run",
  SKIERG: "SkiErg",
  SLED_PUSH: "Sled Push",
  SLED_PULL: "Sled Pull",
  BURPEE_BROAD_JUMP: "Burpee Broad Jumps",
  ROW: "Row",
  FARMERS_CARRY: "Farmers Carry",
  SANDBAG_LUNGES: "Sandbag Lunges",
  WALL_BALLS: "Wall Balls",
};

/** What each station is measured in — drives which inputs the logger shows. */
export const STATION_METRICS: Record<
  HyroxStationName,
  Array<"duration" | "distance" | "weight" | "reps" | "pace">
> = {
  RUN: ["distance", "duration", "pace"],
  SKIERG: ["distance", "duration", "pace"],
  SLED_PUSH: ["weight", "distance", "duration"],
  SLED_PULL: ["weight", "distance", "duration"],
  BURPEE_BROAD_JUMP: ["reps", "distance", "duration"],
  ROW: ["distance", "duration", "pace"],
  FARMERS_CARRY: ["weight", "distance", "duration"],
  SANDBAG_LUNGES: ["weight", "distance", "duration"],
  WALL_BALLS: ["weight", "reps", "duration"],
};

/** Standard race prescriptions, used as logging defaults only. */
export const STATION_DEFAULTS: Record<
  HyroxStationName,
  { distance_m?: number; reps?: number; weight_kg?: number }
> = {
  RUN: { distance_m: 1000 },
  SKIERG: { distance_m: 1000 },
  SLED_PUSH: { distance_m: 50, weight_kg: 152 },
  SLED_PULL: { distance_m: 50, weight_kg: 103 },
  BURPEE_BROAD_JUMP: { distance_m: 80 },
  ROW: { distance_m: 1000 },
  FARMERS_CARRY: { distance_m: 200, weight_kg: 24 },
  SANDBAG_LUNGES: { distance_m: 100, weight_kg: 20 },
  WALL_BALLS: { reps: 100, weight_kg: 6 },
};

export interface StationRecord {
  station: HyroxStationName;
  duration_sec: number | null;
  date: string;
}

export interface StationProfile {
  station: HyroxStationName;
  best: number | null;
  latest: number | null;
  average: number | null;
  samples: number;
  /** Seconds the latest attempt sits above the athlete's own best. */
  gapToBest: number | null;
}

export function stationProfiles(records: readonly StationRecord[]): StationProfile[] {
  return HYROX_STATIONS.map((station) => {
    const rows = records
      .filter((r) => r.station === station && r.duration_sec !== null && r.duration_sec > 0)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const times = rows.map((r) => r.duration_sec as number);
    const best = times.length ? Math.min(...times) : null;
    const latest = times.length ? times[0] : null;
    return {
      station,
      best,
      latest,
      average: times.length ? round(mean(times) ?? 0, 0) : null,
      samples: times.length,
      gapToBest: best !== null && latest !== null ? latest - best : null,
    };
  });
}

export interface RaceProjection {
  predictedSec: number | null;
  runSec: number | null;
  stationSec: number | null;
  missing: HyroxStationName[];
  note: string;
}

/**
 * Projects a race time from personal bests: 8 × best 1km split + best time at
 * each of the 8 stations. Returns null when any component has never been
 * recorded — a projection built on guessed splits is worse than none.
 */
export function projectRaceTime(profiles: readonly StationProfile[]): RaceProjection {
  const byStation = new Map(profiles.map((p) => [p.station, p]));
  const missing: HyroxStationName[] = [];

  const runBest = byStation.get("RUN")?.best ?? null;
  if (runBest === null) missing.push("RUN");

  let stationSec = 0;
  for (const s of RACE_STATIONS) {
    const best = byStation.get(s)?.best ?? null;
    if (best === null) missing.push(s);
    else stationSec += best;
  }

  if (missing.length > 0) {
    return {
      predictedSec: null,
      runSec: null,
      stationSec: null,
      missing,
      note: `No projection yet — ${missing.length} of 9 components have never been recorded.`,
    };
  }

  const runSec = (runBest as number) * 8;
  return {
    predictedSec: runSec + stationSec,
    runSec,
    stationSec,
    missing: [],
    note: "Built from your best recorded time at each component. Transitions are not included.",
  };
}

export interface SimulationAnalysis {
  totalSec: number | null;
  runSec: number | null;
  stationSec: number | null;
  transitionSec: number | null;
  fastest: { station: HyroxStationName; sec: number } | null;
  slowest: { station: HyroxStationName; sec: number } | null;
  /** Station furthest above the athlete's own best — the biggest time to reclaim. */
  opportunity: { station: HyroxStationName; sec: number; gapSec: number } | null;
  runSplitConsistency: number | null;
}

export function analyseSimulation(
  stations: ReadonlyArray<{ station: HyroxStationName; duration_sec: number | null; transition_sec: number | null }>,
  profiles: readonly StationProfile[],
): SimulationAnalysis {
  const timed = stations.filter(
    (s): s is { station: HyroxStationName; duration_sec: number; transition_sec: number | null } =>
      s.duration_sec !== null && s.duration_sec > 0,
  );

  if (timed.length === 0) {
    return {
      totalSec: null,
      runSec: null,
      stationSec: null,
      transitionSec: null,
      fastest: null,
      slowest: null,
      opportunity: null,
      runSplitConsistency: null,
    };
  }

  const runs = timed.filter((s) => s.station === "RUN");
  const work = timed.filter((s) => s.station !== "RUN");
  const transitionSec = stations.reduce((t, s) => t + (s.transition_sec ?? 0), 0);

  const runSec = runs.reduce((t, s) => t + s.duration_sec, 0);
  const stationSec = work.reduce((t, s) => t + s.duration_sec, 0);

  const sortedWork = [...work].sort((a, b) => a.duration_sec - b.duration_sec);
  const bestByStation = new Map(profiles.map((p) => [p.station, p.best]));

  let opportunity: SimulationAnalysis["opportunity"] = null;
  for (const s of work) {
    const best = bestByStation.get(s.station);
    if (best === null || best === undefined) continue;
    const gap = s.duration_sec - best;
    if (gap > 0 && (opportunity === null || gap > opportunity.gapSec)) {
      opportunity = { station: s.station, sec: s.duration_sec, gapSec: gap };
    }
  }

  const runTimes = runs.map((r) => r.duration_sec);
  const sd = runTimes.length >= 3 ? stdev(runTimes) : null;
  const runMean = mean(runTimes);
  const consistency =
    sd !== null && runMean !== null && runMean > 0 ? round(100 - (sd / runMean) * 100, 1) : null;

  return {
    totalSec: runSec + stationSec + transitionSec,
    runSec,
    stationSec,
    transitionSec: transitionSec || null,
    fastest: sortedWork.length
      ? { station: sortedWork[0].station, sec: sortedWork[0].duration_sec }
      : null,
    slowest: sortedWork.length
      ? {
          station: sortedWork[sortedWork.length - 1].station,
          sec: sortedWork[sortedWork.length - 1].duration_sec,
        }
      : null,
    opportunity,
    runSplitConsistency: consistency,
  };
}

/** The standard 1km-run / station alternation used to build a full simulation. */
export function buildRaceSequence(): Array<{ station: HyroxStationName; sequence: number }> {
  const out: Array<{ station: HyroxStationName; sequence: number }> = [];
  let seq = 1;
  for (const station of RACE_STATIONS) {
    out.push({ station: "RUN", sequence: seq++ });
    out.push({ station, sequence: seq++ });
  }
  return out;
}
