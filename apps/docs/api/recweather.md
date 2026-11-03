# POST /recweather

Combined endpoint — returns an AI outfit recommendation **and** the full weather snapshot used to generate it in a single round-trip. Use this when you need both pieces of data together to avoid two separate calls.

**Endpoint:** `POST https://skystyle.app/api/v1/recweather`  
**Credit cost:** 3 per request

## Request

### Headers

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer sk_live_YOUR_API_KEY` |
| `Content-Type` | `application/json` |

### Body parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `lat` | `number` | ✅ | Latitude (-90 to 90) |
| `lon` | `number` | ✅ | Longitude (-180 to 180) |
| `unit` | `string` | — | `"metric"` (default) or `"imperial"` |
| `gender` | `string` | — | Gender context. Max 30 characters. |

## Response (200)

| Field | Type | Description |
|-------|------|-------------|
| `outfit` | `string` | Outfit advice as Markdown; may include [clothing references](./clothing-references). |
| `reasoning` | `string` | Markdown explanation of the recommendation. |
| `weather` | `object` | Full weather snapshot — all [/weather](./weather) fields plus `source`. |
| `model` | `string` | AI model used. |
| `generated_at` | `string` | ISO-8601 UTC timestamp. |

## Examples

### JavaScript (fetch)

```javascript
const response = await fetch("https://skystyle.app/api/v1/recweather", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ lat: 48.8566, lon: 2.3522 }),
});

const data = await response.json();
```

### curl

```bash
curl -X POST "https://skystyle.app/api/v1/recweather" \
  -H "Authorization: Bearer sk_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"lat": 48.8566, "lon": 2.3522}'
```

### Sample response

```json
{
  "outfit": "A trench coat over a light knit sweater and slim trousers is ideal for Paris today.",
  "reasoning": "With 14°C and 72% humidity, a water-resistant outer layer will keep you comfortable in the overcast conditions.",
  "weather": {
    "temp": 14,
    "feels_like": 11,
    "temp_unit": "°C",
    "humidity_pct": 72,
    "wind_speed": 18,
    "wind_speed_unit": "km/h",
    "wind_dir": "W",
    "description": "Overcast",
    "rain_chance_pct": 40,
    "uv_index": 2,
    "is_day": true,
    "alerts": [],
    "source": "open-meteo"
  },
  "model": "gemini-2.5-flash",
  "generated_at": "2026-04-17T12:00:00.000Z"
}
```

## When to use /recweather vs /recommend

| | `/recommend` | `/recweather` |
|---|---|---|
| Returns outfit | ✅ | ✅ |
| Returns full weather | Limited fields only | ✅ Full snapshot |
| Credit cost | 2 | 3 |

Use `/recommend` when you only need the outfit text. Use `/recweather` when you also need to display weather data to your users.

## Development response additions

The 6.3 candidate retains legacy weather fields and adds nullable [`measurements`](./weather#unavailable-measurements) to distinguish missing observations from real zeroes. Outfit and reasoning text can contain [clothing references](./clothing-references). These additions describe the development candidate, pending deployment.
