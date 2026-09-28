/**
 * Unit tests for the shared health-check helpers in lib/health-checks.ts.
 * Focuses on the pure aggregation helpers and the unconfigured branches;
 * the reachability branches are covered by mocking global fetch.
 */

import {
  aggregateStatus,
  anyOk,
  overallStatus,
  checkAiProviders,
  checkWeatherProviders,
  checkSupabase,
  checkAllServices,
  ServicesHealth,
  HealthCheckError,
  AI_PROVIDERS,
  WEATHER_PROVIDERS,
  ProviderCheck,
} from '../health-checks';

// The Supabase admin client is only used by checkSupabase; mock it so the
// database check does not need real credentials or network access.
jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: jest.fn(),
}));

function makeCheck(
  provider: string,
  status: ProviderCheck["status"],
  configured = true
): ProviderCheck {
  return { provider, configured, status, latencyMs: 10, detail: status };
}

describe("aggregateStatus", () => {
  it("returns ok when all checks are ok", () => {
    expect(
      aggregateStatus([makeCheck("openai", "ok"), makeCheck("gemini", "ok")])
    ).toBe("ok");
  });

  it("returns degraded when at least one ok and one degraded", () => {
    expect(
      aggregateStatus([makeCheck("openai", "ok"), makeCheck("gemini", "degraded")])
    ).toBe("degraded");
  });

  it("returns degraded when ok and error are mixed", () => {
    expect(
      aggregateStatus([makeCheck("openai", "ok"), makeCheck("mistral", "error")])
    ).toBe("degraded");
  });

  it("returns error when all checks errored", () => {
    expect(
      aggregateStatus([makeCheck("openai", "error"), makeCheck("mistral", "error")])
    ).toBe("error");
  });

  it("returns unconfigured when all are unconfigured", () => {
    expect(
      aggregateStatus([
        makeCheck("openweather", "unconfigured", false),
        makeCheck("weatherapi", "unconfigured", false),
      ])
    ).toBe("unconfigured");
  });

  it("returns unconfigured for an empty list", () => {
    expect(aggregateStatus([])).toBe("unconfigured");
  });

  it("returns degraded when only degraded statuses present", () => {
    expect(aggregateStatus([makeCheck("openai", "degraded")])).toBe("degraded");
  });

  it("treats unconfigured + error as error", () => {
    expect(
      aggregateStatus([
        makeCheck("weatherapi", "unconfigured", false),
        makeCheck("openai", "error"),
      ])
    ).toBe("error");
  });
});

describe("anyOk", () => {
  it("is true when at least one check is ok", () => {
    expect(anyOk([makeCheck("openai", "ok"), makeCheck("mistral", "error")])).toBe(true);
  });

  it("is false when no check is ok", () => {
    expect(anyOk([makeCheck("openai", "error"), makeCheck("mistral", "degraded")])).toBe(false);
  });
});

describe("provider constants", () => {
  it("exposes the expected AI providers", () => {
    expect(AI_PROVIDERS).toEqual(["openai", "gemini", "mistral"]);
  });

  it("exposes the expected weather providers", () => {
    expect(WEATHER_PROVIDERS).toEqual([
      "openweather",
      "weatherapi",
      "visualcrossing",
      "pirateweather",
      "open-meteo",
      "bom",
    ]);
  });
});

describe("checkAiProviders", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns unconfigured entries when no AI keys are set", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MISTRAL_API_KEY;

    const results = await checkAiProviders();
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === "unconfigured")).toBe(true);
    expect(results.every((r) => r.configured === false)).toBe(true);
  });

  it("returns a single check when a valid provider is specified", async () => {
    delete process.env.OPENAI_API_KEY;
    const results = await checkAiProviders("openai");
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe("openai");
    expect(results[0].status).toBe("unconfigured");
  });

  it("normalizes provider casing", async () => {
    delete process.env.MISTRAL_API_KEY;
    const results = await checkAiProviders("MISTRAL");
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe("mistral");
    expect(results[0].status).toBe("unconfigured");
  });

  it("throws HealthCheckError for an unknown AI provider", async () => {
    await expect(checkAiProviders("not-a-provider")).rejects.toBeInstanceOf(
      HealthCheckError
    );
  });

  it("reports ok when a configured provider responds 2xx", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 });

    const results = await checkAiProviders("openai");
    expect(results[0].status).toBe("ok");
    expect(results[0].configured).toBe(true);
    expect(results[0].latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("reports degraded when a configured provider responds non-2xx", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401 });

    const results = await checkAiProviders("gemini");
    expect(results[0].status).toBe("degraded");
    expect(results[0].detail).toBe("HTTP 401");
  });

  it("reports error when a configured provider fetch throws", async () => {
    process.env.MISTRAL_API_KEY = "test-mistral-key";
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    const results = await checkAiProviders("mistral");
    expect(results[0].status).toBe("error");
    expect(results[0].detail).toBe("network down");
  });
});

