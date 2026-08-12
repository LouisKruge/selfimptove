import { randomUUID } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

/** Stable slug for URLs and dedupe keys. */
export function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
