"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { parseDashboardSections, type DashboardSections } from "@/lib/dashboard-sections";
const eventName = "skystyle-dashboard-sections";
const temporary = new Map<string, DashboardSections>();
type NavigationSession = { id?: string; canAccessDev: boolean };
let sessionRequest: Promise<NavigationSession> | undefined;
const keyFor = (userId: string) => `skystyle_dashboard_sections_${userId}`;
function subscribe(notify: () => void) {
  window.addEventListener(eventName, notify);
  window.addEventListener("storage", notify);
  return () => { window.removeEventListener(eventName, notify); window.removeEventListener("storage", notify); };
}
export default function useDashboardSections(userId?: string) {
  const [sessionInfo, setSessionInfo] = useState<NavigationSession | undefined>(undefined);
  const accountId = userId || sessionInfo?.id;
  useEffect(() => {
    if (userId) return;
    let active = true;
    sessionRequest ??= fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((session) => ({ id: typeof session?.user?.id === "string" ? session.user.id : undefined, canAccessDev: session?.user?.canAccessDev === true }))
      .catch(() => ({ canAccessDev: false }))
      .finally(() => { sessionRequest = undefined; });
    void sessionRequest.then((info) => { if (active) setSessionInfo(info); });
    return () => { active = false; };
  }, [userId]);
  const mode = useSyncExternalStore(subscribe, () => {
    if (!accountId) return "both";
    const key = keyFor(accountId);
    if (temporary.has(key)) return temporary.get(key)!;
    try { return parseDashboardSections(localStorage.getItem(key)); } catch { return "both"; }
  }, () => "both" as DashboardSections);
  function setMode(next: DashboardSections): boolean {
    if (!accountId) return false;
    const key = keyFor(accountId);
    temporary.set(key, parseDashboardSections(next));
    let persisted = true;
    try { localStorage.setItem(key, next); temporary.delete(key); } catch { persisted = false; }
    window.dispatchEvent(new Event(eventName));
    return persisted;
  }
  return { mode, setMode, canAccessDev: sessionInfo?.canAccessDev === true };
}
