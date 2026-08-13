import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, lockRequired, verifySessionToken } from "@/lib/auth";

/**
 * Stands in front of every route.
 *
 * Three outcomes:
 *   · deployed with no password  → nothing is served, and /login says why
 *   · no password configured     → open, which is correct on localhost
 *   · password configured        → a valid signed cookie, or back to /login
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const onLoginPage = pathname === "/login";

  // Fail closed: a production deployment without a password would otherwise be
  // a public copy of someone's private life.
  if (lockRequired()) {
    if (onLoginPage) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!authEnabled()) {
    // Running open. The login page has nothing to offer, so send it home.
    if (onLoginPage) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  const signedIn = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (signedIn) {
    if (onLoginPage) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (onLoginPage) return NextResponse.next();

  // Remember where they were headed so signing in lands there, not on a
  // generic home page.
  const login = new URL("/login", request.url);
  const intended = `${pathname}${search}`;
  if (intended !== "/") login.searchParams.set("next", intended);
  return NextResponse.redirect(login);
}

export const config = {
  /**
   * Everything except Next's own static output and the icon. Server actions
   * post back to the page they live on, so they are covered by the page's own
   * match — a signed-out visitor cannot reach a write.
   */
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
