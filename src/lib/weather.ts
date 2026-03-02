/**
 * Weather data layer.
 *
 * BOM Switch: If the user's coordinates fall inside Australia's bounding box,
 * fetch data from Bureau of Meteorology (BOM) for free.
 * Otherwise fall back to OpenWeatherMap.
 *
 * Accuracy Score: Compute distance to the nearest reporting station and
 * classify as High (<10 km), Medium (10-50 km), or Low (>50 km).
 */

export interface HourlyForecast {
  time: string;          // ISO string
  temp: number;          // Celsius
  description: string;
  rainChance: number;    // 0-100
  windSpeed: number;     // km/h
}

export interface SourceWeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDir: string;
  description: string;
  rainChance: number;
  uvIndex: number;
  source: string;
  hourly?: HourlyForecast[];
}

export interface WeatherData {
  temp: number;          // Celsius
  feelsLike: number;     // Celsius
  humidity: number;      // %
  windSpeed: number;     // km/h
  windDir: string;
  description: string;
  rainChance: number;    // 0-100
  uvIndex: number;
  isDay: boolean;
  alerts: string[];
  stationName: string;
  stationDistanceKm: number;
  accuracyScore: "High" | "Medium" | "Low";
  source: "BOM" | "OpenWeather" | "Custom" | "Multi";
  hourly?: HourlyForecast[];
  /** Individual source data (sent to AI for better context) */
  sources?: SourceWeatherData[];
}

/** Australia's approximate bounding box */
const AUS_BOUNDS = {
  minLat: -43.74,
  maxLat: -10.69,
  minLon: 113.15,
  maxLon: 153.64,
};

export function isAustralia(lat: number, lon: number): boolean {
  return (
    lat >= AUS_BOUNDS.minLat &&
    lat <= AUS_BOUNDS.maxLat &&
    lon >= AUS_BOUNDS.minLon &&
    lon <= AUS_BOUNDS.maxLon
  );
}

/** Haversine formula: distance in km between two lat/lon points */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function accuracyFromDistance(km: number): "High" | "Medium" | "Low" {
  if (km < 10) return "High";
  if (km < 50) return "Medium";
  return "Low";
}

// ---------------------------------------------------------------------------
// BOM (Bureau of Meteorology) – Australia only
// ---------------------------------------------------------------------------

interface BomObservation {
  air_temp: number | null;
  apparent_t: number | null;
  rel_hum: number | null;
  wind_spd_kmh: number | null;
  wind_dir: string | null;
  weather: string | null;
  lat: number;
  lon: number;
  name: string;
}

interface BomResponse {
  observations: {
    data: BomObservation[];
    header: { refresh_message?: string }[];
  };
}

/**
 * BOM nearest-station IDs for major Australian cities.
 * In production this would be dynamic (call BOM's station finder).
 * These cover the major population centres.
 */
const BOM_STATIONS: Array<{
  id: string;
  lat: number;
  lon: number;
  name: string;
}> = [
  { id: "IDN60901", lat: -33.86, lon: 151.21, name: "Sydney (Observatory Hill)" },
  { id: "IDV60901", lat: -37.81, lon: 144.97, name: "Melbourne (Olympic Park)" },
  { id: "IDQ60901", lat: -27.47, lon: 153.03, name: "Brisbane" },
  { id: "IDS60901", lat: -34.93, lon: 138.58, name: "Adelaide (Kent Town)" },
  { id: "IDW60901", lat: -31.93, lon: 115.98, name: "Perth (Subiaco)" },
  { id: "IDT60901", lat: -42.88, lon: 147.33, name: "Hobart" },
  { id: "IDD60901", lat: -12.42, lon: 130.89, name: "Darwin" },
  { id: "IDN60944", lat: -35.31, lon: 149.2,  name: "Canberra Airport" },
];

function nearestBomStation(lat: number, lon: number) {
  let best = BOM_STATIONS[0];
  let bestDist = haversineKm(lat, lon, best.lat, best.lon);
  for (const s of BOM_STATIONS.slice(1)) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return { station: best, distanceKm: bestDist };
}

