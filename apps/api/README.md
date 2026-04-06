# Sky Style API (Placeholder)

This folder reserves the structure for a future standalone API service at `api.skystyle.app`.

## Current status

- Placeholder only
- Not deployed
- Not wired into production traffic

## Planned responsibilities

- Provide stable public API endpoints for web and third-party clients
- Host rate-limited service endpoints
- Centralize API-only auth and service boundaries

## Example endpoint contract

The sample health endpoint is implemented at `src/routes/health.ts`.

Expected response:

```json
{
  "ok": true,
  "service": "skystyle-api",
  "environment": "development",
  "timestamp": "2026-04-06T00:00:00.000Z"
}
```
