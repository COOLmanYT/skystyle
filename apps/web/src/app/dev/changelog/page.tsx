import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DevDashboardClient from "@/app/dev/dashboard/DevDashboardClient";
import { getDevEmails } from "@/lib/dev-auth";

export const metadata = { title: "Changelog — Dev Center" };

export default async function DevChangelogPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!getDevEmails().has(session.user.email.toLowerCase())) redirect("/dashboard?access=denied");

  return <DevDashboardClient initialSection="changelog" />;
}
