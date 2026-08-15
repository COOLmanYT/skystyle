/**
 * Unit tests for the public /api/v1/health* routes.
 * The health-checks lib is mocked so these focus on route-layer behaviour:
 * response shape, status codes, provider query handling, and error mapping.
 */

import { GET as getHealth } from "../route";
import { GET as getAiHealth } from "../ai/route";
import { GET as getWeatherHealth } from "../weather/route";
import { GET as getDbHealth } from "../db/route";
import { NextRequest } from "next/server";

import {
  checkAiProviders,
  checkWeatherProviders,
  checkSupabase,
  checkAllServices,
  HealthCheckError,
  ProviderCheck,
} from "@/lib/health-checks";

// Mock only the outbound check functions; keep the pure helpers
// (aggregateStatus, anyOk, HealthCheckError, overallStatus) at their real
// implementations so the computed `status` field behaves correctly.
jest.mock("@/lib/health-checks", () => {
  const actual = jest.requireActual("@/lib/health-checks");
  return {
    ...actual,
    checkAiProviders: jest.fn(),
    checkWeatherProviders: jest.fn(),
    checkSupabase: jest.fn(),
    checkAllServices: jest.fn(),
  };
});

const okCheck = (provider: string): ProviderCheck => ({
  provider,
  configured: true,
  status: "ok",
  latencyMs: 5,
  detail: `${provider} reachable`,
});

const unconfiguredCheck = (provider: string): ProviderCheck => ({
  provider,
  configured: false,
  status: "unconfigured",
  latencyMs: null,
  detail: `${provider} not set`,
});

function createRequest(pathWithQuery: string): NextRequest {
  const url = new URL(pathWithQuery, "http://localhost:3000");
  return { nextUrl: { searchParams: url.searchParams } } as unknown as NextRequest;
}

function serviceHealth(status: ProviderCheck["status"], responseTime: number | null) {
  return { status, responseTime };
}

describe("GET /api/v1/health", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the consolidated status, Sky Style responseTime, and services object", async () => {
    (checkAllServices as jest.Mock).mockResolvedValue({
      database: serviceHealth("ok", 42),
      ai: serviceHealth("degraded", 18304),
      weather: serviceHealth("ok", 216),
    });

    const res = await getHealth();
    expect(res.status).toBe(200);
    const data = await res.json();

    // Matches the requested consolidated shape.
    expect(data.status).toBe("degraded");
    expect(typeof data.responseTime).toBe("number");
    expect(data.services).toBeDefined();
    expect(data.services.database).toEqual({ status: "ok", responseTime: 42 });
    expect(data.services.ai).toEqual({ status: "degraded", responseTime: 18304 });
    expect(data.services.weather).toEqual({ status: "ok", responseTime: 216 });
  });

  it("reports ok when every service category is ok", async () => {
    (checkAllServices as jest.Mock).mockResolvedValue({
      database: serviceHealth("ok", 12),
      ai: serviceHealth("ok", 30),
      weather: serviceHealth("ok", 20),
    });

    const res = await getHealth();
    const data = await res.json();
    expect(data.status).toBe("ok");
  });

  it("reports error when every service category has errored", async () => {
    (checkAllServices as jest.Mock).mockResolvedValue({
      database: serviceHealth("error", 8),
      ai: serviceHealth("error", 9),
      weather: serviceHealth("error", 7),
    });

    const res = await getHealth();
    const data = await res.json();
    expect(data.status).toBe("error");
  });

  it("treats unconfigured categories (with an ok one) as overall ok", async () => {
    (checkAllServices as jest.Mock).mockResolvedValue({
      database: serviceHealth("ok", 12),
      ai: serviceHealth("unconfigured", null),
      weather: serviceHealth("ok", 20),
    });

    const res = await getHealth();
    const data = await res.json();
    expect(data.status).toBe("ok");
  });
});

describe("GET /api/v1/health/db", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the database status, latency, and Sky Style response time", async () => {
    (checkSupabase as jest.Mock).mockResolvedValue(
      okCheck("supabase")
    );

    const res = await getDbHealth();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.providers).toHaveLength(1);
    expect(data.providers[0].provider).toBe("supabase");
    expect(data.providers[0].latencyMs).toBe(5);
    expect(typeof data.responseTimeMs).toBe("number");
    expect(data.timestamp).toBeDefined();
  });

  it("reports unconfigured when the database is not set up", async () => {
    (checkSupabase as jest.Mock).mockResolvedValue(
      unconfiguredCheck("supabase")
    );

    const res = await getDbHealth();
    const data = await res.json();
    expect(data.status).toBe("unconfigured");
    expect(data.providers[0].configured).toBe(false);
  });

  it("reports error when the database check throws", async () => {
    (checkSupabase as jest.Mock).mockResolvedValue({
      ...okCheck("supabase"),
      status: "error",
      detail: "Connection refused",
    });

    const res = await getDbHealth();
    const data = await res.json();
    expect(data.status).toBe("error");
  });
});

