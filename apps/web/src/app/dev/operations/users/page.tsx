import Link from "next/link";
import DevOperationsNav from "@/components/DevOperationsNav";
import DevUsers from "@/components/DevUsers";

export default function DevUsersPage() {
  return <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--background)" }}><div className="mx-auto max-w-6xl space-y-6"><Link href="/dev" className="text-sm" style={{ color: "var(--accent)" }}>← Dev Center</Link><DevOperationsNav current="users" /><DevUsers /></div></main>;
}
