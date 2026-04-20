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

Be specific (name garment types, colours, materials). Be friendly and concise. Output ONLY the raw JSON object with no preface or trailing text. Never include phrases like "Here is the JSON requested", "Here's the JSON", "Below is the JSON", or any similar lead-in.`;

const MAX_JSON_LEAD_IN_CHARS = 120;
// Matches assistant lead-in prose that references "json" before the actual payload.
const JSON_LEAD_IN_PATTERN = `(?:^|\\n)\\s*(?:here(?:['’]s| is| are)|below is|this is|sure|certainly|okay|ok)\\b[^\\n{}]{0,${MAX_JSON_LEAD_IN_CHARS}}\\bjson\\b[^\\n{}]{0,${MAX_JSON_LEAD_IN_CHARS}}(?::|-)?\\s*`;
const JSON_LEAD_IN_TEST_REGEX = new RegExp(JSON_LEAD_IN_PATTERN, "i");
const JSON_LEAD_IN_REPLACE_REGEX = new RegExp(JSON_LEAD_IN_PATTERN, "gi");
const JSON_LEAD_IN_AT_START_REGEX = new RegExp(
  `^\\s*(?:(?:here(?:['’]s| is| are)|below is|this is|sure|certainly|okay|ok)\\b[^\\n{}]{0,${MAX_JSON_LEAD_IN_CHARS}}\\bjson\\b[^\\n{}]{0,${MAX_JSON_LEAD_IN_CHARS}}|(?:the\\s+)?json\\s+(?:you\\s+)?requested)\\s*(?::|-)?\\s*`,
  "i"
);

/** Remove forbidden JSON lead-in phrasing from the start of a text field. */
function stripForbiddenJsonLeadIn(value: string): string {
  if (!value) return value;
  return value.replace(JSON_LEAD_IN_AT_START_REGEX, "").trimStart();
}

/** Enforce JSON-only output by preferring the first JSON object over mixed prose+JSON content. */
function enforceStrictJsonOnly(raw: string): string {
  const trimmed = raw.trim();
  const extractedJson = extractFirstParsableJsonObject(trimmed, true);
  if (extractedJson && extractedJson.trim() !== trimmed) return extractedJson;
  if (!JSON_LEAD_IN_TEST_REGEX.test(trimmed)) return trimmed;
  if (extractedJson) return extractedJson;
  const fallbackJson = extractFirstParsableJsonObject(trimmed);
  if (fallbackJson) return fallbackJson;
  return trimmed.replace(JSON_LEAD_IN_REPLACE_REGEX, "").trim();
}

/** Apply lead-in sanitization across recommendation fields before returning to clients. */
function sanitizeRecommendationFields(recommendation: StyleRecommendation): StyleRecommendation {
  return {
    ...recommendation,
    outfit: stripForbiddenJsonLeadIn(recommendation.outfit),
    reasoning: stripForbiddenJsonLeadIn(recommendation.reasoning),
    ...(recommendation.rawOutput ? { rawOutput: enforceStrictJsonOnly(recommendation.rawOutput) } : {}),
  };
}

/** A single time-slot entry from the weather planning panel */
export interface PlanningSlot {
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  environment: string; // "outside" | "inside" | "hybrid"
  temperature: string; // free-text indoor temp; only relevant for inside/hybrid
}

/** Structured planning data from the WeatherPlanningPanel (localStorage) */
export interface PlanningData {
  slots: PlanningSlot[];
  /** 0=Simple, 1=Simple+, 2=Advanced, 3=Pro */
  complexity: number;
}

export interface StyleInput {
  weather: WeatherData;
  closetItems: string[];
  unitPreference: "metric" | "imperial";
  customSystemPrompt?: string;
  /** Pro BYOK: user-provided AI API key (not saved, used for this request only) */
  userApiKey?: string;
  /** Pro/Dev client-side custom prompt (localStorage only, never persisted server-side) */
  clientCustomPrompt?: string;
  /** Which provider to use for the BYOK key ("openai" | "gemini", defaults to "openai") */
  byokProvider?: "openai" | "gemini";
  /** Gender context for recommendations (e.g. "Male", "Female", "N/A", or custom text) */
  gender?: string;
  /** Whether the user consented to share their location with the AI */
  shareLocation?: boolean;
  /** When true, AI must ONLY recommend items from the user's closet */
  forceCloset?: boolean;
  /** Dev mode: include raw AI output in response */
  isDev?: boolean;
  /** Additional context from user's custom sources (RSS content, URL references) */
  customContext?: string[];
  /** Weather planning data from the planning panel */
  planningData?: PlanningData;
}

export interface FollowUpInput {
  previousOutfit: string;
  previousReasoning: string;
  weather: WeatherData;
  followUpMessage: string;
  unitPreference: "metric" | "imperial";
  customSystemPrompt?: string;
  userApiKey?: string;
  /** Dev mode: include raw AI output in response */
  isDev?: boolean;
}

export interface StyleRecommendation {
  outfit: string;
  reasoning: string;
  /** Raw AI output — only included for dev mode users */
  rawOutput?: string;
  /** Warning shown when force-closet mode has very limited items */
  closetWarning?: string;
  /** AI model used for this response */
  modelUsed?: string;
}

function decodeJsonLikeString(value: string): string {
  const decodedParts: string[] = [];
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char !== "\\") {
      decodedParts.push(char);
      continue;
    }
    const next = value[i + 1];
    if (next === undefined) break;
    i++;
    if (next === "n") decodedParts.push("\n");
    else if (next === "r") decodedParts.push("\r");
    else if (next === "t") decodedParts.push("\t");
    else if (next === '"') decodedParts.push('"');
    else if (next === "\\") decodedParts.push("\\");
    else decodedParts.push(next);
  }
  return decodedParts.join("");
}

function extractJsonField(text: string, key: "outfit" | "reasoning"): string | null {
  const keyIndex = text.indexOf(`"${key}"`);
  if (keyIndex === -1) return null;
  const colonIndex = text.indexOf(":", keyIndex);
  if (colonIndex === -1) return null;
  let start = colonIndex + 1;
  while (start < text.length && /\s/.test(text[start])) {
    start++;
  }
  if (text[start] !== '"') return null;
  start++;
  let escaped = false;
  const valueParts: string[] = [];
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escaped) {
      valueParts.push(`\\${char}`);
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      return decodeJsonLikeString(valueParts.join(""));
    }
    valueParts.push(char);
  }
  const decoded = decodeJsonLikeString(valueParts.join(""));
  return decoded.trim() ? decoded : null;
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractFirstParsableJsonObject(
  text: string,
  requireRecommendationFields = false
): string | null {
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const start = text.indexOf("{", searchFrom);
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth++;
      if (char === "}") {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) return null;
    const candidate = text.slice(start, end);
    try {
      const parsedUnknown = JSON.parse(candidate) as unknown;
      if (!parsedUnknown || typeof parsedUnknown !== "object" || Array.isArray(parsedUnknown)) {
        searchFrom = start + 1;
        continue;
      }
      const parsed = parsedUnknown as Partial<StyleRecommendation>;
      const hasRecommendationFields =
        typeof parsed?.outfit === "string" || typeof parsed?.reasoning === "string";
      if (!requireRecommendationFields || hasRecommendationFields) {
        return candidate;
      }
    } catch {
      // Try next balanced object.
    }
    searchFrom = start + 1;
  }
  return null;
}

