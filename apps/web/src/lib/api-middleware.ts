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
import { deductCredit, deductStoredAppCredit, getCredits, getStoredAppCredits } from "@/lib/credits";

/** Default rate limit when API_RATE_LIMIT_PER_MINUTE is not set. */
const DEFAULT_RATE_LIMIT = 60;
const MAX_CREDIT_DEDUCTION_RETRIES = 3;
const MAX_ANALYTICS_VALUE_LENGTH = 8_000;
const MAX_ANALYTICS_COLLECTION_LENGTH = 50;
const SENSITIVE_ANALYTICS_FIELD = /(?:api[-_]?key|authorization|password|secret|token|credential)/i;

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
    "X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After, X-Credit-Warning"
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

type AnalyticsPayload = Record<string, unknown>;

function truncateAnalyticsString(value: string): string {
  return value.length > MAX_ANALYTICS_VALUE_LENGTH
    ? `${value.slice(0, MAX_ANALYTICS_VALUE_LENGTH)}…[truncated]`
    : value;
}

/** Preserve useful diagnostics without ever storing credentials in analytics. */
function sanitizeAnalyticsValue(value: unknown, key?: string, depth = 0): unknown {
  if (key && SENSITIVE_ANALYTICS_FIELD.test(key)) return "[redacted]";
  if (typeof value === "string") return truncateAnalyticsString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (depth >= 5) return "[max depth reached]";
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ANALYTICS_COLLECTION_LENGTH)
      .map((item) => sanitizeAnalyticsValue(item, undefined, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, MAX_ANALYTICS_COLLECTION_LENGTH)
        .map(([entryKey, entryValue]) => [entryKey, sanitizeAnalyticsValue(entryValue, entryKey, depth + 1)])
    );
  }
  return String(value);
}

async function captureRequestInput(req: NextRequest): Promise<AnalyticsPayload> {
  const query = Object.fromEntries(req.nextUrl.searchParams.entries());
  const input: AnalyticsPayload = { query: sanitizeAnalyticsValue(query) };
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return input;

  try {
    const text = await req.clone().text();
    input.body = text ? sanitizeAnalyticsValue(JSON.parse(text)) : null;
  } catch {
    input.body = "[unreadable JSON body]";
  }
  return input;
}

async function captureResponseDetails(response: NextResponse): Promise<AnalyticsPayload> {
  try {
    const text = await response.clone().text();
    if (!text) return {};
    const contentType = response.headers.get("content-type") ?? "";
    const output = contentType.includes("application/json")
      ? sanitizeAnalyticsValue(JSON.parse(text))
      : { text: truncateAnalyticsString(text) };
    const error = output && typeof output === "object" && !Array.isArray(output)
      ? (output as Record<string, unknown>).error
      : undefined;
    const message = output && typeof output === "object" && !Array.isArray(output)
      ? (output as Record<string, unknown>).message
      : undefined;
    return {
      output,
      ...(typeof error === "string" ? { errorCode: error } : {}),
      ...(typeof message === "string" ? { errorMessage: message } : {}),
    };
  } catch {
    return { output: "[response body unavailable]" };
  }
}

/**
 * Check whether the API key has stayed within its per-minute rate limit.
 * Returns the limit, current usage, and whether the request is allowed.
 */
