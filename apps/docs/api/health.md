# Health Endpoints

Public, unauthenticated endpoints for monitoring Sky Style service health. **No API key is required** for any `/api/v1/health*` endpoint.

These are intended for uptime monitoring, status pages, and integration health checks. They never expose credentials — only whether a provider is configured and reachable, plus round-trip latency.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Overall service health (database + AI + weather) |
| `GET` | `/api/v1/health/db` | Database connection health |
| `GET` | `/api/v1/health/ai` | AI provider health (optional `?provider=`) |
| `GET` | `/api/v1/health/weather` | Weather provider health (optional `?provider=`) |

All responses include a `Cache-Control: no-store` header so monitors always see fresh data.

---

## GET /health

Runs the database, AI, and weather checks in parallel and returns a consolidated status plus Sky Style's own response time. Each service category reports its own status and response time.

**Endpoint:** `GET https://skystyle.app/api/v1/health`
**Credit cost:** 0 (no API key required)

### Response (200)

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Overall status: `ok` \| `degraded` \| `error` \| `unconfigured` |
| `responseTime` | `number` | Sky Style's own response time for this request (ms) |
| `services` | `object` | Per-category health (see below) |

#### `services.<category>` (`database`, `ai`, `weather`)

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | `ok` \| `degraded` \| `error` \| `unconfigured` |
| `responseTime` | `number\|null` | Category round-trip response time in ms (`null` if not measured) |

### Status semantics

| Status | Meaning |
|--------|---------|
| `ok` | The service is reachable and responding. |
| `degraded` | The service responded but with a non-2xx status (e.g. `HTTP 401`). |
| `error` | The service is unreachable or the request failed (e.g. timeout, network error). |
| `unconfigured` | No API key / credential is set for the provider — it is not in use. |

### Example

```bash
curl "https://skystyle.app/api/v1/health"
```

```json
{
  "status": "degraded",
  "responseTime": 12,
  "services": {
    "database": {
      "status": "ok",
      "responseTime": 42
    },
    "ai": {
      "status": "degraded",
      "responseTime": 18304
    },
    "weather": {
      "status": "ok",
      "responseTime": 216
    }
  }
}
```

::: tip Overall status logic
A provider that is merely `unconfigured` is **not** a failure (it is simply not in use). The overall `status` is `degraded` when any category is `degraded`/`error`, and `error` only when every category has failed.
:::

---

## GET /health/db

Checks the Supabase database connection by selecting a single row from the `users` table.

**Endpoint:** `GET https://skystyle.app/api/v1/health/db`
**Credit cost:** 0 (no API key required)

### Response (200)

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | `ok` \| `degraded` \| `error` \| `unconfigured` |
| `providers` | `ProviderCheck[]` | Single entry for the database (see below) |
| `timestamp` | `string` | ISO-8601 UTC timestamp |
| `responseTimeMs` | `number` | Sky Style's own response time for this request (ms) |

### Example

```bash
curl "https://skystyle.app/api/v1/health/db"
```

```json
{
  "status": "ok",
  "providers": [
    {
      "provider": "supabase",
      "configured": true,
      "status": "ok",
      "latencyMs": 42,
      "detail": "Database reachable"
    }
  ],
  "timestamp": "2026-04-17T12:00:00.000Z",
  "responseTimeMs": 48
}
```

---

## GET /health/ai

Checks the configured AI providers. By default all providers are checked in parallel; pass `?provider=` to check a single one.

**Endpoint:** `GET https://skystyle.app/api/v1/health/ai`
**Credit cost:** 0 (no API key required)

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `provider` | `string` | — | One of: `openai`, `gemini`, `mistral` |

### Response (200)

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | `ok` \| `degraded` \| `error` \| `unconfigured` |
| `providers` | `ProviderCheck[]` | One entry per checked provider (see below) |
| `timestamp` | `string` | ISO-8601 UTC timestamp |
| `responseTimeMs` | `number` | Sky Style's own response time for this request (ms) |

### `ProviderCheck`

| Field | Type | Description |
|-------|------|-------------|
| `provider` | `string` | Provider identifier (e.g. `openai`) |
| `configured` | `boolean` | Whether an API key is configured |
| `status` | `string` | `ok` \| `degraded` \| `error` \| `unconfigured` |
| `latencyMs` | `number\|null` | Provider round-trip latency in ms (`null` if not checked) |
| `detail` | `string` | Human-readable detail |

### Example

```bash
curl "https://skystyle.app/api/v1/health/ai?provider=mistral"
```

```json
{
  "status": "ok",
  "providers": [
    {
      "provider": "mistral",
      "configured": true,
      "status": "ok",
      "latencyMs": 183,
      "detail": "Mistral reachable"
    }
  ],
  "timestamp": "2026-04-17T12:00:00.000Z",
  "responseTimeMs": 190
}
```

### Errors (400)

| Field | Type | Description |
|-------|------|-------------|
| `error` | `string` | `invalid_provider` |
| `message` | `string` | Lists the supported providers |

---

## GET /health/weather

Checks the configured weather providers. By default all providers are checked in parallel; pass `?provider=` to check a single one.

**Endpoint:** `GET https://skystyle.app/api/v1/health/weather`
**Credit cost:** 0 (no API key required)

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `provider` | `string` | — | One of: `openweather`, `weatherapi`, `visualcrossing`, `pirateweather`, `open-meteo`, `bom` |

### Response (200)

Same shape as [`/health/ai`](#get-health-ai), with `provider` values from the list above. Keyless providers (`open-meteo`, `bom`) always report `configured: true`.

### Example

```bash
curl "https://skystyle.app/api/v1/health/weather?provider=openweather"
```

```json
{
  "status": "ok",
  "providers": [
    {
      "provider": "openweather",
      "configured": true,
      "status": "ok",
      "latencyMs": 216,
      "detail": "OpenWeatherMap reachable"
    }
  ],
  "timestamp": "2026-04-17T12:00:00.000Z",
  "responseTimeMs": 220
}
```

### Errors (400)

Same `invalid_provider` shape as [`/health/ai`](#get-health-ai).
