import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

/** Visitors without the demo cookie start on /enter. Not real auth: see lib/session.ts. */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  return NextResponse.redirect(new URL("/enter", request.url));
}

export const config = {
  // Pages only. /enter, API routes, Next internals and static icons stay open.
  matcher: ["/((?!enter|api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
