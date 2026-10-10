import { MODEL_PRIORITIES, ANTHROPIC_BYOK_MODEL, getModelById, type ModelConfig, type ModelProvider, type ByokProvider, type ModelID } from "./ai-models";
export * from "./ai-models";
import { parseOutfitDetails, ownedRecommendation, type OutfitDetails } from "./outfits";
import { displayMeasurement } from "./weather-measurements";
import type { WardrobeItem } from "./wardrobe";
import { requireUsableRecommendation } from "./recommendation-validation";
/**
 * AI styling logic.
 * Builds a prompt from weather data + closet items, then calls the configured AI API.
 * Supports OpenAI (OPENAI_API_KEY), Google Gemini (GEMINI_API_KEY), and Mistral AI (MISTRAL_API_KEY).
 * OpenAI is preferred when multiple keys are present.
 * Supports BYOK (Bring Your Own Key) for Pro users.
 * 
 * Model Priority:
 * Pro: OpenAI -> Gemini/Gemma -> Mistral Large -> Mistral Small -> Ministral
 * Free: Gemini -> Mistral Small -> Ministral -> Gemma
 */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import { WeatherData } from "./weather";
import { recommendationLinkInstructions } from "./recommendation-links";
import {
  type EventForecastMatch,
  type RecommendationContext,
  formatEventLocalTime,
  formatRecommendationContext,
  selectFutureHourlyForecast,
  matchWindowForecast,
} from "./recommendation-context";

// Singleton instances for server-side clients
let _openai: OpenAI | null = null;
let _gemini: GoogleGenerativeAI | null = null;
let _mistral: Mistral | null = null;

function getOpenAI(apiKey?: string): OpenAI {
  if (apiKey) return new OpenAI({ apiKey });
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

function getGemini(apiKey?: string): GoogleGenerativeAI {
  if (apiKey) return new GoogleGenerativeAI(apiKey);
  if (!_gemini) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    _gemini = new GoogleGenerativeAI(key);
  }
  return _gemini;
}

function getMistral(apiKey?: string): Mistral {
  if (apiKey) return new Mistral({ apiKey });
  if (!_mistral) {
    const key = process.env.MISTRAL_API_KEY;
    if (!key) throw new Error("MISTRAL_API_KEY is not set");
    _mistral = new Mistral({ apiKey: key });
  }
  return _mistral;
}

const DEFAULT_SYSTEM_PROMPT = `You are Sky Style — an expert personal stylist and meteorologist.
Given weather conditions and a user's wardrobe, recommend a specific outfit.
Your response MUST be a JSON object with exactly two keys:
  "outfit": a concise outfit recommendation (max 120 words)
  "reasoning": a brief explanation linking weather facts to clothing choices (max 160 words)

Be specific (name garment types, colours, materials). Be friendly and concise. Output ONLY the raw JSON object with no preface or trailing text. Never include phrases like "Here is the JSON requested", "Here's the JSON", "Below is the JSON", or any similar lead-in.`;

const MAX_JSON_LEAD_IN_CHARS = 120;
// Matches assistant lead-in prose that references "json" before the actual payload.
const JSON_LEAD_IN_PATTERN = `(?:^|\\n)\\s*(?:here(?:[''’]s| is| are)|below is|this is|sure|certainly|okay|ok)\\b[^\\n{}]{0,${MAX_JSON_LEAD_IN_CHARS}}\\bjson\\b[^\\n{}]{0,${MAX_JSON_LEAD_IN_CHARS}}(?::|-)?\\s*`;
const JSON_LEAD_IN_TEST_REGEX = new RegExp(JSON_LEAD_IN_PATTERN, "i");
const JSON_LEAD_IN_REPLACE_REGEX = new RegExp(JSON_LEAD_IN_PATTERN, "gi");
const JSON_LEAD_IN_AT_START_REGEX = new RegExp(
  `^\\s*(?:(?:here(?:[''’]s| is| are)|below is|this is|sure|certainly|okay|ok)\\b[^\\n{}]{0,${MAX_JSON_LEAD_IN_CHARS}}\\bjson\\b[^\\n{}]{0,${MAX_JSON_LEAD_IN_CHARS}}|(?:the\\s+)?json\\s+(?:you\\s+)?requested)\\s*(?::|-)?\\s*`,
  "i"
);

