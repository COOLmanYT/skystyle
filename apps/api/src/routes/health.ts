export type HealthResponse = {
  ok: boolean;
  service: "skystyle-api";
  environment: string;
  timestamp: string;
};

// Example route handler shape for a future API framework (Express/Fastify/Hono).
export function getHealth(): HealthResponse {
  return {
    ok: true,
    service: "skystyle-api",
    environment: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
  };
}
