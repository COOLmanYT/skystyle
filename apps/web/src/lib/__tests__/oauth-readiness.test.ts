import { getOptionalOAuthConfiguration, getOptionalOAuthReadiness } from "../oauth-readiness";
const secret = (exp: number) => `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
describe("Optional sign-in configuration", () => {
  it("keeps absent and partially configured providers disabled", () => {
    expect(getOptionalOAuthConfiguration({})).toEqual({ microsoft: false, apple: false });
    expect(getOptionalOAuthConfiguration({ AUTH_MICROSOFT_ENTRA_ID_ID: "id", AUTH_APPLE_ID: "id" })).toEqual({ microsoft: false, apple: false });
  });
  it("enables Microsoft with a complete server configuration", () => {
    expect(getOptionalOAuthConfiguration({ AUTH_MICROSOFT_ENTRA_ID_ID: "id", AUTH_MICROSOFT_ENTRA_ID_SECRET: "secret" }).microsoft).toBe(true);
  });
  it("requires HTTPS and an unexpired Apple secret", () => {
    const env = { AUTH_APPLE_ID: "service", AUTH_APPLE_SECRET: secret(Date.now() / 1000 + 3600), AUTH_URL: "https://skystyle.app" };
    expect(getOptionalOAuthConfiguration(env).apple).toBe(true);
    expect(getOptionalOAuthConfiguration({ ...env, AUTH_URL: "http://localhost:3000" }).apple).toBe(false);
    expect(getOptionalOAuthConfiguration({ ...env, AUTH_APPLE_SECRET: secret(1) }).apple).toBe(false);
    expect(getOptionalOAuthConfiguration({ ...env, AUTH_APPLE_SECRET: "malformed" }).apple).toBe(false);
  });
  it("requires explicit Apple preview configuration", () => {
    const env = { AUTH_APPLE_ID: "service", AUTH_APPLE_SECRET: secret(Date.now() / 1000 + 3600), AUTH_URL: "https://preview.example.com", VERCEL_ENV: "preview" };
    expect(getOptionalOAuthConfiguration(env).apple).toBe(false);
    expect(getOptionalOAuthConfiguration({ ...env, AUTH_APPLE_ALLOW_PREVIEW: "true" }).apple).toBe(true);
  });
});

it("keeps prepared providers unavailable even with complete credentials", () => {
  expect(getOptionalOAuthReadiness({ AUTH_MICROSOFT_ENTRA_ID_ID: "id", AUTH_MICROSOFT_ENTRA_ID_SECRET: "secret", AUTH_APPLE_ID: "service", AUTH_APPLE_SECRET: secret(Date.now() / 1000 + 3600), AUTH_URL: "https://skystyle.app" })).toEqual({ microsoft: false, apple: false });
});
