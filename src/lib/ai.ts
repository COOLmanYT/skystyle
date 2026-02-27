/**
 * AI styling logic.
 * Builds a prompt from weather data + closet items, then calls the configured AI API.
 * Supports OpenAI (OPENAI_API_KEY) and Google Gemini (GEMINI_API_KEY).
 * OpenAI is preferred when both keys are present.
 * Supports BYOK (Bring Your Own Key) for Pro users.
 */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { WeatherData } from "./weather";

let _openai: OpenAI | null = null;
function getOpenAI(apiKey?: string): OpenAI {
  if (apiKey) return new OpenAI({ apiKey });
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

let _gemini: GoogleGenerativeAI | null = null;
function getGemini(apiKey?: string): GoogleGenerativeAI {
  if (apiKey) return new GoogleGenerativeAI(apiKey);
  if (!_gemini) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    _gemini = new GoogleGenerativeAI(key);
  }
  return _gemini;
}

const DEFAULT_SYSTEM_PROMPT = `You are Sky Style — an expert personal stylist and meteorologist.
Given weather conditions and a user's wardrobe, recommend a specific outfit.
Your response MUST be a JSON object with exactly two keys:
  "outfit": a concise outfit recommendation (max 120 words)
  "reasoning": a brief explanation linking weather facts to clothing choices (max 160 words)

Be specific (name garment types, colours, materials). Be friendly and concise.`;

export interface StyleInput {
  weather: WeatherData;
  closetItems: string[];
  unitPreference: "metric" | "imperial";
  customSystemPrompt?: string;
  /** Pro BYOK: user-provided AI API key (not saved, used for this request only) */
  userApiKey?: string;
}

export interface FollowUpInput {
  previousOutfit: string;
  previousReasoning: string;
  weather: WeatherData;
  followUpMessage: string;
  unitPreference: "metric" | "imperial";
  customSystemPrompt?: string;
  userApiKey?: string;
}

export interface StyleRecommendation {
  outfit: string;
  reasoning: string;
}

function formatTemp(celsius: number, unit: "metric" | "imperial"): string {
  if (unit === "imperial") {
    const f = Math.round((celsius * 9) / 5 + 32);
    return `${f}°F`;
  }
  return `${celsius}°C`;
}

function formatWind(kmh: number, unit: "metric" | "imperial"): string {
  if (unit === "imperial") {
    const mph = Math.round(kmh * 0.621371);
    return `${mph} mph`;
  }
  return `${kmh} km/h`;
}

export async function getStyleRecommendation(
  input: StyleInput
): Promise<StyleRecommendation> {
  const { weather, closetItems, unitPreference, customSystemPrompt, userApiKey } = input;
  const systemPrompt = customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  const closetSection =
    closetItems.length > 0
      ? `\nUser's available wardrobe:\n${closetItems.map((i) => `- ${i}`).join("\n")}`
      : "\nUser has not added any wardrobe items — suggest general clothing.";

  const alertSection =
    weather.alerts.length > 0
      ? `\n⚠️ Active weather alerts: ${weather.alerts.join("; ")}`
      : "";

  // Include multi-source data for the AI
  let sourcesSection = "";
  if (weather.sources && weather.sources.length > 1) {
    sourcesSection = `\n\nWeather data from multiple sources:\n${weather.sources
      .map(
        (s) =>
          `- ${s.source}: ${formatTemp(s.temp, unitPreference)}, feels like ${formatTemp(s.feelsLike, unitPreference)}, humidity ${s.humidity}%, wind ${formatWind(s.windSpeed, unitPreference)}, rain ${s.rainChance}%, "${s.description}"`
      )
      .join("\n")}`;
  }

  // Include hourly forecast if available
  let hourlySection = "";
  if (weather.hourly && weather.hourly.length > 0) {
    const nextHours = weather.hourly.slice(0, 12);
    hourlySection = `\n\nHourly forecast (next ${nextHours.length} hours):\n${nextHours
      .map(
        (h) =>
          `- ${h.time}: ${formatTemp(h.temp, unitPreference)}, ${h.description}, rain ${h.rainChance}%, wind ${formatWind(h.windSpeed, unitPreference)}`
      )
      .join("\n")}`;
  }

  const userMessage = `Current weather conditions (averaged across sources):
- Temperature: ${formatTemp(weather.temp, unitPreference)} (feels like ${formatTemp(weather.feelsLike, unitPreference)})
- Humidity: ${weather.humidity}%
- Wind: ${formatWind(weather.windSpeed, unitPreference)} from ${weather.windDir}
- Conditions: ${weather.description}
- Rain chance: ${weather.rainChance}%
- UV Index: ${weather.uvIndex}
- Time of day: ${weather.isDay ? "Daytime" : "Night-time"}
- Data source: ${weather.source} (station: ${weather.stationName}, ${weather.stationDistanceKm} km away — accuracy: ${weather.accuracyScore})${alertSection}${sourcesSection}${hourlySection}${closetSection}

Please recommend an outfit.`;

  return callAI(systemPrompt, userMessage, userApiKey);
}

/** Follow-up: modify an existing recommendation based on user input */
export async function getFollowUpRecommendation(
  input: FollowUpInput
): Promise<StyleRecommendation> {
  const { previousOutfit, previousReasoning, weather, followUpMessage, unitPreference, customSystemPrompt, userApiKey } = input;
  const systemPrompt = customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  const userMessage = `Previous outfit recommendation:
${previousOutfit}

Previous reasoning:
${previousReasoning}

Current weather: ${formatTemp(weather.temp, unitPreference)}, ${weather.description}, rain chance ${weather.rainChance}%, wind ${formatWind(weather.windSpeed, unitPreference)}

User follow-up question: "${followUpMessage}"

Please update the outfit recommendation based on the follow-up question. Respond with the same JSON format.`;

  return callAI(systemPrompt, userMessage, userApiKey);
}

async function callAI(
  systemPrompt: string,
  userMessage: string,
  userApiKey?: string
): Promise<StyleRecommendation> {
  let raw: string;

  if (userApiKey || process.env.OPENAI_API_KEY) {
    const response = await getOpenAI(userApiKey).chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.7,
    });
    raw = response.choices[0]?.message?.content ?? "{}";
  } else if (process.env.GEMINI_API_KEY) {
    const model = getGemini().getGenerativeModel({
      model: "gemini-2.5-flash-lite",
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 300 },
    });
    const result = await model.generateContent(`${systemPrompt}\n\n${userMessage}`);
    raw = result.response.text();
  } else {
    throw new Error("No AI API key configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StyleRecommendation>;
    return {
      outfit: parsed.outfit ?? "Unable to generate outfit recommendation.",
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    return {
      outfit: "Unable to generate outfit recommendation.",
      reasoning: raw,
    };
  }
}
