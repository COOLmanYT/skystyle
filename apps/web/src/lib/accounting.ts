/** Coordinated cutover bridge. Only an explicit false database flag permits
 * legacy behavior; missing/unreadable state never silently falls back. */
import { createHash } from "node:crypto";
import { DEMO_USER_ID } from "./demo";
import { EntitlementError, getEntitlementRollout, getV6AccountSnapshot, isEntitlementUuid } from "./entitlements";
export type AccountSnapshot = Awaited<ReturnType<typeof getV6AccountSnapshot>>;

export async function getActiveAccounting(userId: string, isDemo = false): Promise<AccountSnapshot | null> {
  if (isDemo || userId === DEMO_USER_ID) return null;
  if (!(await getEntitlementRollout()).enabled) return null;
  return getV6AccountSnapshot(userId);
}

export async function requireLegacyWriter(): Promise<void> {
  if ((await getEntitlementRollout()).enabled) throw new EntitlementError("legacy_writer_disabled", "Legacy credit and usage writes are disabled. Use the account reservation workflow.", 409);
}

export function accountingRequest(headers: Headers, useCredits: unknown = false) {
  if (typeof useCredits !== "boolean") throw new EntitlementError("invalid_request", "useCredits must be a boolean.", 400);
  const requestId = headers.get("idempotency-key") ?? undefined;
  if (requestId !== undefined && !isEntitlementUuid(requestId)) throw new EntitlementError("invalid_request", "Idempotency-Key must be a UUID.", 400);
  return { requestId, useCredits };
}

/** The same scheduled occurrence keeps its ID even if a worker restarts. */
export function scheduledUsageId(scheduleId: string, occurrence: string): string {
  if (!isEntitlementUuid(scheduleId) || !Number.isFinite(Date.parse(occurrence))) throw new EntitlementError("invalid_request", "Invalid scheduled occurrence.", 400);
  const hash = createHash("sha256").update(`skystyle_schedule\0${scheduleId.toLowerCase()}\0${new Date(occurrence).toISOString()}`).digest("hex");
  return `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
