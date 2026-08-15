# API Overview

Sky Style exposes a versioned REST API for external developers. All endpoints are under the `v1` base path.

## Base URL

```
https://skystyle.app/api/v1
```

## Available Endpoints

| Method | Path | Description | Auth | Credits |
|--------|------|-------------|------|---------|
| `POST` | [`/recommend`](./recommend) | AI outfit recommendation | API key | 2 |
| `POST` | [`/recweather`](./recweather) | Recommendation + full weather in one call | API key | 3 |
| `GET`  | [`/weather`](./weather) | Raw weather data for coordinates | API key | 1 |
| `GET`  | [`/closet`](./closet) | Your saved closet items | API key | 1 |
| `GET`  | [`/health`](./health) | Overall service health | None | 0 |
| `GET`  | [`/health/ai`](./health) | AI provider health | None | 0 |
| `GET`  | [`/health/weather`](./health) | Weather provider health | None | 0 |
| `GET`  | [`/health/db`](./health) | Database connection health | None | 0 |

::: tip Public health endpoints
The `/api/v1/health*` endpoints are **public** — no API key is required. They are intended for uptime monitoring and status checks. See the [Health reference](./health) for response shapes and the `?provider=` query parameter.
:::

## Authentication

All non-health requests require an API key as a Bearer token. See the [Authentication guide](./authentication) for setup instructions.

```http
Authorization: Bearer sk_live_YOUR_API_KEY
```

## Response format

All responses are `application/json`. Error responses always include a top-level `error` field:

```json
{ "error": "lat must be a number between -90 and 90, and lon between -180 and 180." }
```

See the full [Error Reference](./errors) for status codes.
