/**
 * AI styling logic.
 * Builds a prompt from weather data + closet items, then calls the configured AI API.
 * Supports OpenAI (OPENAI_API_KEY) and Google Gemini (GEMINI_API_KEY).
 * OpenAI is preferred when both keys are present.
 */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { WeatherData } from "./weather";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    _openai = new OpenAI({ apiKey });
  }
  return _openai;
}

let _gemini: GoogleGenerativeAI | null = null;
function getGemini(): GoogleGenerativeAI {
  if (!_gemini) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    _gemini = new GoogleGenerativeAI(apiKey);
  }
  return _gemini;
}

const DEFAULT_SYSTEM_PROMPT = `You are Sky Style — an expert personal stylist and meteorologist.
Given weather conditions and a user's wardrobe, recommend a specific outfit.
Your response MUST be a JSON object with exactly two keys:
  "outfit": a concise outfit recommendation (max 120 words)
  "reasoning": a brief explanation linking weather facts to clothing choices (max 160 words)

Be specific (name garment types, colours, materials). Be friendly and concise.`;

export interface StyleRecommendation {
  outfit: string;
  reasoning: string;
}

export interface StyleInput {
  weather: WeatherData;
  closetItems: string[];
  unitPreference: "metric" | "imperial";
  customSystemPrompt?: string;
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
  const { weather, closetItems, unitPreference, customSystemPrompt } = input;
  const systemPrompt = customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  const closetSection =
    closetItems.length > 0
      ? `\nUser's available wardrobe:\n${closetItems.map((i) => `- ${i}`).join("\n")}`
      : "\nUser has not added any wardrobe items — suggest general clothing.";

  const alertSection =
    weather.alerts.length > 0
      ? `\n⚠️ Active weather alerts: ${weather.alerts.join("; ")}`
      : "";

  const userMessage = `Current weather conditions:
- Temperature: ${formatTemp(weather.temp, unitPreference)} (feels like ${formatTemp(weather.feelsLike, unitPreference)})
- Humidity: ${weather.humidity}%
- Wind: ${formatWind(weather.windSpeed, unitPreference)} from ${weather.windDir}
- Conditions: ${weather.description}
- Rain chance: ${weather.rainChance}%
- UV Index: ${weather.uvIndex}
- Time of day: ${weather.isDay ? "Daytime" : "Night-time"}
- Data source: ${weather.source} (station: ${weather.stationName}, ${weather.stationDistanceKm} km away — accuracy: ${weather.accuracyScore})${alertSection}${closetSection}

Please recommend an outfit.`;

  let raw: string;

  if (process.env.OPENAI_API_KEY) {
    const response = await getOpenAI().chat.completions.create({
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
