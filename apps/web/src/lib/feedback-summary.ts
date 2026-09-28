import { MAX_FEEDBACK_ADVICE, MAX_FEEDBACK_NOTE, MAX_FEEDBACK_SUMMARY, type StyleVote } from "./style-feedback";

export interface SummaryInput {
  vote: StyleVote;
  note: string;
  advice?: string;
}

/** Bound third-party processing to recent, user-authored feedback only. */
export function parseSummaryInput(input: unknown): SummaryInput[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > 20) return null;
  const entries: SummaryInput[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    if (row.vote !== "up" && row.vote !== "down") return null;
    if (typeof row.note !== "string" || row.note.length > MAX_FEEDBACK_NOTE) return null;
    if (row.advice !== undefined && (typeof row.advice !== "string" || row.advice.length > MAX_FEEDBACK_ADVICE)) return null;
    entries.push({ vote: row.vote, note: row.note.trim(), ...(typeof row.advice === "string" ? { advice: row.advice } : {}) });
  }
  return entries;
}

export function parseMistralSummary(content: unknown): string | null {
  if (typeof content !== "string") return null;
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const summary = (parsed as Record<string, unknown>).summary;
    return typeof summary === "string" && summary.trim()
      ? summary.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_FEEDBACK_SUMMARY)
      : null;
  } catch {
    return null;
  }
}
