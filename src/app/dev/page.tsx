import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageSpacingWrapper from "@/components/PageSpacingWrapper";
import DevNavBar from "@/components/DevNavBar";
import Link from "next/link";

function getDevEmails(): Set<string> {
  const raw = process.env.DEV_EMAILS ?? "";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export default async function DevLandingPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!getDevEmails().has(session.user.email.toLowerCase())) redirect("/dashboard?access=denied");

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <DevNavBar email={session.user.email} />

      <main id="main-content">
        <PageSpacingWrapper page="account" className="max-w-5xl mx-auto px-4 py-10 space-y-8">

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
              Sky Style Dev Center
            </h1>
            <p className="text-sm" style={{ color: "var(--foreground)", opacity: 0.5 }}>
              Restricted access. Every action is logged.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                href: "/dev/dashboard",
                emoji: "🎛️",
                title: "Admin Dashboard",
                desc: "Triage deletion requests, manage users, view health metrics",
                color: "#ff9500",
              },
              {
                href: "/dev/dashboard#chat",
                emoji: "💬",
                title: "User Chat",
                desc: "Read and reply to user messages",
                color: "var(--accent)",
              },
              {
                href: "/dev/dashboard#changelog",
                emoji: "📝",
                title: "Changelog CMS",
                desc: "Publish and manage changelog posts",
                color: "#30d158",
              },
              {
                href: "/dev/dashboard#health",
                emoji: "📊",
                title: "System Health",
                desc: "API usage, error rates, and diagnostics",
                color: "#bf5af2",
              },
            ].map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="rounded-2xl p-6 block btn-interact"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                  textDecoration: "none",
                }}
              >
                <span className="text-3xl">{card.emoji}</span>
                <h2
                  className="text-base font-semibold mt-3 mb-1"
                  style={{ color: "var(--foreground)" }}
                >
                  {card.title}
                </h2>
                <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.55 }}>
                  {card.desc}
                </p>
                <div
                  className="mt-4 h-0.5 rounded-full"
                  style={{ background: card.color, opacity: 0.6, width: "40%" }}
                />
              </Link>
            ))}
          </div>

          <div
            className="rounded-2xl p-5"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "var(--foreground)", opacity: 0.4 }}
            >
              Security Notice
            </p>
            <p className="text-xs" style={{ color: "var(--foreground)", opacity: 0.6 }}>
              All actions in the Dev Command Center are server-verified against{" "}
              <code
                className="px-1 py-0.5 rounded"
                style={{ background: "var(--background)", fontFamily: "monospace" }}
              >
                DEV_EMAILS
              </code>{" "}
              on every request. Access requires an active session with a verified dev email.
              Destructive actions require re-authentication.
            </p>
          </div>

        </PageSpacingWrapper>
      </main>
    </div>
  );
}
