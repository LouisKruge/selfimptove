import "server-only";

import { z } from "zod";
import { isValidDay, today } from "@/lib/core/date";

/** Result contract every server action returns. Errors are always readable. */
export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok(): ActionResult;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T> {
  return { ok: true, data } as ActionResult<T>;
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Turns a Zod failure into a single readable sentence plus per-field messages. */
export function fromZod(err: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = err.issues[0];
  const label = first?.path.length ? `${first.path.join(".")}: ` : "";
  return fail(`${label}${first?.message ?? "Invalid input."}`, fieldErrors);
}

export function parseWith<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
): { ok: true; value: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(data);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, result: fromZod(parsed.error) };
}

/* -------------------------------------------------------- FormData coercion */

export function formObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/* ------------------------------------------------------------ zod helpers */

/** Empty strings from HTML forms become undefined, not "" or 0. */
export const blankToUndefined = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined) return undefined;
    const trimmed = v.trim();
    return trimmed === "" ? undefined : trimmed;
  });

/**
 * Free text with no length limit.
 *
 * Everything the operator writes about their own life — an outcome, a set of
 * findings, a reflection, a decision's reasoning — is written once and read
 * many times, and there is no length at which it stops being worth keeping.
 * A cap here only ever loses work someone had already typed.
 *
 * Titles are the exception below: those appear in lists and headers, where an
 * unbounded value breaks the layout rather than the record.
 */
export const optionalText = blankToUndefined.pipe(z.string().optional());

/** Required free text, no length limit. For bodies, not for titles. */
export const requiredLongText = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, "Required"));

export const requiredText = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1, "Required").max(500));

export const optionalNumber = blankToUndefined.transform((v, ctx) => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a number" });
    return z.NEVER;
  }
  return n;
});

export const requiredNumber = z
  .union([z.string(), z.number()])
  .transform((v, ctx) => {
    const n = typeof v === "number" ? v : Number(v.trim());
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a number" });
      return z.NEVER;
    }
    return n;
  });

export const optionalInt = optionalNumber.transform((v) =>
  v === undefined ? undefined : Math.round(v),
);

/** Money entered in rand, stored in cents. */
export const randToCents = optionalNumber.transform((v) =>
  v === undefined ? undefined : Math.round(v * 100),
);

export const requiredRandToCents = requiredNumber.transform((v) => Math.round(v * 100));

export const dayString = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => isValidDay(v), "Must be a valid date");

export const optionalDay = blankToUndefined.transform((v, ctx) => {
  if (v === undefined) return undefined;
  if (!isValidDay(v)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a valid date" });
    return z.NEVER;
  }
  return v;
});

export const dayWithDefault = blankToUndefined.transform((v, ctx) => {
  if (v === undefined) return today();
  if (!isValidDay(v)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Must be a valid date" });
    return z.NEVER;
  }
  return v;
});

export const checkbox = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => v === "on" || v === "true" || v === "1");

export const id = z.string().min(1, "Missing identifier").max(64);

/** Converts "mm:ss" or "h:mm:ss" or a raw second count into seconds. */
export const timeToSeconds = blankToUndefined.transform((v, ctx) => {
  if (v === undefined) return undefined;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(Number(v));
  const parts = v.split(":").map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Use seconds, mm:ss or h:mm:ss" });
    return z.NEVER;
  }
  const nums = parts.map(Number);
  const seconds =
    nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1];
  return Math.round(seconds);
});

export { z };
