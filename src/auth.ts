import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { SupabaseAdapter } from "@auth/supabase-adapter";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub, Google],
  adapter:
    supabaseUrl && supabaseServiceKey
      ? SupabaseAdapter({ url: supabaseUrl, secret: supabaseServiceKey })
      : undefined,
  callbacks: {
    async session({ session, user, token }) {
      if (session.user) {
        session.user.id = user?.id ?? token?.sub ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
