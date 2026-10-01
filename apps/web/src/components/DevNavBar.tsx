"use client";
import HamburgerNav from "./HamburgerNav";
import { handleSignOut } from "@/app/actions";
export default function DevNavBar({ email }: { email: string }) {
  return <HamburgerNav currentPage="other" title="Dev Center" userName={email} isDev signOutAction={handleSignOut}
    rightContent={<span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--card-border)" }}>Developer workspace</span>} />;
}
