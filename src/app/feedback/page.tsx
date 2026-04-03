import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import type { Metadata } from "next";
import FeedbackForm from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback — Sky Style",
};

export default async function FeedbackPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--background)" }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-8 space-y-4 text-center"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <p className="text-3xl" aria-hidden="true">
            👋
          </p>
          <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
            I&apos;d love to hear from you!
          </h1>
          <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.6 }}>
            Please log in first so I know who&apos;s talking.
          </p>
          <Link
            href="/login"
            className="inline-block mt-2 rounded-xl px-5 py-2.5 text-sm font-semibold btn-plan-free"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  const userId = session.user.id;
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("is_pro, is_dev")
    .eq("id", userId)
    .single();

  const isPro = profile?.is_pro ?? false;
  const isDev = profile?.is_dev ?? false;

  const backLinkClass = isDev
    ? "text-[#ff9500]"
    : isPro
    ? "text-[#9b59b6]"
    : "text-[#3b7cf4]";

  return (
    <div
      className="min-h-screen flex flex-col p-4"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-md mx-auto space-y-6 py-8">
        {/* Back link */}
        <Link
          href="/dashboard"
          className={`text-xs inline-flex items-center gap-1 btn-interact rounded-xl px-3 py-1.5 ${backLinkClass} hover:opacity-80`}
          style={{ border: "1px solid var(--card-border)", background: "var(--card)" }}
        >
          ← Back to Dashboard
        </Link>

        {/* Main card */}
        <div
          className="rounded-2xl p-6 space-y-5"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <div>
            <h1
              className="text-base font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              Share Feedback
            </h1>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--foreground)", opacity: 0.5 }}
            >
              Your thoughts help us make Sky Style better for everyone.
            </p>
          </div>

          <FeedbackForm isPro={isPro} isDev={isDev} />
        </div>
      </div>
    </div>
  );
}
