import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public paths that never require auth
const PUBLIC_PATHS = ["/", "/login", "/api/auth", "/preview", "/api/demo", "/terms", "/privacy", "/changelog"];

/** Returns the set of emails permitted to access /dev routes. */
function getDevEmails(): Set<string> {
  const raw = process.env.DEV_EMAILS ?? "";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through without touching the session
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  let session;
  try {
    session = await auth();
  } catch (err) {
    console.error("Proxy auth check failed:", err);
  }

  if (!session?.user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Protect /dev routes: only emails listed in DEV_EMAILS may access them.
  // OAuth users land here the same as anyone else — no email-verification gate.
  if (pathname.startsWith("/dev")) {
    const email = session.user.email?.toLowerCase() ?? "";
    if (!getDevEmails().has(email)) {
      const deniedUrl = req.nextUrl.clone();
      deniedUrl.pathname = "/dashboard";
      deniedUrl.searchParams.set("access", "denied");
      return NextResponse.redirect(deniedUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg).*)",
  ],
};