function normalizeRecommendationText(value: unknown): string {
  if (typeof value === "string") {
    return value
      .replace(/\\r?\\n/g, "\n")
      .replace(/(^|\n)(#{1,4})(?![\s#])(?=\S)/g, "$1$2 ");
  }
  if (Array.isArray(value)) {
    return value.map(normalizeRecommendationText).filter(Boolean).join("\n");
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `## ${key.replace(/[-_]+/g, " ")}\n${normalizeRecommendationText(item)}`)
      .join("\n\n");
  }
  return "";
}

/** Remove forbidden JSON lead-in phrasing from the start of a text field. */
function stripForbiddenJsonLeadIn(value: unknown): string {
  const text = normalizeRecommendationText(value);
  if (!text) return text;
  return text.replace(JSON_LEAD_IN_AT_START_REGEX, "").trimStart();
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
function sanitizeRecommendationFields(recommendation: StyleRecommendation, validate = true): StyleRecommendation {
  return {
    ...recommendation,
    ...(validate ? requireUsableRecommendation({outfit:stripForbiddenJsonLeadIn(recommendation.outfit),reasoning:stripForbiddenJsonLeadIn(recommendation.reasoning)}) : {outfit:stripForbiddenJsonLeadIn(recommendation.outfit),reasoning:stripForbiddenJsonLeadIn(recommendation.reasoning)}),
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
  wardrobeItems?: WardrobeItem[];
  structuredOutfit?: boolean;
  unitPreference: "metric" | "imperial";
  customSystemPrompt?: string;
  /** Pro BYOK: user-provided AI API key (not saved, used for this request only) */
  userApiKey?: string;
  /** Pro/Dev client-side custom prompt (localStorage only, never persisted server-side) */
  clientCustomPrompt?: string;
  /** Which provider to use for the BYOK key ("openai" | "gemini" | "mistral", defaults to "openai") */
  byokProvider?: ByokProvider;
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
  /** Validated V6 planning context supplied for this recommendation. */
  recommendationContext?: RecommendationContext;
  /** Event-to-hour match computed from the fetched forecast. */
  eventForecast?: EventForecastMatch;
  /** Specific model to use (for model switching feature) */
  modelId?: ModelID;
}

export interface FollowUpInput {
  closetItems?: string[];
  wardrobeItems?: WardrobeItem[];
  structuredOutfit?: boolean;
  forceCloset?: boolean;
  previousOutfit: string;
  previousReasoning: string;
  weather: WeatherData;
  followUpMessage: string;
  unitPreference: "metric" | "imperial";
  customSystemPrompt?: string;
  userApiKey?: string;
  byokProvider?: ByokProvider;
  recommendationContext?: RecommendationContext;
  eventForecast?: EventForecastMatch;
  /** Dev mode: include raw AI output in response */
  isDev?: boolean;
  /** Specific model to use (for model switching feature) */
  modelId?: ModelID;
}

export interface StyleRecommendation {
  details?: OutfitDetails;
  chargeable?: boolean;
  outfit: string;
  reasoning: string;
  /** Raw AI output — only included for dev mode users */
  rawOutput?: string;
  /** Warning shown when force-closet mode has very limited items */
  closetWarning?: string;
  /** AI model used for this response */
  modelUsed?: string;
}

/** Retry a provider response that hit its output limit with enough room to finish its JSON. */
function getRetryTokenBudget(maxTokens: number): number {
  return Math.max(maxTokens * 2, 1_800);
}

function geminiResponseWasTruncated(response: {
  candidates?: Array<{ finishReason?: string }>;
}): boolean {
  return response.candidates?.some(
    (candidate) => candidate.finishReason === "MAX_TOKENS"
  ) ?? false;
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

function formatWind(kmh: number | null, unit: "metric" | "imperial"): string {
  if (kmh === null) return "unavailable";
  if (unit === "imperial") {
    const mph = Math.round(kmh * 0.621371);
    return `${mph} mph`;
  }
  return `${kmh} km/h`;
}

function normalizeMessageContent(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    const text = content
      .map((chunk) => {
        if (chunk && typeof chunk === "object" && "text" in chunk) {
          const value = (chunk as { text?: unknown }).text;
          return typeof value === "string" ? value : "";
        }
        return "";
      })
      .join("");

    return text || "{}";
  }

  return "{}";
}

/** Call AI with a specific model or use default priority */
export async function callAIWithModel(
  systemPrompt: string,
  userMessage: string,
  userApiKey: string | undefined,
  isDev: boolean,
  modelId: ModelID | undefined,
  byokProvider: ByokProvider | undefined,
  maxTokens: number
): Promise<{ raw: string; modelUsed: string }> {
  // Never send one provider's user key to a different provider or silently fall
  // back to a server key. BYOK also takes precedence over the hosted default.
  if (userApiKey) {
    const provider = byokProvider || "openai";
    if (provider === "anthropic") return callAnthropic(systemPrompt, userMessage, userApiKey, maxTokens);
    const requested = modelId ? getModelById(modelId) : undefined;
    const model = requested?.provider === provider ? requested : MODEL_PRIORITIES.pro.find((entry) => entry.provider === provider)!;
    return callSpecificModel(systemPrompt, userMessage, userApiKey, isDev, model, maxTokens);
  }
  // If a specific model is requested, use it
  if (modelId) {
    const model = getModelById(modelId);
    if (model) {
      return callSpecificModel(systemPrompt, userMessage, userApiKey, isDev, model, maxTokens);
    }
  }

  // Try server keys in priority order
  for (const tier of ["pro", "free"] as const) {
    for (const model of MODEL_PRIORITIES[tier]) {
      try {
        const result = await callSpecificModel(systemPrompt, userMessage, undefined, isDev, model, maxTokens);
        return result;
      } catch (err) {
        console.warn(`[ai] Model ${model.id} failed:`, err instanceof Error ? err.message : err);
        // Continue to next model
      }
    }
  }

  throw new Error("No AI API key configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or MISTRAL_API_KEY.");
}

/** Call a specific AI model */
async function callSpecificModel(
  systemPrompt: string,
  userMessage: string,
  userApiKey: string | undefined,
  isDev: boolean,
  model: ModelConfig,
  maxTokens: number
): Promise<{ raw: string; modelUsed: string }> {
  const provider = model.provider;
  const modelId = model.id;

  return callProvider(systemPrompt, userMessage, userApiKey, isDev, provider, maxTokens, modelId);
}

/** Call a specific AI provider */
async function callProvider(
  systemPrompt: string,
  userMessage: string,
  userApiKey: string | undefined,
  isDev: boolean,
  provider: ModelProvider,
  maxTokens: number,
  modelId: string
): Promise<{ raw: string; modelUsed: string }> {
  switch (provider) {
    case "openai":
      return callOpenAI(systemPrompt, userMessage, userApiKey, maxTokens, modelId);
    case "gemini":
      return callGemini(systemPrompt, userMessage, userApiKey, maxTokens, modelId);
    case "mistral":
      return callMistral(systemPrompt, userMessage, userApiKey, maxTokens, modelId);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/** Call OpenAI API */
async function callAnthropic(system: string, message: string, key: string, maxTokens: number): Promise<{ raw: string; modelUsed: string }> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", cache: "no-store", signal: AbortSignal.timeout(30_000),
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({ model: ANTHROPIC_BYOK_MODEL, max_tokens: maxTokens, system: `${system}\nReturn only valid JSON, without code fences.`, messages: [{ role: "user", content: message }] }),
  });
  // Provider bodies can contain request data: never forward/log them or the key.
  if (!response.ok) throw new Error(`Anthropic request failed (HTTP ${response.status}). Check your key and provider quota.`);
  const data = await response.json() as { content?: { type?: string; text?: string }[]; stop_reason?: string };
  if (data.stop_reason === "max_tokens") throw new Error("Anthropic response was incomplete. Please try a shorter request.");
  const raw = data.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("");
  if (!raw?.trim()) throw new Error("Anthropic returned no text.");
  return { raw, modelUsed: ANTHROPIC_BYOK_MODEL };
}

/** Call OpenAI API */
async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  userApiKey: string | undefined,
  maxTokens: number,
  modelId: string
): Promise<{ raw: string; modelUsed: string }> {
  const openai = getOpenAI(userApiKey);
  const createResponse = (outputTokens: number) => openai.chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    response_format: { type: "json_object" },
    max_tokens: outputTokens,
    temperature: 0.7,
  });
  let response = await createResponse(maxTokens);
  if (response.choices[0]?.finish_reason === "length") {
    console.warn(`[ai] OpenAI response reached its ${maxTokens}-token limit; retrying with more room.`);
    response = await createResponse(getRetryTokenBudget(maxTokens));
  }
  return {
    raw: normalizeMessageContent(response.choices[0]?.message?.content),
    modelUsed: modelId,
  };
}

