export const dynamic = "force-dynamic";
/**
 * GET /api/dev/health
 *
 * Returns system health diagnostics for the dev health panel.
 * Dev-only — verified against DEV_EMAILS.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDevEmails } from "@/lib/dev-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

interface ServiceCheck {
  status: "ok" | "degraded" | "error" | "unconfigured";
  latencyMs: number | null;
  detail: string;
}

async function checkSupabase(): Promise<ServiceCheck> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { status: "unconfigured", latencyMs: null, detail: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set" };
  }
  const start = Date.now();
  try {
    const { error } = await getSupabaseAdmin()
      .from("users")
      .select("id")
      .limit(1);
    const latencyMs = Date.now() - start;
    if (error) {
      return { status: "degraded", latencyMs, detail: error.message };
    }
    return { status: "ok", latencyMs, detail: "Connected" };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function checkWeatherApi(): Promise<ServiceCheck> {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return { status: "unconfigured", latencyMs: null, detail: "OPENWEATHER_API_KEY not set" };
  }
  const start = Date.now();
  try {
    // Lightweight status check — fetch weather for a known coordinate (Sydney)
    const params = new URLSearchParams({ lat: "-33.87", lon: "151.21", appid: apiKey, units: "metric" });
    const url = `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { status: "degraded", latencyMs, detail: `HTTP ${res.status}` };
    }
    return { status: "ok", latencyMs, detail: "OpenWeatherMap reachable" };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Check Mistral independently so a configured fallback is visible even when
 * OpenAI or Gemini is currently the preferred provider. */
async function checkMistralApi(apiKey = process.env.MISTRAL_API_KEY): Promise<ServiceCheck> {
  if (!apiKey) {
    return { status: "unconfigured", latencyMs: null, detail: "MISTRAL_API_KEY not set" };
  }
  const start = Date.now();
  try {
    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { status: "degraded", latencyMs, detail: `HTTP ${res.status}` };
    return { status: "ok", latencyMs, detail: "Mistral reachable" };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

async function checkAiProvider(): Promise<ServiceCheck & { provider: string }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const mistralKey = process.env.MISTRAL_API_KEY;

  if (!openaiKey && !geminiKey && !mistralKey) {
    return {
      status: "unconfigured",
      latencyMs: null,
      detail: "No AI provider key set",
      provider: "none",
    };
  }

  // Prefer OpenAI if available
  if (openaiKey) {
    const start = Date.now();
    try {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${openaiKey}` },
        signal: AbortSignal.timeout(6000),
      });
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        return { status: "degraded", latencyMs, detail: `HTTP ${res.status}`, provider: "openai" };
      }
      return { status: "ok", latencyMs, detail: "OpenAI reachable", provider: "openai" };
    } catch (err) {
      return {
        status: "error",
        latencyMs: Date.now() - start,
        detail: err instanceof Error ? err.message : "Request failed",
        provider: "openai",
      };
    }
  }

  // Gemini fallback
  if (geminiKey) {
  const start = Date.now();
  try {
    const geminiParams = new URLSearchParams({ key: geminiKey! });
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?${geminiParams.toString()}`,
      { signal: AbortSignal.timeout(6000) }
    );
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { status: "degraded", latencyMs, detail: `HTTP ${res.status}`, provider: "gemini" };
    }
    return { status: "ok", latencyMs, detail: "Gemini reachable", provider: "gemini" };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : "Request failed",
      provider: "gemini",
    };
  }
  }

  // Mistral fallback
  const mistral = await checkMistralApi(mistralKey);
  return { ...mistral, provider: "mistral" };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!getDevEmails().has(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Run all checks in parallel
  const [supabase, weather, ai, mistral] = await Promise.all([
    checkSupabase(),
    checkWeatherApi(),
    checkAiProvider(),
    checkMistralApi(),
  ]);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    supabase,
    weather,
    ai,
    mistral,
    env: {
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      mistralConfigured: !!process.env.MISTRAL_API_KEY,
      openweatherConfigured: !!process.env.OPENWEATHER_API_KEY,
      supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      nodeEnv: process.env.NODE_ENV ?? "unknown",
    },
  });
}
