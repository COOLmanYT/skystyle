/**
 * Reusable middleware for the SkyStyle public API (v1).
 *
 * Wraps route handlers with:
 *   1. API key extraction and verification
 *   2. Per-key per-minute rate limiting (configurable via API_RATE_LIMIT_PER_MINUTE)
 *   3. Fire-and-forget request logging to api_usage_logs
 *
 * Usage:
 *   export const POST = withApiAuth(async (req, ctx) => {
 *     // ctx.apiKeyId, ctx.userId, ctx.startedAt available here
 *   });
 */

import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyApiKey, API_KEY_PREFIX, API_KEY_PREVIEW_LENGTH } from "@/lib/api-keys";

/** Default rate limit when API_RATE_LIMIT_PER_MINUTE is not set. */
const DEFAULT_RATE_LIMIT = 60;

export interface ApiKeyContext {
  /** Primary key of the matching row in api_keys. */
  apiKeyId: string;
  /** The user who owns the API key. */
  userId: string;
  /** Unix ms timestamp captured at the very start of the request. */
  startedAt: number;
}

/** Extract the raw Bearer token from Authorization / Authorisation headers. */
export function extractBearerToken(req: NextRequest): string | null {
  const header =
    req.headers.get("authorization") ?? req.headers.get("authorisation") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * Look up an API key in Supabase.
 * Returns the key's `id` and `user_id` if the key is valid and not revoked;
 * returns null otherwise.
 */
async function resolveApiKey(
  apiKey: string
): Promise<{ id: string; userId: string } | null> {
  if (!apiKey.startsWith(API_KEY_PREFIX)) return null;

  const preview = apiKey.slice(0, API_KEY_PREVIEW_LENGTH);

  const { data: candidates } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, key_hash")
    .eq("key_preview", preview)
    .eq("revoked", false);

  if (!candidates?.length) return null;

  for (const row of candidates) {
    if (verifyApiKey(apiKey, row.key_hash as string)) {
      return { id: row.id as string, userId: row.user_id as string };
    }
  }
  return null;
}

/**
 * Check whether the API key has stayed within its per-minute rate limit.
 * Counts rows in api_usage_logs with timestamp > (now - 60s).
 */
async function checkRateLimit(apiKeyId: string): Promise<boolean> {
  const limit = parseInt(
    process.env.API_RATE_LIMIT_PER_MINUTE ?? String(DEFAULT_RATE_LIMIT),
    10
  );
  const windowStart = new Date(Date.now() - 60 * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from("api_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gt("timestamp", windowStart);

  return (count ?? 0) < limit;
}

/**
 * Queue a usage-log insert to run after the response is sent.
 * Uses Next.js `after()` so the insert is non-blocking and does not add
 * latency to the API response.
 */
function logApiUsage(
  apiKeyId: string,
  endpoint: string,
  statusCode: number,
  startedAt: number
): void {
  const responseTime = Date.now() - startedAt;
  after(async () => {
    try {
      await supabaseAdmin.from("api_usage_logs").insert({
        api_key_id: apiKeyId,
        endpoint,
        timestamp: new Date().toISOString(),
        response_time: responseTime,
        status_code: statusCode,
      });
    } catch (err) {
      console.warn("[api-middleware] Failed to write usage log:", err);
    }
  });
}

type ApiHandler = (
  req: NextRequest,
  ctx: ApiKeyContext
) => Promise<NextResponse>;

/**
 * Higher-order function that wraps a v1 API route handler with:
 *   - API key verification (401 on missing/invalid key)
 *   - Per-minute rate limiting (429 when exceeded)
 *   - Fire-and-forget request logging via after()
 *
 * @example
 * export const POST = withApiAuth(async (req, ctx) => {
 *   const { userId } = ctx;
 *   return NextResponse.json({ ok: true });
 * });
 */
export function withApiAuth(handler: ApiHandler) {
  return async function (req: NextRequest): Promise<NextResponse> {
    const startedAt = Date.now();
    const endpoint = req.nextUrl.pathname;

    // 1. Extract bearer token — fail fast before any DB work
    const rawToken = extractBearerToken(req);
    if (!rawToken) {
      return NextResponse.json(
        {
          error: "unauthorized",
          message: "Missing or malformed Authorization header. Use: Authorization: Bearer <api_key>",
        },
        { status: 401 }
      );
    }

    // 2. Resolve key → (id, user_id)
    const keyRecord = await resolveApiKey(rawToken);
    if (!keyRecord) {
      return NextResponse.json(
        { error: "unauthorized", message: "Invalid or revoked API key." },
        { status: 401 }
      );
    }

    // 3. Rate limit — checked before any heavy processing
    const withinLimit = await checkRateLimit(keyRecord.id);
    if (!withinLimit) {
      logApiUsage(keyRecord.id, endpoint, 429, startedAt);
      return NextResponse.json(
        { error: "rate_limited", message: "Too many requests. Please slow down." },
        { status: 429 }
      );
    }

    // 4. Delegate to the actual handler
    const ctx: ApiKeyContext = {
      apiKeyId: keyRecord.id,
      userId: keyRecord.userId,
      startedAt,
    };

    let response: NextResponse;
    try {
      response = await handler(req, ctx);
    } catch (err) {
      console.error("[api-middleware] Unhandled handler error:", err);
      logApiUsage(keyRecord.id, endpoint, 500, startedAt);
      return NextResponse.json(
        { error: "internal_error", message: "An unexpected error occurred." },
        { status: 500 }
      );
    }

    // 5. Log after response — non-blocking
    logApiUsage(keyRecord.id, endpoint, response.status, startedAt);
    return response;
  };
}
