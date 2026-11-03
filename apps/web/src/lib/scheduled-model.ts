import { getAvailableModels, type ModelConfig } from "./ai";

/** Scheduled jobs have no BYOK credential; choose a configured hosted model. */
export function getScheduledModel(isPro: boolean, isDev: boolean): ModelConfig {
  const keys = {
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    mistral: process.env.MISTRAL_API_KEY,
  };
  const model = getAvailableModels(isPro, isDev, false).find(
    (candidate) => Boolean(keys[candidate.provider]?.trim()),
  );
  if (!model) throw new Error("No hosted AI provider is configured for automatic recommendations.");
  return model;
}
