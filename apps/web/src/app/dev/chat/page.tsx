import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DevDashboardClient from "@/app/dev/dashboard/DevDashboardClient";
import { getDevEmails } from "@/lib/dev-auth";

export const metadata = { title: "Chat — Dev Center" };

export default async function DevChatPage({ searchParams }: { searchParams: Promise<{ userId?: string }> }) {
  const { userId } = await searchParams;
  const initialUserId = typeof userId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) ? userId : null;
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!getDevEmails().has(session.user.email.toLowerCase())) redirect("/dashboard?access=denied");

  return <DevDashboardClient key={initialUserId ?? "choose-user"} initialSection="chat" initialUserId={initialUserId} />;
}
