export type StyleVote = "up" | "down";

export interface StyleFeedbackEntry {
  id: string;
  vote: StyleVote;
  note: string;
  advice?: string;
  createdAt: string;
}

export interface LocalStyleFeedback {
  entries: StyleFeedbackEntry[];
  summary: string;
}

export const MAX_FEEDBACK_NOTE = 500;
export const MAX_FEEDBACK_ADVICE = 1500;
export const MAX_FEEDBACK_SUMMARY = 600;
// Capacity, not a retention policy: never silently evict old feedback.
export const MAX_CLOUD_FEEDBACK_ENTRIES = 10000;

export function styleFeedbackKey(userId: string): string {
  return `skystyle_style_feedback_v1_${encodeURIComponent(userId)}`;
}

/** Strict server validation; do not accept caller-supplied ownership or arbitrary JSON. */
export function parseCloudStyleFeedback(value: unknown): LocalStyleFeedback | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.entries) || data.entries.length > MAX_CLOUD_FEEDBACK_ENTRIES
    || typeof data.summary !== "string" || data.summary.length > MAX_FEEDBACK_SUMMARY) return null;
  const ids = new Set<string>();
  const entries: StyleFeedbackEntry[] = [];
  for (const item of data.entries) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(entry.id) || ids.has(entry.id)
      || (entry.vote !== "up" && entry.vote !== "down")
      || typeof entry.note !== "string" || entry.note.length > MAX_FEEDBACK_NOTE
      || (entry.advice !== undefined && (typeof entry.advice !== "string" || entry.advice.length > MAX_FEEDBACK_ADVICE))
      || typeof entry.createdAt !== "string" || entry.createdAt.length > 40
      || !Number.isFinite(Date.parse(entry.createdAt))) return null;
    ids.add(entry.id);
    entries.push({ id: entry.id, vote: entry.vote, note: entry.note, createdAt: entry.createdAt,
      ...(typeof entry.advice === "string" ? { advice: entry.advice } : {}) });
  }
  return { entries, summary: data.summary };
}

export function parseLocalStyleFeedback(value: string | null): LocalStyleFeedback {
  if (!value) return { entries: [], summary: "" };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid feedback");
    const data = parsed as Record<string, unknown>;
    const entries = Array.isArray(data.entries) ? data.entries.filter((entry): entry is StyleFeedbackEntry =>
      !!entry && typeof entry === "object" && (entry.vote === "up" || entry.vote === "down")
      && typeof entry.id === "string" && typeof entry.note === "string"
      && typeof entry.createdAt === "string"
    ).map((entry) => ({ id: entry.id, vote: entry.vote, createdAt: entry.createdAt,
      note: entry.note.slice(0, MAX_FEEDBACK_NOTE),
      ...(typeof entry.advice === "string" ? { advice: entry.advice.slice(0, MAX_FEEDBACK_ADVICE) } : {}) })) : [];
    const summary = typeof data.summary === "string" ? data.summary.slice(0, MAX_FEEDBACK_SUMMARY) : "";
    return { entries, summary };
  } catch {
    return { entries: [], summary: "" };
  }
}

export function withoutFeedbackEntry(data: LocalStyleFeedback, id: string): LocalStyleFeedback {
  return { entries: data.entries.filter((entry) => entry.id !== id), summary: "" };
}
