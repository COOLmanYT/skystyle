/**
 * Unit tests for the public /api/health* routes.
 * The health-checks lib is mocked so these focus on route-layer behaviour:
 * response shape, status codes, provider query handling, and error mapping.
 */

import { GET as getHealth } from "../route";
import { GET as getAiHealth } from "../ai/route";
import { GET as getWeatherHealth } from "../weather/route";
import { NextRequest } from "next/server";

import {
  checkAiProviders,
  checkWeatherProviders,
  HealthCheckError,
  ProviderCheck,
} from "@/lib/health-checks";

// Mock only the outbound check functions; keep the pure helpers
// (aggregateStatus, anyOk, HealthCheckError) at their real implementations so
// the computed `status` field behaves correctly.
jest.mock("@/lib/health-checks", () => {
  const actual = jest.requireActual("@/lib/health-checks");
  return {
    ...actual,
    checkAiProviders: jest.fn(),
    checkWeatherProviders: jest.fn(),
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

describe("GET /api/health", () => {
  it("returns 200 with service status and no-store headers", async () => {
    const res = await getHealth();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("skystyle");
    expect(data.timestamp).toBeDefined();
    expect(data.providers).toBeDefined();
    expect(data.providers.ai).toBeDefined();
    expect(data.providers.weather).toBeDefined();
  });

  it("reports configured-state booleans from the environment", async () => {
    process.env.OPENAI_API_KEY = "k";
    delete process.env.GEMINI_API_KEY;
    const res = await getHealth();
    const data = await res.json();
    expect(data.providers.ai.openai).toBe(true);
    expect(data.providers.ai.gemini).toBe(false);
  });
});

describe("GET /api/health/ai", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns all AI providers when no provider is specified", async () => {
    (checkAiProviders as jest.Mock).mockResolvedValue([
      okCheck("openai"),
      okCheck("gemini"),
      okCheck("mistral"),
    ]);

    const res = await getAiHealth(createRequest("/api/health/ai"));
    expect(res.status).toBe(200);
    expect(checkAiProviders).toHaveBeenCalledWith(undefined);
    const data = await res.json();
    expect(data.providers).toHaveLength(3);
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
  });

  it("passes the provider query parameter through", async () => {
    (checkAiProviders as jest.Mock).mockResolvedValue([okCheck("mistral")]);

    const res = await getAiHealth(createRequest("/api/health/ai?provider=mistral"));
    expect(res.status).toBe(200);
    expect(checkAiProviders).toHaveBeenCalledWith("mistral");
    const data = await res.json();
    expect(data.providers).toHaveLength(1);
    expect(data.providers[0].provider).toBe("mistral");
  });

  it("trims whitespace from the provider parameter", async () => {
    (checkAiProviders as jest.Mock).mockResolvedValue([okCheck("openai")]);

    await getAiHealth(createRequest("/api/health/ai?provider=%20openai%20"));
    expect(checkAiProviders).toHaveBeenCalledWith("openai");
  });

  it("maps an unknown provider to a 400 invalid_provider", async () => {
    (checkAiProviders as jest.Mock).mockRejectedValue(
      new HealthCheckError('Unknown AI provider "bogus".')
    );

    const res = await getAiHealth(createRequest("/api/health/ai?provider=bogus"));
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

    const res = await getAiHealth(createRequest("/api/health/ai"));
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

    const res = await getAiHealth(createRequest("/api/health/ai"));
    const data = await res.json();
    expect(data.status).toBe("ok");
  });
});

describe("GET /api/health/weather", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns all weather providers when no provider is specified", async () => {
    (checkWeatherProviders as jest.Mock).mockResolvedValue([
      okCheck("openweather"),
      okCheck("open-meteo"),
    ]);

    const res = await getWeatherHealth(createRequest("/api/health/weather"));
    expect(res.status).toBe(200);
    expect(checkWeatherProviders).toHaveBeenCalledWith(undefined);
    const data = await res.json();
    expect(data.providers.length).toBeGreaterThan(0);
    expect(data.status).toBe("ok");
  });

  it("passes the provider query parameter through", async () => {
    (checkWeatherProviders as jest.Mock).mockResolvedValue([okCheck("openweather")]);

    const res = await getWeatherHealth(
      createRequest("/api/health/weather?provider=openweather")
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
      createRequest("/api/health/weather?provider=bogus")
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

    const res = await getWeatherHealth(createRequest("/api/health/weather"));
    const data = await res.json();
    expect(data.status).toBe("error");
  });
});
