import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Apple from "next-auth/providers/apple";
import { getOptionalOAuthReadiness } from "@/lib/oauth-readiness";
import Credentials from "next-auth/providers/credentials";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import type { Adapter } from "next-auth/adapters";
import { DEMO_USER_ID } from "@/lib/demo";
import { getDevEmails } from "@/lib/dev-auth";
export { DEMO_USER_ID } from "@/lib/demo";

// On Vercel preview deployments, AUTH_URL is typically set to the production
// domain. Override it with the deployment-specific VERCEL_URL so that NextAuth
// resolves post-sign-in redirects against the preview domain instead of
// bouncing users to the production dashboard.
if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
  process.env.AUTH_URL = `https://${process.env.VERCEL_URL}`;
}

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Wrap every method of an adapter in a try-catch so that a Supabase outage or
 * missing `next_auth` schema does not throw an AdapterError and crash the
 * auth flow.  With `session.strategy: "jwt"` NextAuth can still function
 * without the adapter — users just won't be persisted to the database until
 * the adapter is healthy again.
 */
function safeAdapter(adapter: Adapter): Adapter {
  const safe: Adapter = {};
  for (const [key, value] of Object.entries(adapter)) {
    if (typeof value !== "function") {
      (safe as Record<string, unknown>)[key] = value;
      continue;
    }
    const fn = value as (...args: unknown[]) => Promise<unknown>;
    (safe as Record<string, unknown>)[key] = async (
      ...args: unknown[]
    ): Promise<unknown> => {
      try {
        return await fn(...args);
      } catch (err) {
        console.warn(`[auth][adapter] "${key}" failed, skipping:`, err);
        return null;
      }
    };
  }
  return safe;
}

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const rawAdapter =
  isValidHttpUrl(supabaseUrl) && supabaseServiceKey
    ? SupabaseAdapter({ url: supabaseUrl, secret: supabaseServiceKey })
    : undefined;

const optionalOAuth = getOptionalOAuthReadiness();

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [
    GitHub,
    Google,
    ...(optionalOAuth.microsoft ? [MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER || "https://login.microsoftonline.com/common/v2.0/",
    })] : []),
    ...(optionalOAuth.apple ? [Apple({ clientId: process.env.AUTH_APPLE_ID, clientSecret: process.env.AUTH_APPLE_SECRET })] : []),
    /**
     * Demo credentials provider — active in preview environments only.
     * The authorize() function acts as an additional server-side hard-stop:
     * it refuses the request unless VERCEL_ENV is "preview" or
     * NEXT_PUBLIC_IS_PREVIEW is "true".
     */
    Credentials({
      id: "demo",
      name: "Demo Access",
      credentials: {},
      authorize() {
        // Hard stop: only allow demo sessions in preview/development environments
        if (
          process.env.VERCEL_ENV !== "preview" &&
          process.env.NEXT_PUBLIC_IS_PREVIEW !== "true" &&
          process.env.NODE_ENV !== "development"
        ) {
          return null;
        }
        return {
          id: DEMO_USER_ID,
          name: "✨ Tester (Demo Mode)",
          email: "demo@skystyle.test",
          image: null,
        };
      },
    }),
  ],
  adapter: rawAdapter ? safeAdapter(rawAdapter) : undefined,
  session: { strategy: "jwt" },
  // Apple's cross-site form_post callback needs the short-lived verification cookies.
  // Session cookies keep Auth.js defaults; no insecure email-based account linking.
  ...(optionalOAuth.apple ? { cookies: {
    state: { name: "__Secure-authjs.state", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 900 } },
    nonce: { name: "__Secure-authjs.nonce", options: { httpOnly: true, sameSite: "none" as const, path: "/", secure: true, maxAge: 900 } },
  } } : {}),
  callbacks: {
    async jwt({ token, user }) {
      // Attach demo plan flag to the token when a demo user first signs in
      if (user?.id === DEMO_USER_ID) {
        token.plan = "demo";
      }
      return token;
    },
    async session({ session, user, token }) {
      if (session.user) {
        session.user.id = user?.id ?? token?.sub ?? "";
        // Navigation hint only. All /dev routes still enforce access server-side.
        (session.user as unknown as Record<string, unknown>).canAccessDev = getDevEmails().has(session.user.email?.toLowerCase() ?? "");
        // Propagate demo plan into the session so API routes can read it
        if (token?.plan === "demo") {
          (session.user as unknown as Record<string, unknown>).plan = "demo";
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
