"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authEnabled,
  createSessionToken,
  passwordMatches,
} from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Only same-origin paths are accepted as a post-sign-in destination, so a
 * crafted `?next=` cannot bounce anyone to another site.
 */
function safeDestination(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function signIn(form: FormData): Promise<Result> {
  if (!authEnabled()) return { ok: false, error: "No password is configured." };

  const submitted = form.get("password");
  if (typeof submitted !== "string" || submitted.length === 0) {
    return { ok: false, error: "Enter the password." };
  }

  if (!(await passwordMatches(submitted))) {
    return { ok: false, error: "That password is not correct." };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  redirect(safeDestination(form.get("next")));
}

export async function signOut(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
