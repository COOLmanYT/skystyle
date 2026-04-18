/**
 * Reusable middleware for the SkyStyle public API (v1).
 *
 * Wraps route handlers with:
 *   1. API key extraction and verification
 *   2. Per-key per-minute rate limiting (configurable via API_RATE_LIMIT_PER_MINUTE)
 *   3. Fire-and-forget request logging to api_usage_logs
 *   4. Standard CORS, security, and rate-limit response headers on every response
 *
 * Usage:
 *   export const POST = withApiAuth(async (req, ctx) => {
 *     // ctx.apiKeyId, ctx.userId, ctx.startedAt available here
 *   });
 *   export const OPTIONS = apiOptionsHandler;
 */

import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyApiKey, API_KEY_PREFIX, API_KEY_PREVIEW_LENGTH } from "@/lib/api-keys";
import { getEndpointCreditCost, getHalfCreditCharge } from "@/lib/api-key-credits";

/** Default rate limit when API_RATE_LIMIT_PER_MINUTE is not set. */
const DEFAULT_RATE_LIMIT = 60;
const MAX_CREDIT_DEDUCTION_RETRIES = 3;

export interface ApiKeyContext {
  /** Primary key of the matching row in api_keys. */
  apiKeyId: string;
  /** The user who owns the API key. */
  userId: string;
  /** Unix ms timestamp captured at the very start of the request. */
  startedAt: number;
}

/**
 * Apply standard headers to every v1 API response:
 *   - CORS: allows any origin (public API for external developers)
 *   - X-Content-Type-Options: nosniff
 *   - Cache-Control: no-store (API responses must not be cached)
 */
function applyStandardHeaders(response: NextResponse): void {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set(
    "Access-Control-Expose-Headers",
    "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After"
  );
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-store");
}

/**
 * Handles CORS preflight (OPTIONS) requests for all v1 endpoints.
 * Export from each v1 route file:
 *   export const OPTIONS = apiOptionsHandler;
 */
export function apiOptionsHandler(): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  applyStandardHeaders(response);
  return response;
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
): Promise<{ id: string; userId: string; creditsRemaining: number } | null> {
  if (!apiKey.startsWith(API_KEY_PREFIX)) return null;

  const preview = apiKey.slice(0, API_KEY_PREVIEW_LENGTH);

  const { data: candidates } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id, key_hash, credits_remaining")
    .eq("key_preview", preview)
    .eq("revoked", false);

  if (!candidates?.length) return null;

  for (const row of candidates) {
    if (await verifyApiKey(apiKey, row.key_hash as string)) {
      // The preview window (API_KEY_PREVIEW_LENGTH chars) makes collisions
      // vanishingly rare. verifyApiKey uses timingSafeEqual internally, so
      // timing cannot reveal whether a candidate matched.
      return {
        id: row.id as string,
        userId: row.user_id as string,
        creditsRemaining: Math.max(0, Number(row.credits_remaining ?? 0)),
      };
    }
  }
  return null;
}

/**
 * Deduct credits from a key with optimistic concurrency checks to avoid
 * accidental double-deduction under concurrent requests.
 */