/** Call Google Gemini API */
async function callGemini(
  systemPrompt: string,
  userMessage: string,
  userApiKey: string | undefined,
  maxTokens: number,
  modelId: string
): Promise<{ raw: string; modelUsed: string }> {
  const gemini = getGemini(userApiKey);
  const createResponse = (outputTokens: number) => {
    const model = gemini.getGenerativeModel({
      model: modelId,
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: outputTokens },
    });
    return model.generateContent(`${systemPrompt}\n\n${userMessage}`);
  };
  let result = await createResponse(maxTokens);
  if (geminiResponseWasTruncated(result.response)) {
    console.warn(`[ai] Gemini response reached its ${maxTokens}-token limit; retrying with more room.`);
    result = await createResponse(getRetryTokenBudget(maxTokens));
  }
  return {
    raw: result.response.text(),
    modelUsed: modelId,
  };
}

/** Call Mistral AI API */
async function callMistral(
  systemPrompt: string,
  userMessage: string,
  userApiKey: string | undefined,
  maxTokens: number,
  modelId: string
): Promise<{ raw: string; modelUsed: string }> {
  const mistral = getMistral(userApiKey);
  const response = await mistral.chat.complete({
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    responseFormat: { type: "json_object" },
    maxTokens: maxTokens,
    temperature: 0.7,
  });
  return {
    raw: normalizeMessageContent(response.choices[0]?.message?.content),
    modelUsed: modelId,
  };
}

