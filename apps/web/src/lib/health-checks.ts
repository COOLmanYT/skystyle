/**
 * Shared health-check logic for the public /api/health* endpoints.
 *
 * These checks are intentionally lightweight: each provider is pinged once
 * with a cheap request and a short timeout. Checks never reveal secret
 * material — only whether a key is configured and the provider is reachable.
 *
 * Used by:
 *   - GET /api/health         (overall Sky Style health, no auth)
 *   - GET /api/health/ai      (AI provider health, optional ?provider=)
 *   - GET /api/health/weather (weather provider health, optional ?provider=)
 */

/** A single health-check result for one provider or subsystem. */
export interface ServiceCheck {
  status: "ok" | "degraded" | "error" | "unconfigured";
  latencyMs: number | null;
  detail: string;
}

/** Provider status extended with the provider identifier. */
export interface ProviderCheck extends ServiceCheck {
  provider: string;
  /** Whether an API key / credential is configured for this provider. */
  configured: boolean;
}

const CHECK_TIMEOUT_MS = 6000;

/** A coordinate used for weather provider reachability pings (Sydney, AU). */
const PING_COORD = { lat: -33.87, lon: 151.21 };

/** All AI provider identifiers supported by the health checks. */
export const AI_PROVIDERS = ["openai", "gemini", "mistral"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** All weather provider identifiers supported by the health checks. */
export const WEATHER_PROVIDERS = [
  "openweather",
  "weatherapi",
  "visualcrossing",
  "pirateweather",
  "open-meteo",
  "bom",
] as const;
export type WeatherProvider = (typeof WEATHER_PROVIDERS)[number];

function unconfigured(detail: string): ServiceCheck {
  return { status: "unconfigured", latencyMs: null, detail };
}

function timed(start: number): number {
  return Date.now() - start;
}

/** Check OpenAI by listing models (requires OPENAI_API_KEY). */
export async function checkOpenAI(
  apiKey = process.env.OPENAI_API_KEY
): Promise<ProviderCheck> {
  if (!apiKey) {
    return { provider: "openai", configured: false, ...unconfigured("OPENAI_API_KEY not set") };
  }
  const start = Date.now();
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { provider: "openai", configured: true, status: "degraded", latencyMs: timed(start), detail: `HTTP ${res.status}` };
    }
    return { provider: "openai", configured: true, status: "ok", latencyMs: timed(start), detail: "OpenAI reachable" };
  } catch (err) {
    return {
      provider: "openai",
      configured: true,
      status: "error",
      latencyMs: timed(start),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Check Google Gemini by listing models (requires GEMINI_API_KEY). */
export async function checkGemini(
  apiKey = process.env.GEMINI_API_KEY
): Promise<ProviderCheck> {
  if (!apiKey) {
    return { provider: "gemini", configured: false, ...unconfigured("GEMINI_API_KEY not set") };
  }
  const start = Date.now();
  try {
    const params = new URLSearchParams({ key: apiKey });
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?${params.toString()}`,
      { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
    );
    if (!res.ok) {
      return { provider: "gemini", configured: true, status: "degraded", latencyMs: timed(start), detail: `HTTP ${res.status}` };
    }
    return { provider: "gemini", configured: true, status: "ok", latencyMs: timed(start), detail: "Gemini reachable" };
  } catch (err) {
    return {
      provider: "gemini",
      configured: true,
      status: "error",
      latencyMs: timed(start),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Check Mistral AI by listing models (requires MISTRAL_API_KEY). */
export async function checkMistral(
  apiKey = process.env.MISTRAL_API_KEY
): Promise<ProviderCheck> {
  if (!apiKey) {
    return { provider: "mistral", configured: false, ...unconfigured("MISTRAL_API_KEY not set") };
  }
  const start = Date.now();
  try {
    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { provider: "mistral", configured: true, status: "degraded", latencyMs: timed(start), detail: `HTTP ${res.status}` };
    }
    return { provider: "mistral", configured: true, status: "ok", latencyMs: timed(start), detail: "Mistral reachable" };
  } catch (err) {
    return {
      provider: "mistral",
      configured: true,
      status: "error",
      latencyMs: timed(start),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Check OpenWeatherMap by fetching current weather for a known coordinate. */
export async function checkOpenWeather(
  apiKey = process.env.OPENWEATHER_API_KEY
): Promise<ProviderCheck> {
  if (!apiKey) {
    return { provider: "openweather", configured: false, ...unconfigured("OPENWEATHER_API_KEY not set") };
  }
  const start = Date.now();
  try {
    const params = new URLSearchParams({
      lat: String(PING_COORD.lat),
      lon: String(PING_COORD.lon),
      appid: apiKey,
      units: "metric",
    });
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?${params.toString()}`,
      { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
    );
    if (!res.ok) {
      return { provider: "openweather", configured: true, status: "degraded", latencyMs: timed(start), detail: `HTTP ${res.status}` };
    }
    return { provider: "openweather", configured: true, status: "ok", latencyMs: timed(start), detail: "OpenWeatherMap reachable" };
  } catch (err) {
    return {
      provider: "openweather",
      configured: true,
      status: "error",
      latencyMs: timed(start),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Check WeatherAPI.com by fetching current weather for a known coordinate. */
export async function checkWeatherApi(
  apiKey = process.env.WEATHERAPI_KEY
): Promise<ProviderCheck> {
  if (!apiKey) {
    return { provider: "weatherapi", configured: false, ...unconfigured("WEATHERAPI_KEY not set") };
  }
  const start = Date.now();
  try {
    const params = new URLSearchParams({
      q: `${PING_COORD.lat},${PING_COORD.lon}`,
      key: apiKey,
    });
    const res = await fetch(
      `https://api.weatherapi.com/v1/current.json?${params.toString()}`,
      { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
    );
    if (!res.ok) {
      return { provider: "weatherapi", configured: true, status: "degraded", latencyMs: timed(start), detail: `HTTP ${res.status}` };
    }
    return { provider: "weatherapi", configured: true, status: "ok", latencyMs: timed(start), detail: "WeatherAPI.com reachable" };
  } catch (err) {
    return {
      provider: "weatherapi",
      configured: true,
      status: "error",
      latencyMs: timed(start),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Check Visual Crossing by fetching current weather for a known coordinate. */
export async function checkVisualCrossing(
  apiKey = process.env.VISUALCROSSING_API_KEY
): Promise<ProviderCheck> {
  if (!apiKey) {
    return { provider: "visualcrossing", configured: false, ...unconfigured("VISUALCROSSING_API_KEY not set") };
  }
  const start = Date.now();
  try {
    const params = new URLSearchParams({
      key: apiKey,
      unitGroup: "metric",
      include: "current",
    });
    const res = await fetch(
      `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${PING_COORD.lat}%2C${PING_COORD.lon}?${params.toString()}`,
      { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
    );
    if (!res.ok) {
      return { provider: "visualcrossing", configured: true, status: "degraded", latencyMs: timed(start), detail: `HTTP ${res.status}` };
    }
    return { provider: "visualcrossing", configured: true, status: "ok", latencyMs: timed(start), detail: "Visual Crossing reachable" };
  } catch (err) {
    return {
      provider: "visualcrossing",
      configured: true,
      status: "error",
      latencyMs: timed(start),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Check Pirate Weather by fetching current weather for a known coordinate. */
export async function checkPirateWeather(
  apiKey = process.env.PIRATEWEATHER_API_KEY
): Promise<ProviderCheck> {
  if (!apiKey) {
    return { provider: "pirateweather", configured: false, ...unconfigured("PIRATEWEATHER_API_KEY not set") };
  }
  const start = Date.now();
  try {
    const res = await fetch(
      `https://api.pirateweather.net/forecast/${apiKey}/${PING_COORD.lat},${PING_COORD.lon}?units=si`,
      { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
    );
    if (!res.ok) {
      return { provider: "pirateweather", configured: true, status: "degraded", latencyMs: timed(start), detail: `HTTP ${res.status}` };
    }
    return { provider: "pirateweather", configured: true, status: "ok", latencyMs: timed(start), detail: "Pirate Weather reachable" };
  } catch (err) {
    return {
      provider: "pirateweather",
      configured: true,
      status: "error",
      latencyMs: timed(start),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Check Open-Meteo (free, no key required) by fetching current weather. */
export async function checkOpenMeteo(): Promise<ProviderCheck> {
  const start = Date.now();
  try {
    const params = new URLSearchParams({
      latitude: String(PING_COORD.lat),
      longitude: String(PING_COORD.lon),
      current: "temperature_2m",
    });
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
      { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
    );
    if (!res.ok) {
      return { provider: "open-meteo", configured: true, status: "degraded", latencyMs: timed(start), detail: `HTTP ${res.status}` };
    }
    return { provider: "open-meteo", configured: true, status: "ok", latencyMs: timed(start), detail: "Open-Meteo reachable" };
  } catch (err) {
    return {
      provider: "open-meteo",
      configured: true,
      status: "error",
      latencyMs: timed(start),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

/** Check the Australian Bureau of Meteorology observations feed (free, no key). */
export async function checkBom(): Promise<ProviderCheck> {
  const start = Date.now();
  try {
    // BOM observation JSON feed for Sydney area
    const res = await fetch(
      "https://reg.bom.gov.au/fwo/IDN60901/IDN60901.94768.json",
      { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
    );
    if (!res.ok) {
      return { provider: "bom", configured: true, status: "degraded", latencyMs: timed(start), detail: `HTTP ${res.status}` };
    }
    return { provider: "bom", configured: true, status: "ok", latencyMs: timed(start), detail: "Bureau of Meteorology reachable" };
  } catch (err) {
    return {
      provider: "bom",
      configured: true,
      status: "error",
      latencyMs: timed(start),
      detail: err instanceof Error ? err.message : "Request failed",
    };
  }
}

const AI_CHECKS: Record<AiProvider, () => Promise<ProviderCheck>> = {
  openai: () => checkOpenAI(),
  gemini: () => checkGemini(),
  mistral: () => checkMistral(),
};

const WEATHER_CHECKS: Record<WeatherProvider, () => Promise<ProviderCheck>> = {
  openweather: () => checkOpenWeather(),
  weatherapi: () => checkWeatherApi(),
  visualcrossing: () => checkVisualCrossing(),
  pirateweather: () => checkPirateWeather(),
  "open-meteo": () => checkOpenMeteo(),
  bom: () => checkBom(),
};

/**
 * Run health checks for all AI providers, or a single provider when `provider`
 * is given. Returns the requested checks in a stable order.
 */
export async function checkAiProviders(provider?: string): Promise<ProviderCheck[]> {
  if (provider) {
    const normalized = provider.toLowerCase();
    if (!AI_PROVIDERS.includes(normalized as AiProvider)) {
      throw new HealthCheckError(
        `Unknown AI provider "${provider}". Supported: ${AI_PROVIDERS.join(", ")}.`
      );
    }
    return [await AI_CHECKS[normalized as AiProvider]()];
  }
  return Promise.all(AI_PROVIDERS.map((key) => AI_CHECKS[key]()));
}

/**
 * Run health checks for all weather providers, or a single provider when
 * `provider` is given. Returns the requested checks in a stable order.
 */
export async function checkWeatherProviders(provider?: string): Promise<ProviderCheck[]> {
  if (provider) {
    const normalized = provider.toLowerCase();
    if (!WEATHER_PROVIDERS.includes(normalized as WeatherProvider)) {
      throw new HealthCheckError(
        `Unknown weather provider "${provider}". Supported: ${WEATHER_PROVIDERS.join(", ")}.`
      );
    }
    return [await WEATHER_CHECKS[normalized as WeatherProvider]()];
  }
  return Promise.all(WEATHER_PROVIDERS.map((key) => WEATHER_CHECKS[key]()));
}

/** Error thrown when an unsupported provider is requested. */
export class HealthCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HealthCheckError";
  }
}

/** Whether at least one provider check reached "ok" status. */
export function anyOk(checks: ProviderCheck[]): boolean {
  return checks.some((c) => c.status === "ok");
}

/** Overall status for a set of provider checks. */
export function aggregateStatus(checks: ProviderCheck[]): ServiceCheck["status"] {
  if (checks.length === 0) return "unconfigured";
  const statuses = new Set(checks.map((c) => c.status));
  if (statuses.has("ok") && !statuses.has("error") && !statuses.has("degraded")) {
    return "ok";
  }
  if (statuses.has("ok")) return "degraded";
  if (statuses.has("degraded")) return "degraded";
  if (statuses.has("unconfigured") && !statuses.has("error")) return "unconfigured";
  return "error";
}
