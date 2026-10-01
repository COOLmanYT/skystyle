import Link from "next/link";
import FeedbackTickets from "@/components/FeedbackTickets";

export default function DevFeedbackPage() {
  return <main className="space-y-6" style={{ background: "var(--background)" }}><div className="mx-auto max-w-4xl space-y-6"><Link href="/dev" className="text-sm" style={{ color: "var(--accent)" }}>← Dev Center</Link><FeedbackTickets devMode /></div></main>;
}
