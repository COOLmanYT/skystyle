import Link from "next/link";
import DevApiActivity from "@/components/DevApiActivity";
import DevOperationsNav from "@/components/DevOperationsNav";

export default function DevApiActivityPage() {
  return <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--background)" }}><div className="mx-auto max-w-6xl space-y-6"><Link href="/dev" className="text-sm" style={{ color: "var(--accent)" }}>← Dev Center</Link><DevOperationsNav current="api" /><DevApiActivity /></div></main>;
}
