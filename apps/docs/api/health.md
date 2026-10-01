# Public health endpoints

`GET /api/v1/health` returns aggregate read-only connectivity status, response time, and the database/AI/weather categories. No API key is required. Category endpoints:

| Endpoint | Probe scope |
| --- | --- |
| `/api/v1/health/db` | A bounded read-only database request; no row data returned |
| `/api/v1/health/ai?provider=openai` | Hosted model-list reachability for OpenAI, Gemini or Mistral; no generation tokens or user BYOK keys |
| `/api/v1/health/weather?provider=open-meteo` | Open-Meteo reachability only; no paid weather-source probes |

Provider requests have a four-second timeout. Per-category results are cached for five minutes, concurrent refreshes share one request in each server process, and CDN responses may be cached for five minutes. `checkedAt` describes the cached measurement, not the request time. Status is `ok`, `degraded`, or `unconfigured`; connectivity is not a guarantee of generation, data accuracy or BYOK availability. Unsupported provider filters return 400. Raw errors, credentials and database records are never included.

This follows the intent of [PR #56](https://github.com/COOLmanYT/skystyle/pull/56) without merging it or copying its unrestricted paid weather probes.

## Authenticated Shop endpoint

`POST /api/shop` requires the normal authenticated web-app session. It is not an API-key endpoint and is not a new public entitlement.

```json
{
  "query": "linen shirt for a lunch",
  "region": "AU",
  "size": "M relaxed fit",
  "recommendationContext": {
    "occasion": { "kind": "everyday" },
    "budget": { "minAmount": 30, "maxAmount": 100, "currency": "AUD" }
  }
}
```

Optional `modelId` must be available to the account. Pro/Dev may supply `userApiKey`, `byokProvider` and `clientCustomPrompt`. The request limit is 16,000 characters. Product fields are grounded in the source, not AI output; see [Shop](../web-app/shop).

Responses include `status` (`ok`, `empty`, `unconfigured`), `products`, `model`, source timing, and a clear message. No AI call/charge occurs for empty or unconfigured sourcing. Errors use 400 for invalid inputs, 401 for no session, 403 for disabled/unavailable access, 402 for insufficient credits, 429 for usage/concurrent requests, and 502/503 for generation/source failures. Existing account allowances remain unchanged.
