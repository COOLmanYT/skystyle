import Link from "next/link";
import DevApiActivity from "@/components/DevApiActivity";

export default function DevApiActivityPage() {
  return <main className="space-y-6" style={{ background: "var(--background)" }}><div className="mx-auto max-w-6xl space-y-6"><Link href="/dev" className="text-sm" style={{ color: "var(--accent)" }}>← Dev Center</Link><DevApiActivity /></div></main>;
}
