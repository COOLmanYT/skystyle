import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDevEmails } from "@/lib/dev-auth";
import DevNavBar from "@/components/DevNavBar";
import DevWorkspaceNav from "@/components/DevWorkspaceNav";

export default async function DevLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!getDevEmails().has(session.user.email.toLowerCase())) redirect("/dashboard?access=denied");
  return <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
    <DevNavBar email={session.user.email} />
    <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:py-8">
      <DevWorkspaceNav /><div className="min-w-0">{children}</div>
    </div>
  </div>;
}
