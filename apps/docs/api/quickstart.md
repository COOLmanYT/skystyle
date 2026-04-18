# Quickstart

Get up and running with the Sky Style API in under 5 minutes.

## Step 1 — Get an API key

1. Log in to [skystyle.app](https://skystyle.app)
2. Navigate to **Dashboard → API**
3. Click **Create new key**
4. Copy your key — it starts with `sk_live_` and is shown **only once**

---

## Step 2 — Fetch weather data

The simplest request is raw weather for a set of coordinates.

### JavaScript (fetch)

```javascript
const response = await fetch(
  "https://skystyle.app/api/v1/weather?lat=51.5074&lon=-0.1278",
  { headers: { "Authorization": "Bearer sk_live_YOUR_KEY_HERE" } }
);

if (!response.ok) {
  const { error } = await response.json();
  console.error("Error:", error);
} else {
  const weather = await response.json();
  console.log(`It's ${weather.temp}${weather.temp_unit} in London`);
  // → "It's 14°C in London"
}
```

### curl

```bash
curl "https://skystyle.app/api/v1/weather?lat=51.5074&lon=-0.1278" \
  -H "Authorization: Bearer sk_live_YOUR_KEY_HERE"
```

---

## Step 3 — Get an outfit recommendation

```javascript
const response = await fetch("https://skystyle.app/api/v1/recommend", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_YOUR_KEY_HERE",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    lat: 51.5074,
    lon: -0.1278,
    unit: "metric",
  }),
});

const data = await response.json();
console.log(data.outfit);
// → "A light trench coat over a button-up shirt with chinos is perfect for today…"
console.log(data.model);
// → "gemini-2.5-flash"
```

---

## Step 4 — Handle errors and rate limits

All error responses include an `error` field. Every response includes rate limit headers.

```javascript
const response = await fetch("https://skystyle.app/api/v1/recommend", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_YOUR_KEY_HERE",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ lat: 51.5074, lon: -0.1278 }),
});

// Rate limit info is on every response
console.log(response.headers.get("X-RateLimit-Limit"));     // "60"
console.log(response.headers.get("X-RateLimit-Remaining")); // "58"

if (response.status === 429) {
  const retryAfter = response.headers.get("Retry-After") ?? "60";
  console.log(`Rate limited. Retry in ${retryAfter}s.`);
} else if (!response.ok) {
  const { error } = await response.json();
  console.error("API error:", error);
} else {
  const data = await response.json();
  console.log(data.outfit);
}
```

---

## CORS support

The API supports cross-origin requests from any origin. You can call it directly from a browser without a proxy:

```html
<script>
fetch("https://skystyle.app/api/v1/weather?lat=40.7128&lon=-74.0060", {
  headers: { "Authorization": "Bearer sk_live_YOUR_KEY_HERE" }
})
.then(r => r.json())
.then(data => console.log(data));
</script>
```

---

## Rate limit headers

Every response includes the following headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests per minute (default: 60) |
| `X-RateLimit-Remaining` | Requests remaining in the current 60-second window |
| `Retry-After` | Seconds to wait before retrying (only on `429` responses) |

---

## Complete example app

A minimal Node.js script that recommends an outfit based on the user's location:

```javascript
// outfit-for-today.mjs
const API_KEY = process.env.SKY_STYLE_API_KEY;
const BASE = "https://skystyle.app/api/v1";

async function getOutfit(lat, lon) {
  const response = await fetch(`${BASE}/recweather`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lat, lon, unit: "metric" }),
  });

  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(`API error: ${error}`);
  }

  const { outfit, reasoning, weather } = await response.json();
  return { outfit, reasoning, weather };
}

// New York City
const result = await getOutfit(40.7128, -74.0060);
console.log("🌤️ Weather:", result.weather.description, result.weather.temp + result.weather.temp_unit);
console.log("👕 Outfit:", result.outfit);
console.log("💡 Reasoning:", result.reasoning);
```

Run with:

```bash
SKY_STYLE_API_KEY=sk_live_YOUR_KEY_HERE node outfit-for-today.mjs
```

---

## Next steps

- [Authentication guide](./authentication) — key security best practices
- [POST /recommend](./recommend) — full outfit recommendation reference
- [POST /recweather](./recweather) — recommendation + weather in one call
- [GET /weather](./weather) — raw weather data
- [GET /closet](./closet) — user's saved wardrobe
- [Errors & Credits](./errors) — error codes and credit management
