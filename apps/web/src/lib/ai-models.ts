/** Shared model catalogue. Safe for the browser; provider clients stay in ai.ts. */
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
export type ByokProvider = ModelProvider | "anthropic";
export const BYOK_PROVIDERS = ["openai", "gemini", "mistral", "anthropic"] as const;
export const ANTHROPIC_BYOK_MODEL = "claude-haiku-4-5-20251001";
export type ModelID = ModelConfig["id"];

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