export async function getStyleRecommendation(
  input: StyleInput
): Promise<StyleRecommendation> {
  const {
    weather, closetItems, unitPreference, customSystemPrompt, clientCustomPrompt,
    userApiKey, byokProvider, gender, shareLocation, forceCloset, customContext, planningData,
    recommendationContext, eventForecast, modelId,
  } = input;
  const isDev = input.isDev === true;
  let closetWarning: string | undefined;
  if (forceCloset) {
    if (closetItems.length === 0) {
      closetWarning = "Your wardrobe is empty. Add items to build an owned-only outfit.";
    } else if (closetItems.length === 1) {
      closetWarning = "Your wardrobe may need more pieces for a complete outfit.";
    }
  }

  // Client-side custom prompt takes precedence over DB-stored one (Pro/Dev only)
  const systemPrompt = (clientCustomPrompt ?? customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT) + recommendationLinkInstructions(closetItems, input.wardrobeItems) + structuredInstructions(input.wardrobeItems, input.structuredOutfit || forceCloset);

  const closetSection =
    closetItems.length > 0
      ? forceCloset
        ? `\nCRITICAL INSTRUCTION: You MUST build the entire outfit EXCLUSIVELY from the items listed below. Do NOT suggest, imply, or reference ANY clothing item not explicitly in this list. If the available items are insufficient for a complete outfit, explicitly tell the user which items are missing rather than inventing new ones. Violating this instruction is not acceptable under any circumstances.\nUser's available wardrobe:\n${closetItems.map((i) => `- ${i}`).join("\n")}`
        : `\nUser's available wardrobe (you may also suggest items not listed here):\n${closetItems.map((i) => `- ${i}`).join("\n")}`
      : forceCloset ? "\nThe available wardrobe is empty. Return no clothing slots and explain the wardrobe gap. Do not invent owned items." : "\nUser has not added any wardrobe items — suggest general clothing.";

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
          `- ${s.source}: ${formatTemp(s.temp, unitPreference)}, feels like ${formatTemp(s.feelsLike, unitPreference)}, humidity ${displayMeasurement(s.humidity,"%")}, wind ${formatWind(s.windSpeed, unitPreference)}, rain ${displayMeasurement(s.rainChance,"%")}, "${s.description}"`
      )
      .join("\n")}`;
  }

  // Include hourly forecast if available
  let hourlySection = "";
  const windowForecast = matchWindowForecast(weather.hourly, recommendationContext?.window);
  if (recommendationContext?.window) hourlySection = `\nWindow coverage: ${windowForecast.status}. Use only these covered hourly measurements: ${JSON.stringify(windowForecast.hours)}. Explicitly label uncovered hours; do not use current conditions as their forecast.`;
  if (!recommendationContext?.window && weather.hourly && weather.hourly.length > 0) {
    const nextHours = selectFutureHourlyForecast(weather.hourly, Date.now(), 12);
    hourlySection = `\n\nHourly forecast (next ${nextHours.length} hours):\n${nextHours
      .map(
        (h) =>
          `- ${h.time}: ${formatTemp(h.temp, unitPreference)}, ${h.description}, rain ${displayMeasurement(h.rainChance,"%")}, wind ${formatWind(h.windSpeed, unitPreference)}`
      )
      .join("\n")}`;
  }

  let eventForecastSection = "";
  if (recommendationContext?.event && eventForecast?.status === "matched" && eventForecast.hour) {
    const hour = eventForecast.hour;
    eventForecastSection = `\n\nForecast nearest the requested event time:\n- ${formatEventLocalTime(hour.time, recommendationContext.event.timeZone)}: ${formatTemp(hour.temp, unitPreference)}, ${hour.description}, rain ${displayMeasurement(hour.rainChance,"%")}, wind ${formatWind(hour.windSpeed, unitPreference)}\nUse this event forecast and local time, rather than current conditions, for event-specific clothing advice.`;
  } else if (recommendationContext?.event && eventForecast?.status === "unavailable") {
    eventForecastSection = "\n\nThe requested event is outside the available hourly forecast range. Do not describe current conditions as the event forecast. Give general occasion advice and tell the user to refresh closer to the event for weather-specific guidance.";
  }

  const recommendationContextSection = formatRecommendationContext(recommendationContext);

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
- Humidity: ${displayMeasurement(weather.humidity,"%")}
- Wind: ${formatWind(weather.windSpeed, unitPreference)} from ${weather.windDir}
- Conditions: ${weather.description}
- Rain chance: ${displayMeasurement(weather.rainChance,"%")}
- UV Index: ${displayMeasurement(weather.uvIndex)}
- Time of day: ${weather.isDay ? "Daytime" : "Night-time"}${genderSection}${locationSection}${alertSection}${sourcesSection}${hourlySection}${eventForecastSection}${customContextSection}${planningSection}${recommendationContextSection}${closetSection}

${complexityInstruction}

Please recommend an outfit.`;

  // Token budget scales with complexity. Pro permits up to 300 words in each
  // JSON field, so 900 tokens can cut the response off before it closes the
  // JSON object. Leave enough room for the full recommendation and Markdown.
  const MAX_TOKENS_BY_COMPLEXITY: Record<number, number> = { 0: 300, 1: 600, 2: 1_000, 3: 1_800 };
  const maxTokens = input.structuredOutfit || forceCloset ? Math.max(1200, MAX_TOKENS_BY_COMPLEXITY[complexityLevel] ?? 350) : MAX_TOKENS_BY_COMPLEXITY[complexityLevel] ?? 350;

  const { raw, modelUsed } = await callAIWithModel(
    systemPrompt, userMessage, userApiKey, isDev, modelId, byokProvider, maxTokens
  );
  
  const recommendation = validateStructuredResponse(parseRecommendationFromRaw(raw), input.wardrobeItems, input.structuredOutfit || forceCloset, forceCloset === true);
  return sanitizeRecommendationFields({ ...recommendation, modelUsed, ...(closetWarning ? { closetWarning } : {}), ...(isDev ? { rawOutput: raw } : {}) });
}