async function deductApiKeyCredits(apiKeyId: string, amount: number): Promise<boolean> {
  if (!Number.isFinite(amount) || amount <= 0) return true;
  const debit = Math.max(1, Math.floor(amount));

  for (let attempt = 0; attempt < MAX_CREDIT_DEDUCTION_RETRIES; attempt += 1) {
    const { data: current } = await supabaseAdmin
      .from("api_keys")
      .select("credits_remaining, credits_used")
      .eq("id", apiKeyId)
      .single();

    const remaining = Math.max(0, Number(current?.credits_remaining ?? 0));
    const used = Math.max(0, Number(current?.credits_used ?? 0));
    if (remaining < debit) return false;

    const { data: updated } = await supabaseAdmin
      .from("api_keys")
      .update({
        credits_remaining: remaining - debit,
        credits_used: used + debit,
      })
      .eq("id", apiKeyId)
      .eq("credits_remaining", remaining)
      .eq("credits_used", used)
      .select("id")
      .single();

    if (updated?.id) return true;
  }

  return false;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/**
 * Check whether the API key has stayed within its per-minute rate limit.
 * Returns the limit, current usage, and whether the request is allowed.
 */
async function checkRateLimit(apiKeyId: string): Promise<RateLimitResult> {
  const parsed = parseInt(
    process.env.API_RATE_LIMIT_PER_MINUTE ?? String(DEFAULT_RATE_LIMIT),
    10
  );
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RATE_LIMIT;
  const windowStart = new Date(Date.now() - 60 * 1000).toISOString();

  const { count } = await supabaseAdmin
    .from("api_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gt("timestamp", windowStart);

  const used = count ?? 0;
  const remaining = Math.max(0, limit - used);
  return { allowed: used < limit, remaining, limit };
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
 *   - Standard CORS, security, and rate-limit response headers
 *
 * @example
 * export const POST = withApiAuth(async (req, ctx) => {
 *   const { userId } = ctx;
 *   return NextResponse.json({ ok: true });
 * });
 * export const OPTIONS = apiOptionsHandler;
 */
export function withApiAuth(handler: ApiHandler) {
  return async function (req: NextRequest): Promise<NextResponse> {
    const startedAt = Date.now();
    const endpoint = req.nextUrl.pathname;
    const endpointCost = getEndpointCreditCost(endpoint);

    // 1. Extract bearer token — fail fast before any DB work
    const rawToken = extractBearerToken(req);
    if (!rawToken) {
      const res = NextResponse.json(
        {
          error: "unauthorized",
          message: "Missing or malformed Authorization header. Use: Authorization: Bearer <api_key>",
        },
        { status: 401 }
      );
      applyStandardHeaders(res);
      return res;
    }

    // 2. Resolve key → (id, user_id)
    const keyRecord = await resolveApiKey(rawToken);
    if (!keyRecord) {
      const res = NextResponse.json(
        { error: "unauthorized", message: "Invalid or revoked API key." },
        { status: 401 }
      );
      applyStandardHeaders(res);
      return res;
    }

    // 2b. Credit check before processing request
    if (endpointCost > 0 && keyRecord.creditsRemaining < endpointCost) {
      const res = NextResponse.json({ error: "insufficient_credits" }, { status: 403 });
      applyStandardHeaders(res);
      return res;
    }

    // 3. Rate limit — checked before any heavy processing
    const rateLimit = await checkRateLimit(keyRecord.id);
    if (!rateLimit.allowed) {
      logApiUsage(keyRecord.id, endpoint, 429, startedAt);
      const res = NextResponse.json(
        { error: "rate_limited", message: "Too many requests. Please slow down." },
        { status: 429 }
      );
      applyStandardHeaders(res);
      res.headers.set("Retry-After", "60");
      res.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
      res.headers.set("X-RateLimit-Remaining", "0");
      return res;
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
      const res = NextResponse.json(
        { error: "internal_error", message: "An unexpected error occurred." },
        { status: 500 }
      );
      applyStandardHeaders(res);
      return res;
    }

    // 5. Apply standard headers + rate limit info to the handler response
    applyStandardHeaders(response);
    response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));

    // 6. Log after response — non-blocking
    if (endpointCost > 0) {
      const explicitCharge = Number.parseInt(
        response.headers.get("x-api-credit-charge") ?? "",
        10
      );
      const shouldHalfCharge = response.headers.get("x-api-partial-success") === "true";
      let charge = 0;
      if (Number.isFinite(explicitCharge) && explicitCharge >= 0) {
        charge = Math.min(endpointCost, explicitCharge);
      } else if (response.ok) {
        charge = endpointCost;
      } else if (shouldHalfCharge) {
        charge = getHalfCreditCharge(endpointCost);
      }
      if (charge > 0) {
        after(async () => {
          try {
            await deductApiKeyCredits(keyRecord.id, charge);
          } catch (err) {
            console.warn(`[api-middleware] Failed to deduct API key credits for key ${keyRecord.id}:`, err);
          }
        });
      }
    }

    logApiUsage(keyRecord.id, endpoint, response.status, startedAt);
    return response;
  };
}
