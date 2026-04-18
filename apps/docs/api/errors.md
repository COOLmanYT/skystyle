# Errors & Credits

## Error responses

All error responses return JSON with a single `error` field:

```json
{ "error": "Description of what went wrong." }
```

### HTTP status codes

| Status | When it occurs |
|--------|----------------|
| `400 Bad Request` | Missing or invalid request parameters (e.g. `lat` out of range, invalid `unit`). |
| `401 Unauthorized` | API key missing or the `Authorization` header is malformed. |
| `403 Forbidden` | Key has been revoked **or** the key has run out of credits (`"insufficient_credits"`). |
| `429 Too Many Requests` | Rate limit exceeded — too many requests per minute. Back off and retry. |
| `500 Internal Server Error` | Unexpected server-side error. |
| `502 Bad Gateway` | The upstream weather provider or AI backend is unavailable. Retry after a short delay. |

### Example: rate limited

```json
{
  "error": "rate_limited",
  "message": "Too many requests. Please slow down."
}
```

When rate limited (`429`), the response also includes:

```
Retry-After: 60
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
```

### Example: invalid coordinates

```json
{
  "error": "lat must be a number between -90 and 90, and lon between -180 and 180."
}
```

### Example: out of credits

```json
{
  "error": "insufficient_credits"
}
```

::: tip Retrying 502 errors
502 errors are transient. Wait 2–5 seconds and retry. If they persist, check the Sky Style status page.
:::

---

## Response headers

Every v1 API response includes the following standard headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed per minute. |
| `X-RateLimit-Remaining` | Requests remaining in the current 60-second window. |
| `Retry-After` | Seconds to wait before retrying (only present on `429` responses). |
| `Cache-Control` | Always `no-store` — API responses must not be cached. |
| `Access-Control-Allow-Origin` | `*` — the API supports cross-origin requests from any origin. |

---

## Credits

Each API key starts with **100 credits**. Credits are deducted after each successful request. You can view your current balance in the [API Dashboard](https://skystyle.app/dashboard/api).

### Credit costs

| Endpoint | Method | Credits |
|----------|--------|---------|
| `/recommend` | `POST` | 2 |
| `/recweather` | `POST` | 3 |
| `/weather` | `GET` | 1 |
| `/closet` | `GET` | 1 |

### Charging rules

| Outcome | Credits charged |
|---------|-----------------|
| Success (2xx) | Full cost |
| Partial success (weather ✅, AI ❌) | Half cost (rounded up) |
| Failure (5xx) | 0 |
| Auth / validation error (4xx) | 0 |
