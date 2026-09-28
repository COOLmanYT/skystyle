import { getWeather, weatherCache } from "../weather";
import { formatHourlyDay, formatHourlyTime, isHourlyCurrentOrFuture } from "../../components/WeatherEffectCard";

describe("hourly forecast across date boundaries", () => {
  const originalKeys = {
    OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    WEATHERAPI_KEY: process.env.WEATHERAPI_KEY,
    VISUALCROSSING_API_KEY: process.env.VISUALCROSSING_API_KEY,
    PIRATEWEATHER_API_KEY: process.env.PIRATEWEATHER_API_KEY,
  };

  beforeEach(() => {
    weatherCache.clear();
    for (const key of Object.keys(originalKeys)) delete process.env[key];
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalKeys)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    jest.restoreAllMocks();
  });

  it("requests two days and preserves UTC instants across midnight and a repeated DST hour", async () => {
    const hours = [
      Date.parse("2026-04-04T15:00:00Z") / 1000,
      Date.parse("2026-04-04T16:00:00Z") / 1000,
      Date.parse("2026-04-04T17:00:00Z") / 1000,
    ];
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        timezone: "Australia/Sydney",
        current: { temperature_2m: 20 },
        hourly: {
          time: hours,
          temperature_2m: [20, 19, 18],
          weather_code: [0, 0, 0],
          precipitation_probability: [0, 0, 0],
          wind_speed_10m: [1, 1, 1],
        },
      }),
    } as Response);

    const result = await getWeather(51.5, -0.1);
    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(new URL(requestUrl).searchParams.get("forecast_days")).toBe("2");
    expect(new URL(requestUrl).searchParams.get("timeformat")).toBe("unixtime");
    expect(result.hourly?.map((hour) => hour.time)).toEqual(hours.map((hour) => new Date(hour * 1000).toISOString()));
    expect(result.timeZone).toBe("Australia/Sydney");
  });

  it("uses both WeatherAPI forecast days and their epoch timestamps", async () => {
    process.env.WEATHERAPI_KEY = "test";
    const first = Date.parse("2026-09-27T23:00:00Z") / 1000;
    const second = Date.parse("2026-09-28T00:00:00Z") / 1000;
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("open-meteo")) return { ok: false, status: 503 } as Response;
      return {
        ok: true,
        json: async () => ({
          location: { tz_id: "Europe/London" },
          current: { temp_c: 20 },
          forecast: { forecastday: [
            { day: { daily_chance_of_rain: 0 }, hour: [{ time_epoch: first, temp_c: 20 }] },
            { hour: [{ time_epoch: second, temp_c: 19 }] },
          ] },
        }),
      } as Response;
    });

    const result = await getWeather(51.6, -0.1);
    const requestUrl = String(fetchMock.mock.calls.find(([url]) => String(url).includes("weatherapi.com"))?.[0]);
    expect(new URL(requestUrl).searchParams.get("days")).toBe("2");
    expect(result.hourly?.map((hour) => hour.time)).toEqual([
      "2026-09-27T23:00:00.000Z", "2026-09-28T00:00:00.000Z",
    ]);
    expect(result.timeZone).toBe("Europe/London");
  });

  it("uses both Visual Crossing days and distinguishes UTC hours", async () => {
    process.env.VISUALCROSSING_API_KEY = "test";
    const first = Date.parse("2026-09-27T23:00:00Z") / 1000;
    const second = Date.parse("2026-09-28T00:00:00Z") / 1000;
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("open-meteo")) return { ok: false, status: 503 } as Response;
      return {
        ok: true,
        json: async () => ({
          timezone: "Europe/London",
          currentConditions: { temp: 20 },
          days: [
            { precipprob: 0, hours: [{ datetimeEpoch: first, temp: 20 }] },
            { hours: [{ datetimeEpoch: second, temp: 19 }] },
          ],
        }),
      } as Response;
    });

    const result = await getWeather(51.7, -0.1);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/next2days?"))).toBe(true);
    expect(result.hourly?.map((hour) => hour.time)).toEqual([
      "2026-09-27T23:00:00.000Z", "2026-09-28T00:00:00.000Z",
    ]);
    expect(result.timeZone).toBe("Europe/London");
  });

  it("keeps the next day's hours when filtering at the end of today", () => {
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-09-27T23:45:00Z"));
    expect(isHourlyCurrentOrFuture("2026-09-27T23:00:00Z")).toBe(false);
    expect(isHourlyCurrentOrFuture("2026-09-28T00:00:00Z")).toBe(true);
  });

  it("labels a remote city's midnight in the forecast location's time zone", () => {
    const instant = "2026-09-27T14:00:00.000Z";
    expect(formatHourlyDay(instant, "Australia/Sydney")).toBe("Mon");
    expect(formatHourlyTime(instant, "Australia/Sydney")).toBe("00:00");
  });

  it("keeps both repeated local daylight-saving hours as distinct instants", () => {
    const first = "2026-04-04T15:00:00.000Z";
    const second = "2026-04-04T16:00:00.000Z";
    expect(formatHourlyDay(first, "Australia/Sydney")).toBe("Sun");
    expect(formatHourlyTime(first, "Australia/Sydney")).toBe("02:00");
    expect(formatHourlyTime(second, "Australia/Sydney")).toBe("02:00");
    expect(new Date(first).getTime()).not.toBe(new Date(second).getTime());
  });
});
