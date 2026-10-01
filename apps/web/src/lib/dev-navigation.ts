export const devNavigation = [
  { label: "Overview", href: "/dev", group: "Workspace", description: "Choose a task and find the right tool." },
  { label: "Deletion requests", href: "/dev/triage", group: "Support", description: "Review requests to close an account." },
  { label: "User messages", href: "/dev/chat", group: "Support", description: "Read and reply to account conversations." },
  { label: "Feedback tickets", href: "/dev/operations/feedback", group: "Support", description: "Handle bug reports and suggestions." },
  { label: "Changelog", href: "/dev/changelog", group: "Publishing", description: "Draft, preview and publish updates." },
  { label: "Service health", href: "/dev/health", group: "Monitoring", description: "Check connectivity and provider status." },
  { label: "API activity", href: "/dev/operations/api-activity", group: "Monitoring", description: "Investigate requests, failures and response times." },
  { label: "Users", href: "/dev/operations/users", group: "Accounts", description: "Find accounts and manage their access." },
  { label: "Bans & restrictions", href: "/dev/operations/bans", group: "Accounts", description: "Review restricted account access." },
  { label: "Operations overview", href: "/dev/operations", group: "Accounts", description: "Explore account and API tools." },
] as const;

export function activeDevDestination(pathname: string) {
  return [...devNavigation].sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || (item.href !== "/dev" && pathname.startsWith(`${item.href}/`))) ?? devNavigation[0];
}
