import { revalidatePath } from "next/cache";

/**
 * Cache revalidation is a side effect of a successful write, never a
 * precondition for one. Outside a request context — scripts, tests, a seeded
 * database — there is nothing to revalidate, and that must not fail the write.
 */
export function refreshPaths(paths: readonly string[]): void {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      /* no request context */
    }
  }
}
