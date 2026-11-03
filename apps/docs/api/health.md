# Health checks

Health endpoints provide read-only connectivity diagnostics. They require no API key, return no account data and do not consume API credits.

| Endpoint | Checks |
| --- | --- |
| `GET /api/v1/health` | Combined database, hosted AI and weather status |
| `GET /api/v1/health/db` | Database reachability without returning records |
| `GET /api/v1/health/ai` | Hosted AI model-list connectivity, without generating text |
| `GET /api/v1/health/weather` | Open-Meteo connectivity |

## Request

```bash
curl https://skystyle.app/api/v1/health
```

The AI endpoint optionally accepts `?provider=openai`, `?provider=gemini` or `?provider=mistral`. Weather accepts `?provider=open-meteo`. An unsupported filter returns HTTP 400.

## Reading the response

The combined response includes:

| Field | Meaning |
| --- | --- |
| `status` | `ok`, `degraded` or `unconfigured` |
| `healthy` | True only when all required categories are healthy |
| `responseTime` | Time to serve the diagnostic, in milliseconds |
| `checkedAt` | Oldest category measurement time |
| `cached` | Whether all category measurements came from the probe cache |
| `services` | Per-category status, measurement time, response time and cache state |

HTTP 200 means the diagnostic was returned successfully. Monitor the JSON `status` or `healthy` field to decide whether services are reachable. One unavailable category gives `degraded`; all categories missing configuration gives `unconfigured`.

## Cache and scope

Provider checks have a four-second timeout. Measurements and CDN responses may be cached for up to five minutes. `checkedAt` is the measurement time, not necessarily the time you sent the request.

AI probes list models rather than generate recommendations. Weather probes check Open-Meteo and do not verify paid weather providers. Results do not establish BYOK availability, data accuracy or an uptime guarantee. Credentials and raw provider errors are excluded.
