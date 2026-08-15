import Link from "next/link";
import DevOperationsNav from "@/components/DevOperationsNav";
import FeedbackTickets from "@/components/FeedbackTickets";

export default function DevFeedbackPage() {
  return <main className="min-h-screen p-4 md:p-8" style={{ background: "var(--background)" }}><div className="mx-auto max-w-4xl space-y-6"><Link href="/dev" className="text-sm" style={{ color: "var(--accent)" }}>← Dev Center</Link><DevOperationsNav current="feedback" /><FeedbackTickets devMode /></div></main>;
}
