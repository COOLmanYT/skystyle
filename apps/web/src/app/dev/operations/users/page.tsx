import Link from "next/link";
import DevUsers from "@/components/DevUsers";

export default function DevUsersPage() {
  return <main className="space-y-6" style={{ background: "var(--background)" }}><div className="mx-auto max-w-6xl space-y-6"><Link href="/dev" className="text-sm" style={{ color: "var(--accent)" }}>← Dev Center</Link><DevUsers /></div></main>;
}
