# How It Works

Understanding what happens behind a single recommendation helps you get more out of Sky Style. This page explains the end-to-end flow, the weather sources, and the AI models.

## The end-to-end flow

When you generate a recommendation, Sky Style runs this sequence:

1. **Resolve your location** — from GPS (if you've consented) or a manual city/coordinate search. City searches are geocoded via OpenStreetMap's Nominatim service (up to 5 matches, cached for 1 hour).
2. **Fetch weather data** — from one or more sources (see below). Results are cached to avoid redundant calls.
3. **Aggregate sources** — when multiple sources return data, Sky Style averages the numeric fields and keeps each source's reading to pass to the AI for richer context.
4. **Build the AI prompt** — combining the weather snapshot, your [closet](./dashboard#closet) items, your [gender context](./settings#profile), your unit preference, and (optionally) your location if you've consented to share it.
5. **Call the AI** — using the selected model (see [AI models](#ai-models)).
6. **Return the recommendation** — outfit text, reasoning, the weather used, and the model that generated it.
7. **Track usage** — your daily [usage counters](#usage-limits) increment.

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

- **Averages** the numeric fields (temperature, humidity, wind speed, etc.) for the displayed weather.
- **Keeps** each individual source's reading and passes all of them to the AI as context, so the recommendation accounts for agreement and disagreement between sources.
- Marks the source as `Multi` when multiple sources contributed.

A source that fails to return data is silently dropped — the recommendation still works as long as at least one source succeeds.

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
Pro users can choose which source to use for a given recommendation via the **source picker** (4/day on Free, unlimited on Pro). This is separate from custom sources — see [Custom weather sources](./custom-weather-sources).
:::

## AI models

Sky Style supports three AI providers, with model priority depending on your plan.

### Providers

| Provider | Models |
| --- | --- |
| OpenAI | GPT-4o, GPT-4o Mini |
| Google Gemini | Gemini 2.5 Flash, Gemini 2.5 Flash Lite, Gemma 4 31B, Gemma 4 26B |
| Mistral AI | Mistral Large, Mistral Small, Ministral 8B |

Gemma models are served through the Gemini provider — no separate key is required for them.

### Model priority

When multiple server-side keys are configured, Sky Style tries models in this order:

- **Pro users**: OpenAI → Gemini → Gemma → Mistral Large → Mistral Small → Ministral
- **Free users**: Gemini → Mistral Small → Gemma → Ministral

Free users do not get OpenAI models (to control cost). The first available model in your tier's priority list is used. If a provider's key isn't configured server-side, its models are skipped.

### Bring Your Own Key (BYOK)

Pro and Dev users can override the server-side provider by entering their own key for OpenAI, Gemini, or Mistral in the dashboard's BYOK panel:

- When a BYOK key is set, requests for that provider use your key instead of Sky Style's.
- BYOK keys are stored **only in your browser** and are sent solely for the AI request.
- A custom prompt can replace the default Sky Style prompt (must include JSON output instructions).

See [Dashboard → BYOK](./dashboard#bring-your-own-key-pro-dev).

## Usage limits {#usage-limits}

Each plan has daily counters that reset at midnight UTC:

| Feature | Free | Demo | Pro | Dev |
| --- | --- | --- | --- | --- |
| AI uses | 20/day | 200/day | Unlimited | Unlimited |
| Follow-ups | 40/day | 400/day | 400/day | Unlimited |
| Closet uses | 4/day | 40/day | Unlimited | Unlimited |
| Source picks | 4/day | 40/day | Unlimited | Unlimited |
| Model switches | 2/day | 20/day | Unlimited | Unlimited |

::: warning Model switches are separate
**Model switches** (changing which AI model is used) are a separate daily counter from **AI uses**. On the Free plan you can switch models 2 times per day, independent of your 20 AI uses. Pro and Dev have unlimited switches.
:::

The **Demo** tier is only created automatically when the deployment is a preview/development environment; it multiplies the free limits by 10 for testing.