async function fetchBom(lat: number, lon: number): Promise<WeatherData> {
  const { station, distanceKm } = nearestBomStation(lat, lon);
  const url = `http://www.bom.gov.au/fwo/${station.id}/${station.id}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SkyStyle/1.0 (weather-stylist app)" },
    next: { revalidate: 600 }, // cache 10 min
  });
  if (!res.ok) throw new Error(`BOM fetch failed: ${res.status}`);
  const json: BomResponse = await res.json();
  const obs = json.observations.data[0];

  return {
    temp: obs.air_temp ?? 0,
    feelsLike: obs.apparent_t ?? obs.air_temp ?? 0,
    humidity: obs.rel_hum ?? 0,
    windSpeed: obs.wind_spd_kmh ?? 0,
    windDir: obs.wind_dir ?? "N",
    description: obs.weather ?? "Clear",
    rainChance: 0, // BOM current obs doesn't include forecast rain%
    uvIndex: 0,    // Not in current obs; would need separate BOM forecast call
    isDay: isDaytime(lon),
    alerts: [],
    stationName: station.name,
    stationDistanceKm: Math.round(distanceKm),
    accuracyScore: accuracyFromDistance(distanceKm),
    source: "BOM",
  };
}

// ---------------------------------------------------------------------------
// OpenWeatherMap
// ---------------------------------------------------------------------------

async function fetchOpenWeather(lat: number, lon: number, apiKey?: string): Promise<WeatherData> {
  const key = apiKey ?? process.env.OPENWEATHER_API_KEY;
  if (!key) throw new Error("OPENWEATHER_API_KEY is not set");

  const [currentRes, forecastRes] = await Promise.all([
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric`,
      { next: { revalidate: 600 } }
    ),
    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&cnt=1&appid=${key}&units=metric`,
      { next: { revalidate: 600 } }
    ),
  ]);

  if (!currentRes.ok)
    throw new Error(`OpenWeather current fetch failed: ${currentRes.status}`);
  if (!forecastRes.ok)
    throw new Error(`OpenWeather forecast fetch failed: ${forecastRes.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const current: any = await currentRes.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forecast: any = await forecastRes.json();

  const stationLat: number = current.coord?.lat ?? lat;
  const stationLon: number = current.coord?.lon ?? lon;
  const distanceKm = haversineKm(lat, lon, stationLat, stationLon);

  const rainChance =
    (forecast.list?.[0]?.pop ?? 0) * 100;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alerts: string[] = (current.alerts ?? []).map((a: any) => a.description as string);

  return {
    temp: Math.round(current.main.temp),
    feelsLike: Math.round(current.main.feels_like),
    humidity: current.main.humidity,
    windSpeed: Math.round((current.wind?.speed ?? 0) * 3.6), // m/s → km/h
    windDir: degreesToCardinal(current.wind?.deg ?? 0),
    description: current.weather?.[0]?.description ?? "clear",
    rainChance: Math.round(rainChance),
    uvIndex: 0, // Requires separate One Call API
    isDay: isDaytime(lon),
    alerts,
    stationName: current.name ?? "Unknown",
    stationDistanceKm: Math.round(distanceKm),
    accuracyScore: accuracyFromDistance(distanceKm),
    source: "OpenWeather",
  };
}

// ---------------------------------------------------------------------------
// Custom JSON source (Pro feature)
// ---------------------------------------------------------------------------