/** Dev mode: send a freeform message to the AI without weather context */
export async function getDevChatResponse(
  message: string,
  userApiKey?: string,
  modelId?: ModelID,
  byokProvider?: ByokProvider
): Promise<StyleRecommendation> {
  const { raw, modelUsed } = await callAIWithModel(
    DEFAULT_SYSTEM_PROMPT, message, userApiKey, true, modelId, byokProvider, 500
  );
  const recommendation = parseRecommendationFromRaw(raw);
  return sanitizeRecommendationFields({
    outfit: recommendation?.outfit ?? raw.trim(),
    reasoning: recommendation?.reasoning ?? "",
    modelUsed,
    rawOutput: raw,
  }, false);
}

/** Follow-up: modify an existing recommendation based on user input */
export async function getFollowUpRecommendation(
  input: FollowUpInput
): Promise<StyleRecommendation> {
  const {
    previousOutfit, previousReasoning, weather, followUpMessage, unitPreference,
    customSystemPrompt, userApiKey, byokProvider, recommendationContext, eventForecast, modelId,
  } = input;
  const isDev = input.isDev === true;
  const systemPrompt = (customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT) + recommendationLinkInstructions(input.closetItems ?? [], input.wardrobeItems) + structuredInstructions(input.wardrobeItems, input.structuredOutfit || input.forceCloset);

  const recommendationContextSection = formatRecommendationContext(recommendationContext);
  const eventForecastSection = recommendationContext?.event && eventForecast?.status === "unavailable"
    ? "\nThe event remains outside the available forecast range. Do not present current weather as the event forecast."
    : recommendationContext?.event && eventForecast?.status === "matched" && eventForecast.hour
      ? `\nForecast nearest the event: ${formatEventLocalTime(eventForecast.hour.time, recommendationContext.event.timeZone)}, ${formatTemp(eventForecast.hour.temp, unitPreference)}, ${eventForecast.hour.description}, rain ${displayMeasurement(eventForecast.hour.rainChance,"%")}.`
      : "";

  const userMessage = `Previous outfit recommendation:
${previousOutfit}

Previous reasoning:
${previousReasoning}

Current weather: ${formatTemp(weather.temp, unitPreference)}, ${weather.description}, rain chance ${displayMeasurement(weather.rainChance,"%")}, wind ${formatWind(weather.windSpeed, unitPreference)}
${recommendationContextSection}${eventForecastSection}

User follow-up question: "${followUpMessage}"

Please update the outfit recommendation based on the follow-up question. Respond with the same JSON format.`;

  const { raw, modelUsed } = await callAIWithModel(
    systemPrompt, userMessage, userApiKey, isDev, modelId, byokProvider, input.structuredOutfit || input.forceCloset ? 1200 : 500
  );
  
  const recommendation = validateStructuredResponse(parseRecommendationFromRaw(raw), input.wardrobeItems, input.structuredOutfit || input.forceCloset, input.forceCloset === true);
  return sanitizeRecommendationFields({ ...recommendation, modelUsed,  ...(isDev ? { rawOutput: raw } : {}) });
}

