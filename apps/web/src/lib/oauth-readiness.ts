/** Server-only configuration checks; no credentials are returned to the browser. */
// Prepared providers stay disabled until a future, explicit release enables them.
export const OPTIONAL_OAUTH_ENABLED = false;
export function getOptionalOAuthConfiguration(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const microsoft = Boolean(env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() && env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim());
  let appleSecretValid = false;
  try {
    const payload = JSON.parse(Buffer.from((env.AUTH_APPLE_SECRET ?? "").split(".")[1], "base64url").toString());
    appleSecretValid = typeof payload.exp === "number" && payload.exp > Date.now() / 1000;
  } catch { /* Missing, malformed, or expired configuration stays disabled. */ }
  const apple = Boolean(env.AUTH_APPLE_ID?.trim() && appleSecretValid
    && (env.VERCEL_ENV !== "preview" || env.AUTH_APPLE_ALLOW_PREVIEW === "true")
    && (env.AUTH_URL?.startsWith("https://") || env.VERCEL_URL));
  return { microsoft, apple };
}

export function getOptionalOAuthReadiness(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const configured = getOptionalOAuthConfiguration(env);
  return { microsoft: OPTIONAL_OAUTH_ENABLED && configured.microsoft, apple: OPTIONAL_OAUTH_ENABLED && configured.apple };
}