/** Check whether a hostname points to a private/internal address (SSRF prevention) */
function isPrivateHost(host: string): boolean {
  // Strip IPv6 brackets
  const h = host.replace(/^\[|\]$/g, "");

  // Localhost variants
  if (h === "localhost" || h === "127.0.0.1" || h === "0.0.0.0" || h === "::1") return true;

  // Private IPv4 ranges: 10.0.0.0/8, 192.168.0.0/16, 172.16.0.0/12
  if (h.startsWith("10.") || h.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;

  // Link-local IPv4 (169.254.0.0/16) — includes cloud metadata endpoint 169.254.169.254
  if (h.startsWith("169.254.")) return true;

  // IPv6 private/link-local ranges
  if (h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;

  // Internal-style hostnames
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;

  return false;
}

async function fetchCustomSource(url: string, lon: number): Promise<WeatherData> {
  // Validate URL to prevent SSRF — only allow HTTPS with public hostnames
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid custom source URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Custom source URL must use HTTPS");
  }
  const host = parsed.hostname.toLowerCase();
  if (isPrivateHost(host)) {
    throw new Error("Custom source URL must point to a public host");
  }

  const res = await fetch(parsed.toString(), { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Custom source fetch failed: ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  // Expect the custom JSON to follow our WeatherData shape (or a best-effort
  // mapping from common fields).
  return {
    temp: Number(data.temp ?? data.temperature ?? 0),
    feelsLike: Number(data.feelsLike ?? data.feels_like ?? data.temp ?? 0),
    humidity: Number(data.humidity ?? 0),
    windSpeed: Number(data.windSpeed ?? data.wind_speed ?? 0),
    windDir: String(data.windDir ?? data.wind_dir ?? "N"),
    description: String(data.description ?? data.condition ?? "Unknown"),
    rainChance: Number(data.rainChance ?? data.rain_chance ?? 0),
    uvIndex: Number(data.uvIndex ?? data.uv_index ?? 0),
    isDay: Boolean(data.isDay ?? isDaytime(lon)),
    alerts: Array.isArray(data.alerts) ? data.alerts : [],
    stationName: String(data.stationName ?? data.station ?? "Custom"),
    stationDistanceKm: Number(data.stationDistanceKm ?? 0),
    accuracyScore: "Low", // Custom source accuracy is unverified
    source: "Custom",
  };
}

// ---------------------------------------------------------------------------
// WeatherAPI.com (requires WEATHERAPI_KEY)
// ---------------------------------------------------------------------------

async function fetchWeatherApi(lat: number, lon: number, apiKey?: string): Promise<SourceWeatherData & { hourly: HourlyForecast[] }> {
  const key = apiKey ?? process.env.WEATHERAPI_KEY;
  if (!key) throw new Error("WEATHERAPI_KEY is not set");

  const url = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${lat},${lon}&days=1&aqi=no&alerts=no`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`WeatherAPI fetch failed: ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  const current = data.current ?? {};
  const forecastDay = data.forecast?.forecastday?.[0] ?? {};

  const hourly: HourlyForecast[] = (forecastDay.hour ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (h: any) => ({
      time: h.time ?? "",
      temp: Math.round(h.temp_c ?? 0),
      description: h.condition?.text ?? "Unknown",
      rainChance: h.chance_of_rain ?? 0,
      windSpeed: Math.round(h.wind_kph ?? 0),
    })
  );

  return {
    temp: Math.round(current.temp_c ?? 0),
    feelsLike: Math.round(current.feelslike_c ?? current.temp_c ?? 0),
    humidity: current.humidity ?? 0,
    windSpeed: Math.round(current.wind_kph ?? 0),
    windDir: current.wind_dir ?? "N",
    description: current.condition?.text ?? "Unknown",
    rainChance: forecastDay.day?.daily_chance_of_rain ?? 0,
    uvIndex: current.uv ?? 0,
    source: "WeatherAPI",
    hourly,
  };
}

// ---------------------------------------------------------------------------
// Visual Crossing (requires VISUALCROSSING_API_KEY)
// ---------------------------------------------------------------------------

async function fetchVisualCrossing(lat: number, lon: number, apiKey?: string): Promise<SourceWeatherData & { hourly: HourlyForecast[] }> {
  const key = apiKey ?? process.env.VISUALCROSSING_API_KEY;
  if (!key) throw new Error("VISUALCROSSING_API_KEY is not set");

  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${lat},${lon}/today?unitGroup=metric&key=${key}&include=current,hours&contentType=json`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Visual Crossing fetch failed: ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  const current = data.currentConditions ?? {};
  const dayData = data.days?.[0] ?? {};

  const hourly: HourlyForecast[] = (dayData.hours ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (h: any) => ({
      time: h.datetime ?? "",
      temp: Math.round(h.temp ?? 0),
      description: h.conditions ?? "Unknown",
      rainChance: Math.round(h.precipprob ?? 0),
      windSpeed: Math.round(h.windspeed ?? 0),
    })
  );

  return {
    temp: Math.round(current.temp ?? 0),
    feelsLike: Math.round(current.feelslike ?? current.temp ?? 0),
    humidity: Math.round(current.humidity ?? 0),
    windSpeed: Math.round(current.windspeed ?? 0),
    windDir: degreesToCardinal(current.winddir ?? 0),
    description: current.conditions ?? "Unknown",
    rainChance: Math.round(dayData.precipprob ?? 0),
    uvIndex: current.uvindex ?? 0,
    source: "VisualCrossing",
    hourly,
  };
}

// ---------------------------------------------------------------------------
// Pirate Weather (requires PIRATEWEATHER_API_KEY)
// Dark Sky-compatible API: https://pirateweather.net
// ---------------------------------------------------------------------------

async function fetchPirateWeather(lat: number, lon: number, apiKey?: string): Promise<SourceWeatherData & { hourly: HourlyForecast[] }> {
  const key = apiKey ?? process.env.PIRATEWEATHER_API_KEY;
  if (!key) throw new Error("PIRATEWEATHER_API_KEY is not set");

  const url = `https://api.pirateweather.net/forecast/${key}/${lat},${lon}?units=ca`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Pirate Weather fetch failed: ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  const currently = data.currently ?? {};
  const hourlyBlock = data.hourly?.data ?? [];

  const hourly: HourlyForecast[] = hourlyBlock.slice(0, 24).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (h: any) => ({
      time: new Date((h.time ?? 0) * 1000).toISOString(),
      temp: Math.round(h.temperature ?? 0),
      description: h.summary ?? "Unknown",
      rainChance: Math.round((h.precipProbability ?? 0) * 100),
      windSpeed: Math.round(h.windSpeed ?? 0),
    })
  );

  return {
    temp: Math.round(currently.temperature ?? 0),
    feelsLike: Math.round(currently.apparentTemperature ?? currently.temperature ?? 0),
    humidity: Math.round((currently.humidity ?? 0) * 100),
    windSpeed: Math.round(currently.windSpeed ?? 0),
    windDir: degreesToCardinal(currently.windBearing ?? 0),
    description: currently.summary ?? "Unknown",
    rainChance: Math.round((currently.precipProbability ?? 0) * 100),
    uvIndex: Math.round(currently.uvIndex ?? 0),
    source: "PirateWeather",
    hourly,
  };
}

// ---------------------------------------------------------------------------
// Open-Meteo (free, no API key needed)
// ---------------------------------------------------------------------------

async function fetchOpenMeteo(lat: number, lon: number): Promise<SourceWeatherData & { hourly: HourlyForecast[] }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m&forecast_days=1&timezone=auto`;
  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Open-Meteo fetch failed: ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();

  const current = data.current ?? {};
  const hourlyData = data.hourly ?? {};

  const hourly: HourlyForecast[] = [];
  const times: string[] = hourlyData.time ?? [];
  const temps: number[] = hourlyData.temperature_2m ?? [];
  const codes: number[] = hourlyData.weather_code ?? [];
  const rainProbs: number[] = hourlyData.precipitation_probability ?? [];
  const winds: number[] = hourlyData.wind_speed_10m ?? [];

  for (let i = 0; i < times.length; i++) {
    hourly.push({
      time: times[i],
      temp: Math.round(temps[i] ?? 0),
      description: wmoCodeToDescription(codes[i] ?? 0),
      rainChance: Math.round(rainProbs[i] ?? 0),
      windSpeed: Math.round(winds[i] ?? 0),
    });
  }

  return {
    temp: Math.round(current.temperature_2m ?? 0),
    feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m ?? 0),
    humidity: Math.round(current.relative_humidity_2m ?? 0),
    windSpeed: Math.round(current.wind_speed_10m ?? 0),
    windDir: degreesToCardinal(current.wind_direction_10m ?? 0),
    description: wmoCodeToDescription(current.weather_code ?? 0),
    rainChance: Math.round(rainProbs[0] ?? 0),
    uvIndex: 0,
    source: "Open-Meteo",
    hourly,
  };
}

/** Convert WMO weather code to human-readable description */
function wmoCodeToDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 49) return "Fog";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 84) return "Rain showers";
  if (code <= 89) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

/** Average multiple weather sources for display, keep all source data for AI */
function averageSources(sources: SourceWeatherData[], primary: WeatherData): WeatherData {
  if (sources.length === 0) return primary;

  const avg = (field: keyof SourceWeatherData) => {
    const nums = sources.map((s) => Number(s[field])).filter((n) => !isNaN(n));
    return nums.length > 0 ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
  };

  // Merge hourly from first source that has it
  const hourly = sources.find((s) => s.hourly && s.hourly.length > 0)?.hourly;

  return {
    ...primary,
    temp: avg("temp"),
    feelsLike: avg("feelsLike"),
    humidity: avg("humidity"),
    windSpeed: avg("windSpeed"),
    rainChance: avg("rainChance"),
    uvIndex: avg("uvIndex"),
    source: sources.length > 1 ? "Multi" : primary.source,
    hourly,
    sources,
  };
}

// ---------------------------------------------------------------------------
// RSS feed fetching (custom user source)
// ---------------------------------------------------------------------------

export interface CustomSource {
  id: string;
  type: "rss" | "api_key" | "url";
  name: string;
  value: string;
  service?: string; // For api_key type: weatherapi, visualcrossing, pirateweather, openweather
}

export type SourceMode = "builtin" | "custom" | "both";

const MAX_RSS_ITEMS = 5;
const MAX_RSS_ITEM_LENGTH = 300;
export const MAX_CUSTOM_SOURCES = 10;

/** Fetch and extract text content from an RSS feed URL (for weather context) */
async function fetchRssFeed(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid RSS feed URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("RSS feed URL must use HTTPS");
  }
  if (isPrivateHost(parsed.hostname.toLowerCase())) {
    throw new Error("RSS feed URL must point to a public host");
  }

  const res = await fetch(parsed.toString(), {
    headers: { "User-Agent": "SkyStyle/1.0 (weather-stylist app)" },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();

  // Simple XML text extraction — pull <title> and <description> content
  const items: string[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRegex) ?? [];
  for (const item of matches.slice(0, MAX_RSS_ITEMS)) {
    const title = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() ?? "";
    const desc = item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim() ?? "";
    if (title || desc) items.push(`${title}: ${desc}`.slice(0, MAX_RSS_ITEM_LENGTH));
  }
  return items.join("\n") || "No weather content found in RSS feed.";
}

/** Process custom sources and return context strings for AI and any weather source data */
export async function processCustomSources(
  customSources: CustomSource[],
  lat: number,
  lon: number
): Promise<{ extraContext: string[]; extraWeatherSources: SourceWeatherData[] }> {
  const extraContext: string[] = [];
  const extraWeatherSources: SourceWeatherData[] = [];

  for (const source of customSources.slice(0, MAX_CUSTOM_SOURCES)) {
    try {
      switch (source.type) {
        case "rss": {
          const content = await fetchRssFeed(source.value);
          extraContext.push(`[RSS: ${source.name}]\n${content}`);
          break;
        }
        case "url": {
          // URLs are NOT fetched — just sent as context reference to the AI
          extraContext.push(`[URL Reference: ${source.name}] ${source.value}`);
          break;
        }
        case "api_key": {
          // Use the API key with the specified weather service (passed as parameter, no env mutation)
          const svc = source.service ?? "";
          if (svc === "weatherapi") {
            const data = await fetchWeatherApi(lat, lon, source.value);
            data.source = `WeatherAPI (${source.name})`;
            extraWeatherSources.push(data);
          } else if (svc === "visualcrossing") {
            const data = await fetchVisualCrossing(lat, lon, source.value);
            data.source = `VisualCrossing (${source.name})`;
            extraWeatherSources.push(data);
          } else if (svc === "pirateweather") {
            const data = await fetchPirateWeather(lat, lon, source.value);
            data.source = `PirateWeather (${source.name})`;
            extraWeatherSources.push(data);
          } else if (svc === "openweather") {
            const data = await fetchOpenWeather(lat, lon, source.value);
            extraWeatherSources.push({
              temp: data.temp,
              feelsLike: data.feelsLike,
              humidity: data.humidity,
              windSpeed: data.windSpeed,
              windDir: data.windDir,
              description: data.description,
              rainChance: data.rainChance,
              uvIndex: data.uvIndex,
              source: `OpenWeather (${source.name})`,
            });
          }
          break;
        }
      }
    } catch (err) {
      console.warn(`[weather] Custom source "${source.name}" failed:`, err instanceof Error ? err.message : err);
    }
  }

  return { extraContext, extraWeatherSources };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function getWeather(
  lat: number,
  lon: number,
  customSourceUrl?: string,
  sourceMode: SourceMode = "builtin",
  customSources: CustomSource[] = []
): Promise<WeatherData & { customContext?: string[] }> {
  // Legacy: single custom source URL (Pro feature)
  if (customSourceUrl && sourceMode === "builtin") {
    return fetchCustomSource(customSourceUrl, lon);
  }

  // Process user's custom sources
  const { extraContext, extraWeatherSources } =
    customSources.length > 0
      ? await processCustomSources(customSources, lat, lon)
      : { extraContext: [] as string[], extraWeatherSources: [] as SourceWeatherData[] };

  // Resolve effective source mode — fall back to built-in if custom has no data
  const effectiveMode: SourceMode =
    sourceMode === "custom" && extraWeatherSources.length === 0 && extraContext.length === 0
      ? "builtin"
      : sourceMode;

  // "custom" mode: only use user-provided weather sources
  if (effectiveMode === "custom" && extraWeatherSources.length > 0) {
    const primary: WeatherData = {
      ...extraWeatherSources[0],
      isDay: isDaytime(lon),
      alerts: [],
      stationName: extraWeatherSources[0].source,
      stationDistanceKm: 0,
      accuracyScore: "Medium",
      source: "Custom",
      hourly: extraWeatherSources[0].hourly,
    };
    const result = averageSources(extraWeatherSources, primary);
    return { ...result, customContext: extraContext.length > 0 ? extraContext : undefined };
  }

  // Fetch from multiple sources in parallel for better accuracy
  const sourcePromises: Promise<SourceWeatherData | null>[] = [];

  // Always try OpenWeather (primary)
  if (process.env.OPENWEATHER_API_KEY) {
    sourcePromises.push(
      fetchOpenWeather(lat, lon)
        .then((w) => ({
          temp: w.temp,
          feelsLike: w.feelsLike,
          humidity: w.humidity,
          windSpeed: w.windSpeed,
          windDir: w.windDir,
          description: w.description,
          rainChance: w.rainChance,
          uvIndex: w.uvIndex,
          source: "OpenWeather",
        }))
        .catch(() => null)
    );
  }

  // Always try Open-Meteo (free, no key needed)
  sourcePromises.push(
    fetchOpenMeteo(lat, lon).catch(() => null)
  );

  // Try WeatherAPI.com if key is available
  if (process.env.WEATHERAPI_KEY) {
    sourcePromises.push(
      fetchWeatherApi(lat, lon).catch(() => null)
    );
  }

  // Try Visual Crossing if key is available
  if (process.env.VISUALCROSSING_API_KEY) {
    sourcePromises.push(
      fetchVisualCrossing(lat, lon).catch(() => null)
    );
  }

  // Try Pirate Weather if key is available
  if (process.env.PIRATEWEATHER_API_KEY) {
    sourcePromises.push(
      fetchPirateWeather(lat, lon).catch(() => null)
    );
  }

  // Try BOM for Australia
  if (isAustralia(lat, lon)) {
    sourcePromises.push(
      fetchBom(lat, lon)
        .then((w) => ({
          temp: w.temp,
          feelsLike: w.feelsLike,
          humidity: w.humidity,
          windSpeed: w.windSpeed,
          windDir: w.windDir,
          description: w.description,
          rainChance: w.rainChance,
          uvIndex: w.uvIndex,
          source: "BOM",
        }))
        .catch(() => null)
    );
  }

  const results = await Promise.all(sourcePromises);
  const validSources = results.filter((r): r is SourceWeatherData => r !== null);

  // In "both" mode, merge user's weather sources with built-in
  if (effectiveMode === "both" && extraWeatherSources.length > 0) {
    validSources.push(...extraWeatherSources);
  }

  // We need at least one source
  if (validSources.length === 0) {
    throw new Error("All weather sources failed. Please try again later.");
  }

  // Use the primary (first successful) source for metadata
  let primary: WeatherData;
  try {
    primary = await fetchOpenWeather(lat, lon);
  } catch {
    // Fall back to a simple primary from first valid source
    const s = validSources[0];
    primary = {
      ...s,
      isDay: isDaytime(lon),
      alerts: [],
      stationName: s.source,
      stationDistanceKm: 0,
      accuracyScore: "Medium",
      source: s.source as WeatherData["source"],
    };
  }

  const averaged = averageSources(validSources, primary);
  return { ...averaged, customContext: extraContext.length > 0 ? extraContext : undefined };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Approximate whether it is daytime at the given longitude using solar time. */
function isDaytime(lon: number): boolean {
  // Solar hour ≈ UTC hour + longitude / 15 (each 15° = 1 hour)
  const utcHour = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  const solarHour = ((utcHour + lon / 15) % 24 + 24) % 24;
  return solarHour >= 6 && solarHour < 18;
}

function degreesToCardinal(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}
