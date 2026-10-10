export class RecommendationOutputError extends Error {
  constructor() {
    super("The AI response was incomplete. Please try again; no recommendation allowance was used.");
    this.name = "RecommendationOutputError";
  }
}

/** Validate before settlement, including output recovered from provider JSON. */
export function requireUsableRecommendation<T extends { outfit?: unknown; reasoning?: unknown }>(value: T | null): T & { outfit: string; reasoning: string } {
  if (!value || typeof value.outfit !== "string" || !value.outfit.trim() ||
      typeof value.reasoning !== "string" || !value.reasoning.trim() ||
      /^(unable to generate outfit recommendation\.?|undefined|null)$/i.test(value.outfit.trim())) {
    throw new RecommendationOutputError();
  }
  return { ...value, outfit: value.outfit.trim(), reasoning: value.reasoning.trim() };
}
