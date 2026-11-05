import "server-only";
import type { Repositories } from "./types";
import { devRepositories } from "./dev-store";

/**
 * Repository factory. DATA_DRIVER selects the persistence implementation.
 * Only "dev" exists today; "supabase" is the planned production driver
 * (docs/PRODUCTION.md). Production builds refuse to run real commerce on the
 * dev driver — see `isDurable()` and the guards in src/server/guards.ts.
 */
export function repos(): Repositories {
  const driver = process.env.DATA_DRIVER ?? "dev";
  if (driver === "dev") return devRepositories;
  throw new Error(`DATA_DRIVER "${driver}" is not implemented yet. See docs/PRODUCTION.md.`);
}

/** True only when a durable, production-grade store is connected. */
export function isDurable(): boolean {
  return repos().driver !== "dev";
}

export type { Repositories, Actor } from "./types";
