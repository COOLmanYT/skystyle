/**
 * Unit tests for the shared health-check helpers in lib/health-checks.ts.
 * Focuses on the pure aggregation helpers and the unconfigured branches;
 * the reachability branches are covered by mocking global fetch.
 */

import {
  aggregateStatus,
  anyOk,
  checkAiProviders,
  checkWeatherProviders,
  HealthCheckError,
  AI_PROVIDERS,
  WEATHER_PROVIDERS,
  ProviderCheck,
} from '../health-checks';

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
