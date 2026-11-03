# POST /recommend

Returns an AI-generated outfit recommendation based on current weather at the given coordinates.

**Endpoint:** `POST https://skystyle.app/api/v1/recommend`  
**Credit cost:** 2 per request

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
| `unit` | `string` | — | `"metric"` (°C, km/h, default) or `"imperial"` (°F, mph) |
| `gender` | `string` | — | Gender context for the recommendation, e.g. `"Male"`. Max 30 characters. |

## Response (200)

| Field | Type | Description |
|-------|------|-------------|
| `outfit` | `string` | Outfit advice as Markdown; may include [clothing references](./clothing-references). |
| `reasoning` | `string` | Markdown explanation linking weather conditions to clothing choices. |
| `weather` | `object` | Key weather conditions used (see [/weather](./weather) for field definitions). |
| `model` | `string` | AI model that generated the recommendation. |
| `generated_at` | `string` | ISO-8601 UTC timestamp. |

## Examples

### JavaScript (fetch)

```javascript
const response = await fetch("https://skystyle.app/api/v1/recommend", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    lat: 40.7128,
    lon: -74.0060,
    unit: "imperial",
    gender: "Male",
  }),
});

const data = await response.json();
```

### curl

```bash
curl -X POST "https://skystyle.app/api/v1/recommend" \
  -H "Authorization: Bearer sk_live_YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 40.7128,
    "lon": -74.0060,
    "unit": "imperial",
    "gender": "Male"
  }'
```

### Sample response

```json
{
  "outfit": "Wear a light denim jacket over a white t-shirt, paired with dark chinos and white sneakers.",
  "reasoning": "At 64°F with a light breeze, you'll want a layer for the morning chill that you can remove by midday.",
  "weather": {
    "temp": 64,
    "feels_like": 61,
    "temp_unit": "°F",
    "humidity_pct": 55,
    "wind_speed": 9,
    "wind_speed_unit": "mph",
    "wind_dir": "SW",
    "description": "Partly cloudy",
    "rain_chance_pct": 10,
    "uv_index": 4,
    "is_day": true,
    "alerts": []
  },
  "model": "gemini-2.5-flash",
  "generated_at": "2026-04-17T12:00:00.000Z"
}
```

## Development response additions

The 6.3 candidate retains legacy weather fields and adds nullable [`measurements`](./weather#unavailable-measurements) to distinguish missing observations from real zeroes. Outfit and reasoning text can contain [clothing references](./clothing-references). These additions describe the development candidate, pending deployment.
