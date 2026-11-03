# How It Works

Understanding what happens behind a single recommendation helps you get more out of Sky Style. This page explains the end-to-end flow, the weather sources, and the AI models.

## The end-to-end flow

When you generate a recommendation, Sky Style runs this sequence:

1. **Resolve your location** — from GPS (if you've consented) or a manual city/coordinate search. City searches are geocoded via OpenStreetMap's Nominatim service (up to 5 matches, cached for 1 hour).
2. **Fetch weather data** — from one or more sources (see below). Results are cached to avoid redundant calls.
3. **Aggregate sources** — when multiple sources return data, Sky Style averages valid, comparable measurements and keeps each source's reading to pass to the AI for richer context.
4. **Build the AI prompt** — combining the weather snapshot, your [closet](./dashboard#closet) items, your [gender context](./settings#profile), your unit preference, and (optionally) your location if you've consented to share it.
5. **Call the AI** — using the selected model (see [AI models](#ai-models)).
6. **Return the recommendation** — outfit text, reasoning, the weather used, and the model that generated it.
7. **Settle usage** — a usable result consumes the relevant [allowance](#usage-limits). In the 6.3 candidate, malformed or empty outfit advice returns a recoverable error without consuming recommendation allowance.

## Weather sources

Sky Style uses several weather data sources. Which ones are used depends on your location and which API keys the deployment has configured.

### Built-in sources

| Source | When it's used | Key required? |
| --- | --- | --- |
| **Bureau of Meteorology (BOM)** | Australia only — when your coordinates fall inside Australia's bounding box. | No (free) |
| **OpenWeatherMap** | Primary source outside Australia (and supplementary inside Australia). | Yes (`OPENWEATHER_API_KEY`) |
| **Open-Meteo** | Always attempted (free, no key). | No |
| **WeatherAPI.com** | Optional supplementary source. | Yes (`WEATHERAPI_KEY`) |
| **Visual Crossing** | Optional supplementary source. | Yes (`VISUALCROSSING_API_KEY`) |
| **Pirate Weather** | Optional supplementary source. | Yes (`PIRATEWEATHER_API_KEY`) |

### Multi-source aggregation

When more than one source returns data, Sky Style:

- **Averages** valid numeric fields such as temperature, humidity and wind. In the 6.3 candidate, missing observations are excluded rather than treated as zero. Rain probabilities with different forecast periods are not averaged together.
- **Keeps** each individual source's reading and passes all of them to the AI as context, so the recommendation accounts for agreement and disagreement between sources.
- Marks the source as `Multi` when multiple sources contributed.

A failed or slow source is dropped; weather can still be returned when another source succeeds. The 6.3 candidate bounds each provider request to five seconds and the collection to eight seconds, and reuses already fetched metadata. Hourly forecast coverage is reported separately from current weather.

### Accuracy score

For BOM data, Sky Style computes the distance to the nearest reporting weather station and assigns an accuracy score:

| Distance to nearest station | Accuracy |
| --- | --- |
| Less than 10 km | High |
| 10–50 km | Medium |
| More than 50 km | Low |

This helps you judge how local the reading is.

### Caching

Weather data is cached in-memory to avoid redundant API calls. Each source has its own cache duration:

| Source | Cache TTL |
| --- | --- |
| OpenWeatherMap | 15 minutes |
| BOM | 30 minutes |
| Open-Meteo | 30 minutes |
| Custom (Pro) | 10 minutes |
| Multi (aggregated) | 15 minutes |

### Hourly forecast

Some sources (Open-Meteo, WeatherAPI.com, Visual Crossing, Pirate Weather) also return an **hourly forecast** — a sequence of upcoming hours with time, temperature, description, rain chance, and wind speed. This powers the Weather Planning panel on the dashboard.

::: tip Source picker
Choose a built-in source when your account permits it; source picks have their own [usage counter](#usage-limits). This is separate from custom sources — see [Custom weather sources](./custom-weather-sources).
:::

## AI models

Hosted recommendations use OpenAI, Google Gemini or Mistral, with model priority depending on your plan. Anthropic is additionally supported for BYOK. The models below describe the configured code paths; a configured model still depends on provider availability.

### Providers

| Provider | Models |
| --- | --- |
| OpenAI | GPT-4o, GPT-4o Mini |
| Google Gemini | Gemini 2.5 Flash, Gemini 2.5 Flash Lite, Gemma 4 31B, Gemma 4 26B |
| Mistral AI | Mistral Large, Mistral Small, Ministral 8B |

Gemma models are served through the Gemini provider — no separate key is required for them.

### Model priority

When multiple server-side keys are configured, Sky Style tries models in this order:

- **Pro users**: OpenAI → Gemini/Gemma → Mistral Large → Mistral Small → Ministral
- **Free users**: Gemini → Mistral Small → Ministral → Gemma

Free users do not get OpenAI models (to control cost). The first available model in your tier's priority list is used. If a provider's key isn't configured server-side, its models are skipped.

### Bring Your Own Key (BYOK)

Pro and Dev users can override the server-side provider by entering their own key for OpenAI, Gemini, Mistral or Anthropic in Style or Shop. Anthropic uses Claude Haiku 4.5 and is BYOK-only; it does not change the hosted tier model list.

- When a BYOK key is set, requests for that provider use your key instead of Sky Style's.
- BYOK keys default to account/provider-scoped session storage and clear on sign-out. Remember-on-device is optional and persists until explicitly cleared. Keys pass through Sky Style to the selected provider and are never saved in its database. Follow-ups keep that provider; incompatible model choices never send the key elsewhere or silently use a hosted key.
- A custom prompt can replace the default Sky Style prompt (must include JSON output instructions).

See [Dashboard → BYOK](./dashboard#bring-your-own-key-pro-dev).

## Usage limits {#usage-limits}

Your Account page is authoritative for your available allowance. The defaults below describe the currently inactive-accounting mode. Daily counters reset at midnight UTC; account restrictions can lower them.

| Counter | Free | Demo preview | Pro | Dev |
| --- | --- | --- | --- | --- |
| Recommendations | 20/day | 200/day | Funded by 50 App Credits/day | Unlimited |
| Follow-ups | 40/day | 400/day | 400/day | Unlimited |
| Owned-clothes-only requests | 4/day | 40/day | Unlimited | Unlimited |
| Built-in source picks | 4/day | 40/day | Unlimited | Unlimited |
| Model switches | 2/day | 20/day | Unlimited | Unlimited |

Style, Shop and automatic recommendations share recommendation usage. Model cost affects how many Pro recommendations its daily App Credits cover. BYOK does not bypass limits. Closet editing, saved-outfit reuse and manual swaps use no AI allowance. An AI slot swap uses a follow-up allowance after a usable replacement is returned.

The Demo tier is available only in preview/development environments. Its closet is temporary; it does not create cloud wardrobe, saved-outfit or inbox records.

The code also supports monthly accounting, which remains disabled pending separate acceptance. When enabled, plan display reads the active flag rather than advertising planned allowances. Checkout and credit purchases remain unavailable. See [Account & Support](./account-and-support#plans) and the [development architecture](../development/architecture#accounting-and-release-status).