describe("checkWeatherProviders", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns a mix of unconfigured and keyless checks when no keys are set", async () => {
    delete process.env.OPENWEATHER_API_KEY;
    delete process.env.WEATHERAPI_KEY;
    delete process.env.VISUALCROSSING_API_KEY;
    delete process.env.PIRATEWEATHER_API_KEY;

    const results = await checkWeatherProviders();
    expect(results).toHaveLength(6);
    const byProvider = Object.fromEntries(results.map((r) => [r.provider, r]));
    // Keyed providers are unconfigured; keyless ones still run a fetch.
    expect(byProvider["openweather"].status).toBe("unconfigured");
    expect(byProvider["weatherapi"].status).toBe("unconfigured");
    expect(byProvider["open-meteo"].configured).toBe(true);
    expect(byProvider["bom"].configured).toBe(true);
  });

  it("throws HealthCheckError for an unknown weather provider", async () => {
    await expect(checkWeatherProviders("not-a-provider")).rejects.toBeInstanceOf(
      HealthCheckError
    );
  });

  it("returns a single check for a known weather provider", async () => {
    process.env.OPENWEATHER_API_KEY = "test-weather-key";
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 });

    const results = await checkWeatherProviders("openweather");
    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe("openweather");
    expect(results[0].status).toBe("ok");
  });
});


function makeServices(
  database: ProviderCheck["status"],
  ai: ProviderCheck["status"],
  weather: ProviderCheck["status"]
): ServicesHealth {
  return {
    database: { status: database, responseTime: database === "unconfigured" ? null : 10 },
    ai: { status: ai, responseTime: ai === "unconfigured" ? null : 20 },
    weather: { status: weather, responseTime: weather === "unconfigured" ? null : 30 },
  };
}

describe("overallStatus", () => {
  it("returns ok when all categories are ok", () => {
    expect(overallStatus(makeServices("ok", "ok", "ok"))).toBe("ok");
  });

  it("returns degraded when one category is degraded and the rest ok", () => {
    expect(overallStatus(makeServices("ok", "degraded", "ok"))).toBe("degraded");
  });

  it("returns degraded when one category errored but another is ok", () => {
    expect(overallStatus(makeServices("error", "ok", "ok"))).toBe("degraded");
  });

  it("returns error when every category has errored", () => {
    expect(overallStatus(makeServices("error", "error", "error"))).toBe("error");
  });

  it("returns degraded when error and degraded are mixed without ok", () => {
    expect(overallStatus(makeServices("error", "degraded", "error"))).toBe("degraded");
  });

  it("treats unconfigured as healthy when an ok category is present", () => {
    expect(overallStatus(makeServices("ok", "unconfigured", "unconfigured"))).toBe("ok");
  });
});

describe("checkSupabase", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns unconfigured when Supabase env vars are missing", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await checkSupabase();
    expect(result.provider).toBe("supabase");
    expect(result.status).toBe("unconfigured");
    expect(result.configured).toBe(false);
  });

  it("returns ok when the database query succeeds", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    const { getSupabaseAdmin } = jest.requireMock("@/lib/supabase");
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const result = await checkSupabase();
    expect(result.status).toBe("ok");
    expect(result.configured).toBe(true);
    expect(typeof result.latencyMs).toBe("number");
  });

  it("returns degraded when the database query returns an error", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    const { getSupabaseAdmin } = jest.requireMock("@/lib/supabase");
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ error: { message: "relation not found" } }),
        }),
      }),
    });

    const result = await checkSupabase();
    expect(result.status).toBe("degraded");
    expect(result.detail).toBe("relation not found");
  });

  it("returns error when the database query throws", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    const { getSupabaseAdmin } = jest.requireMock("@/lib/supabase");
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockRejectedValue(new Error("Connection refused")),
        }),
      }),
    });

    const result = await checkSupabase();
    expect(result.status).toBe("error");
    expect(result.detail).toBe("Connection refused");
  });
});

describe("checkAllServices", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns aggregated status and responseTime per category", async () => {
    // No provider keys set -> categories will be unconfigured, except the
    // keyless weather providers which still run a fetch.
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await checkAllServices();
    expect(result.database.status).toBe("unconfigured");
    expect(result.database.responseTime).toBeNull();
    expect(result.ai.status).toBe("unconfigured");
    expect(result.ai.responseTime).toBeNull();
    expect(result.weather).toBeDefined();
    expect(result.weather).toHaveProperty("status");
    expect(result.weather).toHaveProperty("responseTime");
  });

  it("reports ok database and unconfigured AI when only Supabase is configured", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    const { getSupabaseAdmin } = jest.requireMock("@/lib/supabase");
    (getSupabaseAdmin as jest.Mock).mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    const result = await checkAllServices();
    expect(result.database.status).toBe("ok");
    expect(typeof result.database.responseTime).toBe("number");
    expect(result.ai.status).toBe("unconfigured");
  });
});