function structuredInstructions(wardrobe: WardrobeItem[] | undefined, structured: boolean | undefined) {
  if (!structured) return "";
  return `\nReturn JSON with outfit, reasoning and details. details contains slots (up to 12 objects with id: a unique short lowercase slot name, category: top/bottom/one-piece/outerwear/footwear/accessory/other, label: description, itemId: exact available wardrobe UUID or null for a general suggestion), gaps: string[], bring: string[], changes: string[]. Keep lists short. Unknown item attributes are unknown, not promises. Honour explicit comfort restrictions; list unmet restrictions as gaps. Only claim waterproof protection for verified waterproof items. Available wardrobe data: ${JSON.stringify((wardrobe ?? []).filter(item => item.available))}.`;
}
function validateStructuredResponse(raw: Partial<StyleRecommendation> | null, wardrobe: WardrobeItem[] | undefined, structured: boolean | undefined, ownedOnly: boolean): StyleRecommendation {
  if (!structured) return requireUsableRecommendation(raw);
  const details = parseOutfitDetails(raw?.details, wardrobe ?? [], ownedOnly);
  if (ownedOnly) {
    const labels = new Set((wardrobe ?? []).filter(item=>item.available).map(item=>item.label.toLowerCase()));
    details.bring = details.bring.filter(label=>labels.has(label.toLowerCase()));
    // Provider prose cannot introduce unverified clothing in owned-only advice.
    details.changes = details.slots.filter(slot=>slot.category === "outerwear").map(slot=>`Adjust ${slot.label} as conditions change.`);
    return { ...ownedRecommendation(details), details, chargeable: details.gaps.length === 0 };
  }
  return { ...requireUsableRecommendation(raw), details, chargeable: details.gaps.length === 0 };
}