async function checkRateLimit(apiKeyId: string, customLimit?: number | null): Promise<RateLimitResult> {
  const parsed = parseInt(
    process.env.API_RATE_LIMIT_PER_MINUTE ?? String(DEFAULT_RATE_LIMIT),
    10
  );
  const configuredLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RATE_LIMIT;
  const limit = typeof customLimit === "number" && customLimit >= 0 ? customLimit : configuredLimit;
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
  apiKeyId: string | undefined,
  endpoint: string,
  statusCode: number,
  startedAt: number,
  requestInput: AnalyticsPayload,
  requestMethod: string,
  response: NextResponse
): void {
  const responseTime = Date.now() - startedAt;
  // Clone immediately, while the response body is still available; consume it
  // later in after() so analytics never delay the API response.
  const responseDetails = captureResponseDetails(response);
  after(async () => {
    try {
      const details = await responseDetails;
      const { error } = await supabaseAdmin.from("api_usage_logs").insert({
        api_key_id: apiKeyId,
        endpoint,
        timestamp: new Date().toISOString(),
        response_time: responseTime,
        status_code: statusCode,
        request_method: requestMethod,
        request_input: requestInput,
        response_output: details.output ?? null,
        error_code: details.errorCode ?? null,
        error_message: details.errorMessage ?? null,
      });
      if (error) throw error;
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
    const requestInput = await captureRequestInput(req);
    const queueUsageLog = (apiKeyId: string | undefined, response: NextResponse) => {
      logApiUsage(apiKeyId, endpoint, response.status, startedAt, requestInput, req.method, response);
    };

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
      queueUsageLog(undefined, res);
      return res;
    }

    // 2. Resolve key → (id, user_id)
    let keyRecord: Awaited<ReturnType<typeof resolveApiKey>>;
    try {
      keyRecord = await resolveApiKey(rawToken);
    } catch (err) {
      console.error("[api-middleware] API key lookup failed:", err);
      const res = NextResponse.json(
        { error: "internal_error", message: "Unable to validate the API key." },
        { status: 500 }
      );
      applyStandardHeaders(res);
      queueUsageLog(undefined, res);
      return res;
    }
    if (!keyRecord) {
      const res = NextResponse.json(
        { error: "unauthorized", message: "Invalid or revoked API key." },
        { status: 401 }
      );
      applyStandardHeaders(res);
      queueUsageLog(undefined, res);
      return res;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("is_dev, is_pro")
      .eq("id", keyRecord.userId)
      .maybeSingle();
    if (profileError) {
      const res = NextResponse.json({ error: "internal_error", message: "Unable to load API account." }, { status: 500 });
      applyStandardHeaders(res); queueUsageLog(keyRecord.id, res); return res;
    }
    const isDev = profile?.is_dev === true;
    let useAppCreditFallback = false;
    // Dev API keys are unlimited. Other keys use their allocated API credits
    // first, then one regular App Credit when the key balance is exhausted.
    if (!isDev && endpointCost > 0 && keyRecord.creditsRemaining < endpointCost) {
      const appCredits = profile?.is_pro
        ? await getCredits(keyRecord.userId)
        : await getStoredAppCredits(keyRecord.userId);
      if (appCredits <= 0) {
        const res = NextResponse.json({ error: "insufficient_credits", message: "This key has no API Credit and your App Credit balance is empty." }, { status: 403 });
        applyStandardHeaders(res); queueUsageLog(keyRecord.id, res); return res;
      }
      useAppCreditFallback = true;
    }

    const { data: accessControl, error: accessControlError } = await supabaseAdmin
      .from("user_access_controls")
      .select("api_blocked, api_rate_limit_per_min")
      .eq("user_id", keyRecord.userId)
      .maybeSingle();
    if (accessControlError) {
      const res = NextResponse.json({ error: "internal_error", message: "Unable to load API access controls." }, { status: 500 });
      applyStandardHeaders(res);
      queueUsageLog(keyRecord.id, res);
      return res;
    }
    if (!isDev && accessControl?.api_blocked) {
      const res = NextResponse.json({ error: "api_access_blocked", message: "API access has been disabled for this account." }, { status: 403 });
      applyStandardHeaders(res);
      queueUsageLog(keyRecord.id, res);
      return res;
    }

    // 3. Rate limit — checked before any heavy processing
    let rateLimit: RateLimitResult;
    try {
      rateLimit = isDev
        ? { allowed: true, remaining: Number.MAX_SAFE_INTEGER, limit: Number.MAX_SAFE_INTEGER }
        : await checkRateLimit(keyRecord.id, accessControl?.api_rate_limit_per_min);
    } catch (err) {
      console.error("[api-middleware] Rate-limit lookup failed:", err);
      const res = NextResponse.json(
        { error: "internal_error", message: "Unable to check the API rate limit." },
        { status: 500 }
      );
      applyStandardHeaders(res);
      queueUsageLog(keyRecord.id, res);
      return res;
    }
    if (!rateLimit.allowed) {
      const res = NextResponse.json(
        { error: "rate_limited", message: "Too many requests. Please slow down." },
        { status: 429 }
      );
      applyStandardHeaders(res);
      res.headers.set("Retry-After", "60");
      res.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
      res.headers.set("X-RateLimit-Remaining", "0");
      queueUsageLog(keyRecord.id, res);
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
      const res = NextResponse.json(
        { error: "internal_error", message: "An unexpected error occurred." },
        { status: 500 }
      );
      applyStandardHeaders(res);
      queueUsageLog(keyRecord.id, res);
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
      if (charge > 0 && !isDev) {
        if (useAppCreditFallback) {
          response.headers.set("X-Credit-Warning", "API Credit exhausted; this request used one App Credit.");
        }
        after(async () => {
          try {
            if (useAppCreditFallback) {
              const deducted = profile?.is_pro
                ? await deductCredit(keyRecord.userId)
                : await deductStoredAppCredit(keyRecord.userId);
              if (!deducted) console.warn(`[api-middleware] App Credit fallback was unavailable for user ${keyRecord.userId}`);
            } else {
              await deductApiKeyCredits(keyRecord.id, charge);
            }
          } catch (err) {
            console.warn(`[api-middleware] Failed to deduct API key credits for key ${keyRecord.id}:`, err);
          }
        });
      }
    }

    queueUsageLog(keyRecord.id, response);
    return response;
  };
}