function parseRecommendationFromRaw(raw: string): Partial<StyleRecommendation> | null {
  const tryParse = (candidate: string): Partial<StyleRecommendation> | null => {
    if (!candidate.trim()) return null;
    try {
      return JSON.parse(candidate) as Partial<StyleRecommendation>;
    } catch {
      return null;
    }
  };

  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:\w+)?\s*\n?([\s\S]*?)\n?\s*```/);
  const withoutFence = fencedMatch ? fencedMatch[1].trim() : trimmed;

  return (
    tryParse(withoutFence) ??
    tryParse(extractFirstParsableJsonObject(withoutFence, true) ?? "") ??
    tryParse(extractFirstParsableJsonObject(trimmed, true) ?? "") ??
    tryParse(extractFirstJsonObject(withoutFence) ?? "") ??
    tryParse(extractFirstJsonObject(trimmed) ?? "")
  );
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
  const {
    weather, closetItems, unitPreference, customSystemPrompt, clientCustomPrompt,
    userApiKey, byokProvider, gender, shareLocation, forceCloset, customContext, planningData,
  } = input;
  let closetWarning: string | undefined;
  if (forceCloset) {
    if (closetItems.length === 0) {
      closetWarning = "You have no closet items yet — recommendations will be general clothing.";
    } else if (closetItems.length === 1) {
      closetWarning = "You have fewer than 2 closet items — recommendations may include items outside your wardrobe.";
    }
  }

  // Client-side custom prompt takes precedence over DB-stored one (Pro/Dev only)
  const systemPrompt = clientCustomPrompt ?? customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  const closetSection =
    closetItems.length > 0
      ? forceCloset
        ? `\nCRITICAL INSTRUCTION: You MUST build the entire outfit EXCLUSIVELY from the items listed below. Do NOT suggest, imply, or reference ANY clothing item not explicitly in this list. If the available items are insufficient for a complete outfit, explicitly tell the user which items are missing rather than inventing new ones. Violating this instruction is not acceptable under any circumstances.\nUser's available wardrobe:\n${closetItems.map((i) => `- ${i}`).join("\n")}`
        : `\nUser's available wardrobe (you may also suggest items not listed here):\n${closetItems.map((i) => `- ${i}`).join("\n")}`
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

  // Custom source context (RSS content, URL references)
  const customContextSection =
    customContext && customContext.length > 0
      ? `\n\nAdditional weather context from user sources:\n${customContext.join("\n\n")}`
      : "";

  // Gender context — sanitize to prevent prompt injection
  const safeGender = gender ? gender.replace(/[\n\r]/g, " ").slice(0, 30) : undefined;
  const genderSection = safeGender && safeGender !== "N/A"
    ? `\n- Gender: ${safeGender}`
    : "";

  // Location info — only include if user consented
  const locationSection = shareLocation
    ? `\n- Data source: ${weather.source} (station: ${weather.stationName}, ${weather.stationDistanceKm} km away — accuracy: ${weather.accuracyScore})`
    : `\n- Data source: ${weather.source} (accuracy: ${weather.accuracyScore})`;

  // Weather planning context — time slots with environment type and indoor temperature
  const VALID_ENVS = new Set(["outside", "inside", "hybrid"]);
  let planningSection = "";
  if (planningData && Array.isArray(planningData.slots) && planningData.slots.length > 0) {
    const formattedSlots = planningData.slots
      .filter(
        (s) =>
          typeof s.startTime === "string" &&
          typeof s.endTime === "string" &&
          VALID_ENVS.has(s.environment)
      )
      .map((s) => {
        const safeStart = s.startTime.replace(/[^0-9:]/g, "").slice(0, 5);
        const safeEnd = s.endTime.replace(/[^0-9:]/g, "").slice(0, 5);
        const env = s.environment as string;
        const tempNote =
          (env === "inside" || env === "hybrid") && s.temperature
            ? `, indoor temp: approx. ${s.temperature.replace(/[\n\r]/g, "").slice(0, 20)}`
            : "";
        return `- ${safeStart}–${safeEnd}: ${env.charAt(0).toUpperCase() + env.slice(1)}${tempNote}`;
      });
    if (formattedSlots.length > 0) {
      planningSection = `\n\nTime-based planning context:\n${formattedSlots.join("\n")}`;
    }
  }

  // Complexity modifier — shapes the detail level and format of the AI response
  const COMPLEXITY_INSTRUCTIONS: Record<number, string> = {
    // Simple: absolute minimum — one terse sentence, no explanation whatsoever
    0: `RESPONSE STYLE — SIMPLE: Be extremely terse. The "outfit" field MUST be a single sentence (e.g. "Wear jeans, a t-shirt, and a hoodie."). The "reasoning" field MUST be an empty string "". Ignore any word-count limits in the system prompt — one sentence only.`,
    // Simple+: brief recommendation with one short reason
    1: `RESPONSE STYLE — SIMPLE+: Keep it short. The "outfit" field should be 1–2 sentences naming the key pieces. The "reasoning" field should be at most 1–2 sentences linking the weather to the choice. Do not use bullet points or headers.`,
    // Advanced: structured prose with layering/accessories notes
    2: `RESPONSE STYLE — ADVANCED: Provide a clear outfit description (3–5 sentences) in the "outfit" field. The "reasoning" field should explain layering choices, fabric suitability, and any accessories in 3–5 sentences. No Markdown headers needed — plain readable prose.`,
    // Pro: full Markdown inside both JSON fields
    3: `RESPONSE STYLE — PRO: Write a comprehensive, well-formatted recommendation. Use Markdown inside both JSON string fields: ## headers, bullet points, **bold** for key items. The "outfit" field should cover the full outfit with sections (e.g. ## Top, ## Bottom, ## Footwear, ## Accessories). The "reasoning" field should have a ## Weather Analysis section and a ## Styling Notes section. Be detailed — up to 300 words per field is acceptable.`,
  };
  const complexityLevel = typeof planningData?.complexity === "number"
    ? Math.max(0, Math.min(3, Math.round(planningData.complexity)))
    : 1;
  const complexityInstruction = COMPLEXITY_INSTRUCTIONS[complexityLevel] ?? COMPLEXITY_INSTRUCTIONS[1];

  const userMessage = `Current weather conditions (averaged across sources):
- Temperature: ${formatTemp(weather.temp, unitPreference)} (feels like ${formatTemp(weather.feelsLike, unitPreference)})
- Humidity: ${weather.humidity}%
- Wind: ${formatWind(weather.windSpeed, unitPreference)} from ${weather.windDir}
- Conditions: ${weather.description}
- Rain chance: ${weather.rainChance}%
- UV Index: ${weather.uvIndex}
- Time of day: ${weather.isDay ? "Daytime" : "Night-time"}${genderSection}${locationSection}${alertSection}${sourcesSection}${hourlySection}${customContextSection}${planningSection}${closetSection}

${complexityInstruction}

Please recommend an outfit.`;

  // Token budget scales with complexity: Simple=200, Simple+=350, Advanced=500, Pro=900
  const MAX_TOKENS_BY_COMPLEXITY: Record<number, number> = { 0: 200, 1: 350, 2: 500, 3: 900 };
  const maxTokens = MAX_TOKENS_BY_COMPLEXITY[complexityLevel] ?? 350;

  const recommendation = await callAI(systemPrompt, userMessage, userApiKey, input.isDev, byokProvider, maxTokens);
  return closetWarning ? { ...recommendation, closetWarning } : recommendation;
}

