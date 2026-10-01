import { supabaseAdmin } from "./supabase";
export type HealthStatus = "ok" | "degraded" | "unconfigured";
export type HealthCategory = "database" | "ai" | "weather";
export interface ProviderHealth { provider: string; status: HealthStatus; latencyMs: number | null; }
const cache = new Map<HealthCategory, { expires: number; checkedAt: string; providers: ProviderHealth[] }>();
const pending = new Map<HealthCategory, Promise<{ checkedAt: string; providers: ProviderHealth[] }>>();
const TIMEOUT = 4000;
export const HEALTH_PROVIDERS = { database: ["supabase"], ai: ["openai", "gemini", "mistral"], weather: ["open-meteo"] } as const;
export function aggregateHealth(providers: ProviderHealth[]): HealthStatus {
  if (providers.every((entry) => entry.status === "unconfigured")) return "unconfigured";
  return providers.some((entry) => entry.status === "degraded") ? "degraded" : "ok";
}
async function ping(provider: string, url: string, headers?: Record<string, string>): Promise<ProviderHealth> {
  const start = Date.now();
  try {
    const response = await fetch(url, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(TIMEOUT) });
    void response.body?.cancel();
    return { provider, status: response.ok ? "ok" : "degraded", latencyMs: Date.now() - start };
  } catch { return { provider, status: "degraded", latencyMs: Date.now() - start }; }
}
async function probe(category: HealthCategory): Promise<ProviderHealth[]> {
  if (category === "database") {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [{ provider: "supabase", status: "unconfigured", latencyMs: null }];
    const start = Date.now();
    try {
      const { error } = await supabaseAdmin.from("users").select("id").limit(1).abortSignal(AbortSignal.timeout(TIMEOUT));
      return [{ provider: "supabase", status: error ? "degraded" : "ok", latencyMs: Date.now() - start }];
    } catch { return [{ provider: "supabase", status: "degraded", latencyMs: Date.now() - start }]; }
  }
  if (category === "weather") return [await ping("open-meteo", "https://api.open-meteo.com/v1/forecast?latitude=-33.87&longitude=151.21&current=temperature_2m")];
  const configs = [
    { provider: "openai", key: process.env.OPENAI_API_KEY, url: "https://api.openai.com/v1/models" },
    { provider: "gemini", key: process.env.GEMINI_API_KEY, url: "https://generativelanguage.googleapis.com/v1beta/models" },
    { provider: "mistral", key: process.env.MISTRAL_API_KEY, url: "https://api.mistral.ai/v1/models" },
  ];
  // List models only: never spend generation tokens or probe user BYOK keys.
  return Promise.all(configs.map(({ provider, key, url }) => key ? ping(provider, url,
    provider === "gemini" ? { "x-goog-api-key": key } : { Authorization: `Bearer ${key}` })
    : Promise.resolve({ provider, status: "unconfigured" as const, latencyMs: null })));
}
export async function getCategoryHealth(category: HealthCategory) {
  const entry = cache.get(category);
  if (entry && entry.expires > Date.now()) return { ...entry, cached: true };
  const inFlight = pending.get(category);
  if (inFlight) return { ...await inFlight, cached: true };
  const request = probe(category).then((providers) => ({ providers, checkedAt: new Date().toISOString() }));
  pending.set(category, request);
  try {
    const result = await request;
    cache.set(category, { ...result, expires: Date.now() + 300_000 });
    return { ...result, cached: false };
  } finally { pending.delete(category); }
}
