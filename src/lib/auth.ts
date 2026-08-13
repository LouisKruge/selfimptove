/**
 * A single-operator lock for COMMAND.
 *
 * COMMAND holds a complete picture of one person's body, money, business and
 * private reflection. On a machine only they can reach, that needs no gate. The
 * moment it is reachable over the internet it needs one, so this module exists
 * to stand between a public URL and the data.
 *
 * It is deliberately the smallest thing that is actually secure: one shared
 * password held in `COMMAND_PASSWORD`, exchanged for an HMAC-signed cookie that
 * carries nothing but its own expiry. There are no user accounts, because there
 * is one user. There is no password in the cookie, and nothing in the cookie can
 * be edited without the secret.
 *
 * Web Crypto only — no `node:crypto` — because this runs in Next's middleware
 * (edge runtime) and in server actions (node runtime) from the same file.
 */

export const SESSION_COOKIE = "command_session";

/** Thirty days. Long, because re-entering a password on a phone in a gym is friction. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

/**
 * The configured password, or null when none is set.
 *
 * A blank or whitespace-only value counts as unset — an empty string in a
 * hosting dashboard is a mistake, not a password.
 */
export function configuredPassword(): string | null {
  const value = process.env.COMMAND_PASSWORD;
  if (!value || value.trim().length === 0) return null;
  return value;
}

/**
 * Is COMMAND locked at all?
 *
 * With no password set the app runs open, which is the right default on
 * localhost and the wrong one anywhere else — `lockRequired()` below is what
 * stops an unset password becoming a silently public deployment.
 */
export function authEnabled(): boolean {
  return configuredPassword() !== null;
}

/**
 * True when the app is deployed but no password was configured.
 *
 * This is the fail-closed case: rather than serve the data to anyone who finds
 * the URL, every route refuses and explains what to set.
 */
export function lockRequired(): boolean {
  return process.env.NODE_ENV === "production" && !authEnabled();
}

/* ------------------------------------------------------------------ crypto */

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/**
 * Compares two strings without leaking their contents through timing.
 *
 * Length is allowed to leak — it tells an attacker nothing useful about a
 * fixed-width signature — but the comparison itself always visits every
 * character rather than returning at the first mismatch.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ tokens */

/** Mints a signed cookie value that expires `SESSION_MAX_AGE` from now. */
export async function createSessionToken(): Promise<string> {
  const secret = configuredPassword();
  if (!secret) throw new Error("Cannot create a session without COMMAND_PASSWORD set.");
  const expiresAt = String(Date.now() + SESSION_MAX_AGE * 1000);
  return `${expiresAt}.${await sign(expiresAt, secret)}`;
}

/**
 * Verifies a cookie value.
 *
 * Signed with the password itself, so changing `COMMAND_PASSWORD` invalidates
 * every outstanding session — which is exactly what changing a password should
 * do.
 */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const secret = configuredPassword();
  if (!secret || !token) return false;

  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const expiresAt = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return false;

  return constantTimeEqual(signature, await sign(expiresAt, secret));
}

/** Checks a submitted password against the configured one. */
export async function passwordMatches(submitted: string): Promise<boolean> {
  const secret = configuredPassword();
  if (!secret) return false;
  // Hash both sides first so the comparison is over fixed-width digests and
  // cannot leak the real password's length.
  const [a, b] = await Promise.all([sign(submitted, "compare"), sign(secret, "compare")]);
  return constantTimeEqual(a, b);
}
