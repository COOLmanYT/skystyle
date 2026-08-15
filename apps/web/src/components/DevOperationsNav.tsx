import Link from "next/link";

type Section = "overview" | "api" | "users" | "feedback";

const items: Array<{ id: Section; href: string; label: string }> = [
  { id: "overview", href: "/dev/operations", label: "Overview" },
  { id: "api", href: "/dev/operations/api-activity", label: "API Activity" },
  { id: "users", href: "/dev/operations/users", label: "Users" },
  { id: "feedback", href: "/dev/operations/feedback", label: "Feedback" },
];

export default function DevOperationsNav({ current }: { current: Section }) {
  return (
    <nav aria-label="Operations sections" className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="rounded-lg px-3 py-2 text-xs font-medium"
          style={{
            background: item.id === current ? "var(--accent)" : "var(--card)",
            color: item.id === current ? "white" : "var(--foreground)",
            border: "1px solid var(--card-border)",
          }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
