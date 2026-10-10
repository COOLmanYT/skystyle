# GET /weather

Returns current weather conditions for the given coordinates. No AI processing is involved — raw weather data only.

**Endpoint:** `GET https://skystyle.app/api/v1/weather`  
**Credit cost:** 1 per request

## Request

### Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer sk_live_YOUR_API_KEY` |

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lat` | `number` | ✅ | Latitude (-90 to 90) |
| `lon` | `number` | ✅ | Longitude (-180 to 180) |
| `unit` | `string` | — | `"metric"` (°C, km/h, default) or `"imperial"` (°F, mph) |

## Response (200)

| Field | Type | Description |
|-------|------|-------------|
| `temp` | `number` | Temperature in the requested unit. |
| `feels_like` | `number` | Apparent (feels-like) temperature. |
| `temp_unit` | `string` | `"°C"` or `"°F"`. |
| `humidity_pct` | `number` | Relative humidity (0–100). |
| `wind_speed` | `number` | Wind speed in the requested unit. |
| `wind_speed_unit` | `string` | `"km/h"` or `"mph"`. |
| `wind_dir` | `string` | Cardinal wind direction, e.g. `"NW"`. |
| `description` | `string` | Human-readable conditions, e.g. `"Partly cloudy"`. |
| `rain_chance_pct` | `number` | Precipitation probability (0–100). |
| `uv_index` | `number` | UV index. |
| `is_day` | `boolean` | Whether it is currently daytime at that location. |
| `alerts` | `string[]` | Active weather alerts (empty array if none). |
| `source` | `string` | Weather data provider identifier. |
| `retrieved_at` | `string` | ISO-8601 UTC timestamp. |

## Examples

### JavaScript (fetch)

```javascript
const response = await fetch(
  "https://skystyle.app/api/v1/weather?lat=35.6762&lon=139.6503&unit=metric",
  {
    headers: { "Authorization": "Bearer sk_live_YOUR_API_KEY" },
  }
);

const data = await response.json();
```

### curl

```bash
curl "https://skystyle.app/api/v1/weather?lat=35.6762&lon=139.6503&unit=metric" \
  -H "Authorization: Bearer sk_live_YOUR_API_KEY"
```

### Sample response

```json
{
  "temp": 22,
  "feels_like": 20,
  "temp_unit": "°C",
  "humidity_pct": 68,
  "wind_speed": 14,
  "wind_speed_unit": "km/h",
  "wind_dir": "SE",
  "description": "Mostly sunny",
  "rain_chance_pct": 5,
  "uv_index": 6,
  "is_day": true,
  "alerts": [],
  "source": "open-meteo",
  "retrieved_at": "2026-04-17T12:00:00.000Z"
}
```

## Unavailable measurements {#unavailable-measurements}

::: info Development candidate
The additive fields below are part of the 6.3 candidate and have not been deployed.
:::

The existing numeric weather fields remain compatible and use zero as their legacy fallback. The additive `measurements` object distinguishes unavailable observations with `null`; new integrations should read it rather than treating a fallback zero as an observed value.

```json
{"humidity_pct":70,"wind_speed_kmh":12,"rain_chance_pct":null,"rain_period":"unknown","uv_index":null}
```

`wind_speed_kmh` is always metric. `rain_period` is `hour`, `three-hours`, `day`, or `unknown`; probabilities for different periods are not averaged together. Missing values do not dilute another provider’s measurement. Provider requests have five-second deadlines and the collection has an eight-second deadline. This describes the development candidate, pending deployment.