describe("GET /api/v1/health/ai", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns all AI providers when no provider is specified", async () => {
    (checkAiProviders as jest.Mock).mockResolvedValue([
      okCheck("openai"),
      okCheck("gemini"),
      okCheck("mistral"),
    ]);

    const res = await getAiHealth(createRequest("/api/v1/health/ai"));
    expect(res.status).toBe(200);
    expect(checkAiProviders).toHaveBeenCalledWith(undefined);
    const data = await res.json();
    expect(data.providers).toHaveLength(3);
    expect(data.status).toBe("ok");
    expect(typeof data.responseTimeMs).toBe("number");
    expect(data.timestamp).toBeDefined();
  });

  it("passes the provider query parameter through", async () => {
    (checkAiProviders as jest.Mock).mockResolvedValue([okCheck("mistral")]);

    const res = await getAiHealth(createRequest("/api/v1/health/ai?provider=mistral"));
    expect(res.status).toBe(200);
    expect(checkAiProviders).toHaveBeenCalledWith("mistral");
    const data = await res.json();
    expect(data.providers).toHaveLength(1);
    expect(data.providers[0].provider).toBe("mistral");
  });

  it("trims whitespace from the provider parameter", async () => {
    (checkAiProviders as jest.Mock).mockResolvedValue([okCheck("openai")]);

    await getAiHealth(createRequest("/api/v1/health/ai?provider=%20openai%20"));
    expect(checkAiProviders).toHaveBeenCalledWith("openai");
  });

  it("maps an unknown provider to a 400 invalid_provider", async () => {
    (checkAiProviders as jest.Mock).mockRejectedValue(
      new HealthCheckError('Unknown AI provider "bogus".')
    );

    const res = await getAiHealth(createRequest("/api/v1/health/ai?provider=bogus"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_provider");
    expect(data.message).toContain("Unknown AI provider");
  });

  it("reports degraded status when one provider is ok and one errored", async () => {
    (checkAiProviders as jest.Mock).mockResolvedValue([
      okCheck("openai"),
      { ...unconfiguredCheck("gemini"), status: "error" },
    ]);

    const res = await getAiHealth(createRequest("/api/v1/health/ai"));
    const data = await res.json();
    expect(data.status).toBe("degraded");
  });

  it("reports ok status when a provider is ok and another is merely unconfigured", async () => {
    // An unconfigured provider is not a failure: it is simply not in use, so a
    // healthy provider alongside it still yields an overall "ok" status.
    (checkAiProviders as jest.Mock).mockResolvedValue([
      okCheck("openai"),
      unconfiguredCheck("gemini"),
    ]);

    const res = await getAiHealth(createRequest("/api/v1/health/ai"));
    const data = await res.json();
    expect(data.status).toBe("ok");
  });
});

describe("GET /api/v1/health/weather", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns all weather providers when no provider is specified", async () => {
    (checkWeatherProviders as jest.Mock).mockResolvedValue([
      okCheck("openweather"),
      okCheck("open-meteo"),
    ]);

    const res = await getWeatherHealth(createRequest("/api/v1/health/weather"));
    expect(res.status).toBe(200);
    expect(checkWeatherProviders).toHaveBeenCalledWith(undefined);
    const data = await res.json();
    expect(data.providers.length).toBeGreaterThan(0);
    expect(data.status).toBe("ok");
  });

  it("passes the provider query parameter through", async () => {
    (checkWeatherProviders as jest.Mock).mockResolvedValue([okCheck("openweather")]);

    const res = await getWeatherHealth(
      createRequest("/api/v1/health/weather?provider=openweather")
    );
    expect(res.status).toBe(200);
    expect(checkWeatherProviders).toHaveBeenCalledWith("openweather");
    const data = await res.json();
    expect(data.providers[0].provider).toBe("openweather");
  });

  it("maps an unknown provider to a 400 invalid_provider", async () => {
    (checkWeatherProviders as jest.Mock).mockRejectedValue(
      new HealthCheckError('Unknown weather provider "bogus".')
    );

    const res = await getWeatherHealth(
      createRequest("/api/v1/health/weather?provider=bogus")
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid_provider");
  });

  it("reports error status when all providers errored", async () => {
    const errorCheck: ProviderCheck = {
      provider: "openweather",
      configured: true,
      status: "error",
      latencyMs: 5,
      detail: "Request failed",
    };
    (checkWeatherProviders as jest.Mock).mockResolvedValue([errorCheck]);

    const res = await getWeatherHealth(createRequest("/api/v1/health/weather"));
    const data = await res.json();
    expect(data.status).toBe("error");
  });
});