/** Dev mode: send a freeform message to the AI without weather context */
export async function getDevChatResponse(
  message: string,
  userApiKey?: string
): Promise<StyleRecommendation> {
  return callAI(DEFAULT_SYSTEM_PROMPT, message, userApiKey, true);
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

  return callAI(systemPrompt, userMessage, userApiKey, input.isDev);
}

async function callAI(
  systemPrompt: string,
  userMessage: string,
  userApiKey?: string,
  isDev: boolean = false,
  byokProvider: "openai" | "gemini" = "openai",
  maxTokens: number = 500
): Promise<StyleRecommendation> {
  let raw: string;
  let modelUsed: string;

  // Route BYOK key to the correct provider; server keys use the default priority order
  const useGeminiBYOK = userApiKey && byokProvider === "gemini";

  if (useGeminiBYOK) {
    // BYOK with Gemini — use the user's own key
    const GEMINI_MODELS = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemma-4-31b-it",
      "gemma-4-26b-it",
    ];
    let geminiRaw: string | undefined;
    let geminiModelUsed: string | undefined;
    const triedModels: string[] = [];
    for (const modelName of GEMINI_MODELS) {
      triedModels.push(modelName);
      try {
        const model = getGemini(userApiKey).getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens },
        });
        const result = await model.generateContent(`${systemPrompt}\n\n${userMessage}`);
        geminiRaw = result.response.text();
        geminiModelUsed = modelName;
        break;
      } catch (err) {
        console.warn(
          `[ai] Gemini BYOK model "${modelName}" failed:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    if (geminiRaw === undefined) {
      throw new Error(`All Gemini BYOK models failed. Tried: ${triedModels.join(", ")}`);
    }
    if (!geminiModelUsed) {
      throw new Error("Gemini BYOK model resolved without model metadata.");
    }
    raw = geminiRaw;
    modelUsed = geminiModelUsed;
  } else if (!useGeminiBYOK && (userApiKey || process.env.OPENAI_API_KEY)) {
    const modelName = "gpt-4o";
    const response = await getOpenAI(userApiKey).chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      max_tokens: maxTokens,
      temperature: 0.7,
    });
    raw = response.choices[0]?.message?.content ?? "{}";
    modelUsed = modelName;
  } else if (process.env.GEMINI_API_KEY) {
    const GEMINI_MODELS = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemma-4-31b-it",
      "gemma-4-26b-it",
    ];
    let geminiRaw: string | undefined;
    let geminiModelUsed: string | undefined;
    const triedModels: string[] = [];
    for (const modelName of GEMINI_MODELS) {
      triedModels.push(modelName);
      try {
        const model = getGemini().getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens },
        });
        const result = await model.generateContent(`${systemPrompt}\n\n${userMessage}`);
        geminiRaw = result.response.text();
        geminiModelUsed = modelName;
        break;
      } catch (err) {
        console.warn(
          `[ai] Gemini model "${modelName}" failed:`,
          err instanceof Error ? err.message : err
        );
      }
    }
    if (geminiRaw === undefined) {
      throw new Error(`All Gemini models failed. Tried: ${triedModels.join(", ")}`);
    }
    if (!geminiModelUsed) {
      throw new Error("Gemini model resolved without model metadata.");
    }
    raw = geminiRaw;
    modelUsed = geminiModelUsed;
  } else {
    throw new Error("No AI API key configured. Set OPENAI_API_KEY or GEMINI_API_KEY.");
  }

  // Log full AI output for server-side debugging
  console.log("[ai] Full AI response:", raw);
  raw = enforceStrictJsonOnly(raw);

  const parsed = parseRecommendationFromRaw(raw);
  if (parsed) {
    return sanitizeRecommendationFields({
      outfit: parsed.outfit ?? "Unable to generate outfit recommendation.",
      reasoning: parsed.reasoning ?? "",
      modelUsed,
      ...(isDev ? { rawOutput: raw } : {}),
    });
  }

  const partialOutfit = extractJsonField(raw, "outfit");
  const partialReasoning = extractJsonField(raw, "reasoning");
  if (partialOutfit || partialReasoning) {
    return sanitizeRecommendationFields({
      outfit: partialOutfit ?? "Unable to generate outfit recommendation.",
      reasoning: partialReasoning ?? "",
      modelUsed,
      ...(isDev ? { rawOutput: raw } : {}),
    });
  }

  return sanitizeRecommendationFields({
    outfit: "Unable to generate outfit recommendation.",
    reasoning: raw.trim(),
    modelUsed,
    ...(isDev ? { rawOutput: raw } : {}),
  });
}
