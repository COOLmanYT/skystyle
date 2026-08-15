# Custom Weather Sources (Pro)

Pro users can add their own weather data sources so recommendations draw from data you trust or control — for example a private weather station feed or a paid provider not built into Sky Style.

This is separate from the [source picker](./how-it-works#source-picker), which lets you choose among the built-in sources.

## How custom sources work

1. You add one or more source **URLs** that return weather data as JSON.
2. Sky Style fetches each URL alongside (or instead of) the built-in sources.
3. When multiple custom sources return data, the numeric fields are averaged and all readings are passed to the AI as context (see [Multi-source aggregation](./how-it-works#multi-source-aggregation)).
4. Custom source readings are marked with an accuracy of `Medium` (unverified accuracy).

You can choose a **source mode**:

- **Built-in** — use only Sky Style's built-in sources (custom sources ignored).
- **Custom** — use only your custom sources. If none return data, Sky Style falls back to built-in sources automatically.
- **Both** — combine built-in and custom sources for maximum coverage.

## URL requirements

Custom source URLs must satisfy these rules, enforced to prevent [SSRF](https://owasp.org/www-community/attacks/Server_Side_Request_Forgery) attacks:

| Rule | Detail |
| --- | --- |
| **HTTPS only** | The URL must use the `https://` scheme. |
| **Default port** | The URL must use the default HTTPS port (443). Explicit non-default ports are rejected. |
| **No credentials** | The URL must not contain a username or password (`https://user:pass@host` is rejected). |
| **Public host** | The hostname must resolve to a public address. Private, internal, link-local, and metadata endpoints are blocked (see below). |

### Blocked host types

The following are rejected to protect the server:

- `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`
- Private IPv4 ranges: `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`
- Link-local IPv4: `169.254.0.0/16` (this includes the cloud metadata endpoint `169.254.169.254`)
- IPv6 private and link-local ranges
- Hostnames ending in `.local`, `.internal`, or `.localhost`
- Multicast addresses

::: warning DNS resolution
The hostname is resolved and checked at request time. A hostname that resolves to a private or internal IP will be rejected, even if it looks public.
:::

## Expected data shape

Your custom source should return JSON that Sky Style can map to its weather data structure. A best-effort parse is applied — the most important fields are:

| Field | Type | Notes |
| --- | --- | --- |
| `temp` | number | Temperature (Celsius). |
| `feelsLike` | number | Apparent temperature. |
| `humidity` | number | Relative humidity (0–100). |
| `windSpeed` | number | Wind speed (km/h). |
| `windDir` | string | Cardinal wind direction. |
| `description` | string | Human-readable conditions. |
| `rainChance` | number | Precipitation probability (0–100). |
| `uvIndex` | number | UV index. |

Sources that return an `hourly` array (each entry with `time`, `temp`, `description`, `rainChance`, `windSpeed`) also feed the Weather Planning panel.

## Caching

Custom source data is cached for **10 minutes** per location to avoid excessive calls to your endpoint.

## Provider key passthrough

Some built-in providers can also be used as custom sources by passing your own API key:

| Custom source type | Uses your key for |
| --- | --- |
| WeatherAPI.com | The `weatherapi.com` endpoint |
| Visual Crossing | The Visual Crossing endpoint |
| Pirate Weather | The Pirate Weather endpoint |
| OpenWeatherMap | The OpenWeather endpoint |

This lets you supply a key Sky Style's deployment doesn't have configured, while reusing the built-in parsing logic.
