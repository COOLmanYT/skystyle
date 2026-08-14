/**
 * AI styling logic.
 * Builds a prompt from weather data + closet items, then calls the configured AI API.
 * Supports OpenAI (OPENAI_API_KEY), Google Gemini (GEMINI_API_KEY), and Mistral AI (MISTRAL_API_KEY).
 * OpenAI is preferred when multiple keys are present.
 * Supports BYOK (Bring Your Own Key) for Pro users.
 * 
 * Model Priority:
 * Pro: OpenAI -> Gemini -> Mistral Large -> Gemma -> Mistral Small -> Ministral
 * Free: Gemini -> Mistral Small -> Gemma -> Ministral
 */

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import { WeatherData } from "./weather";

// Model definitions and priorities
export const MODEL_PRIORITIES = {
  pro: [
    // OpenAI models
    { id: "gpt-4o", provider: "openai" as const, name: "GPT-4o" },
    { id: "gpt-4o-mini", provider: "openai" as const, name: "GPT-4o Mini" },
    // Gemini models
    { id: "gemini-2.5-flash", provider: "gemini" as const, name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", provider: "gemini" as const, name: "Gemini 2.5 Flash Lite" },
    { id: "gemma-4-31b-it", provider: "gemini" as const, name: "Gemma 4 31B" },
    { id: "gemma-4-26b-it", provider: "gemini" as const, name: "Gemma 4 26B" },
    // Mistral models
    { id: "mistral-large-latest", provider: "mistral" as const, name: "Mistral Large" },
    { id: "mistral-small-latest", provider: "mistral" as const, name: "Mistral Small" },
    { id: "ministral-8b-latest", provider: "mistral" as const, name: "Ministral 8B" },
  ],
  free: [
    // Gemini models (free tier available)
    { id: "gemini-2.5-flash", provider: "gemini" as const, name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", provider: "gemini" as const, name: "Gemini 2.5 Flash Lite" },
    // Mistral models (free tier available)
    { id: "mistral-small-latest", provider: "mistral" as const, name: "Mistral Small" },
    { id: "ministral-8b-latest", provider: "mistral" as const, name: "Ministral 8B" },
    { id: "gemma-4-26b-it", provider: "gemini" as const, name: "Gemma 4 26B" },
  ],
} as const;

// Extract model ID type from the priorities
export type ModelConfig = (typeof MODEL_PRIORITIES)[keyof typeof MODEL_PRIORITIES][number];
export type ModelProvider = ModelConfig["provider"];
export type ModelID = ModelConfig["id"];

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
  /** Which provider to use for the BYOK key ("openai" | "gemini" | "mistral", defaults to "openai") */
  byokProvider?: ModelProvider;
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
  /** Specific model to use (for model switching feature) */
  modelId?: ModelID;
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
  /** Specific model to use (for model switching feature) */
  modelId?: ModelID;
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

/** Get available models for a user based on their plan */
export function getAvailableModels(isPro: boolean, isDev: boolean, hasByok: boolean): readonly ModelConfig[] {
  const tier = isDev ? "pro" : (isPro ? "pro" : "free");
  const models = MODEL_PRIORITIES[tier as keyof typeof MODEL_PRIORITIES];
  void hasByok;
  return models;
}

/** Get all models (including unavailable ones) for display purposes */
export function getAllModels(): ModelConfig[] {
  return [...MODEL_PRIORITIES.pro, ...MODEL_PRIORITIES.free].filter(
    (model, index, all) => all.findIndex((candidate) => candidate.id === model.id) === index
  );
}

/** Check if a model is available for a user's plan */
export function isModelAvailable(modelId: ModelID, isPro: boolean, isDev: boolean): boolean {
  const tier = isDev ? "pro" : (isPro ? "pro" : "free");
  const availableModels = MODEL_PRIORITIES[tier as keyof typeof MODEL_PRIORITIES];
  return availableModels.some(m => m.id === modelId);
}

/** Get the default model for a user's plan */
export function getDefaultModel(isPro: boolean, isDev: boolean): ModelConfig {
  const tier = isDev ? "pro" : (isPro ? "pro" : "free");
  return MODEL_PRIORITIES[tier as keyof typeof MODEL_PRIORITIES][0];
}

/** Get model by ID */
export function getModelById(modelId: ModelID): ModelConfig | null {
  for (const tier of ["pro", "free"] as const) {
    const model = MODEL_PRIORITIES[tier].find(m => m.id === modelId);
    if (model) return model;
  }
  return null;
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
async function callAIWithModel(
  systemPrompt: string,
  userMessage: string,
  userApiKey: string | undefined,
  isDev: boolean,
  modelId: ModelID | undefined,
  byokProvider: ModelProvider | undefined,
  maxTokens: number
): Promise<{ raw: string; modelUsed: string }> {
  // If a specific model is requested, use it
  if (modelId) {
    const model = getModelById(modelId);
    if (model) {
      return callSpecificModel(systemPrompt, userMessage, userApiKey, isDev, model, maxTokens);
    }
  }

  // BYOK takes precedence when user provides their own key
  if (userApiKey) {
    const provider = byokProvider || "openai";
    const defaultModel = MODEL_PRIORITIES.pro.find(m => m.provider === provider) || MODEL_PRIORITIES.pro[0];
    return callSpecificModel(systemPrompt, userMessage, userApiKey, isDev, defaultModel, maxTokens);
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
    modelId,
  } = input;
  const isDev = input.isDev === true;
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

  // Token budget scales with complexity. Pro permits up to 300 words in each
  // JSON field, so 900 tokens can cut the response off before it closes the
  // JSON object. Leave enough room for the full recommendation and Markdown.
  const MAX_TOKENS_BY_COMPLEXITY: Record<number, number> = { 0: 300, 1: 600, 2: 1_000, 3: 1_800 };
  const maxTokens = MAX_TOKENS_BY_COMPLEXITY[complexityLevel] ?? 350;

  const { raw, modelUsed } = await callAIWithModel(
    systemPrompt, userMessage, userApiKey, isDev, modelId, byokProvider, maxTokens
  );
  
  const recommendation = parseRecommendationFromRaw(raw);
  if (recommendation) {
    return sanitizeRecommendationFields({
      outfit: recommendation.outfit ?? "Unable to generate outfit recommendation.",
      reasoning: recommendation.reasoning ?? "",
      modelUsed,
      ...(closetWarning ? { closetWarning } : {}),
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
      ...(closetWarning ? { closetWarning } : {}),
      ...(isDev ? { rawOutput: raw } : {}),
    });
  }

  return sanitizeRecommendationFields({
    outfit: "Unable to generate outfit recommendation.",
    reasoning: raw.trim(),
    modelUsed,
    ...(closetWarning ? { closetWarning } : {}),
    ...(isDev ? { rawOutput: raw } : {}),
  });
}

/** Dev mode: send a freeform message to the AI without weather context */
export async function getDevChatResponse(
  message: string,
  userApiKey?: string,
  modelId?: ModelID
): Promise<StyleRecommendation> {
  const { raw, modelUsed } = await callAIWithModel(
    DEFAULT_SYSTEM_PROMPT, message, userApiKey, true, modelId, undefined, 500
  );
  const recommendation = parseRecommendationFromRaw(raw);
  return sanitizeRecommendationFields({
    outfit: recommendation?.outfit ?? raw.trim(),
    reasoning: recommendation?.reasoning ?? "",
    modelUsed,
    rawOutput: raw,
  });
}

/** Follow-up: modify an existing recommendation based on user input */
export async function getFollowUpRecommendation(
  input: FollowUpInput
): Promise<StyleRecommendation> {
  const { previousOutfit, previousReasoning, weather, followUpMessage, unitPreference, customSystemPrompt, userApiKey, modelId } = input;
  const isDev = input.isDev === true;
  const systemPrompt = customSystemPrompt ?? DEFAULT_SYSTEM_PROMPT;

  const userMessage = `Previous outfit recommendation:
${previousOutfit}

Previous reasoning:
${previousReasoning}

Current weather: ${formatTemp(weather.temp, unitPreference)}, ${weather.description}, rain chance ${weather.rainChance}%, wind ${formatWind(weather.windSpeed, unitPreference)}

User follow-up question: "${followUpMessage}"

Please update the outfit recommendation based on the follow-up question. Respond with the same JSON format.`;

  const { raw, modelUsed } = await callAIWithModel(
    systemPrompt, userMessage, userApiKey, isDev, modelId, undefined, 500
  );
  
  const recommendation = parseRecommendationFromRaw(raw);
  if (recommendation) {
    return sanitizeRecommendationFields({
      outfit: recommendation.outfit ?? "Unable to generate outfit recommendation.",
      reasoning: recommendation.reasoning ?? "",
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
