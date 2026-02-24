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
  source: "BOM" | "OpenWeather" | "Custom";
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
  const url = `http://www.bom.gov.au/fwo/${station.id}.json`;
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

async function fetchOpenWeather(lat: number, lon: number): Promise<WeatherData> {
  const key = process.env.OPENWEATHER_API_KEY;
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

async function fetchCustomSource(url: string, lon: number): Promise<WeatherData> {
  const res = await fetch(url, { next: { revalidate: 300 } });
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
// Public entry point
// ---------------------------------------------------------------------------

export async function getWeather(
  lat: number,
  lon: number,
  customSourceUrl?: string
): Promise<WeatherData> {
  if (customSourceUrl) {
    return fetchCustomSource(customSourceUrl, lon);
  }
  if (isAustralia(lat, lon)) {
    return fetchBom(lat, lon);
  }
  return fetchOpenWeather(lat, lon);
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
