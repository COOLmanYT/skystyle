import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DevDashboardClient from "./DevDashboardClient";

function getDevEmails(): Set<string> {
  const raw = process.env.DEV_EMAILS ?? "";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export default async function DevDashboardPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!getDevEmails().has(session.user.email.toLowerCase())) redirect("/dashboard?access=denied");

  return <DevDashboardClient />;
}
