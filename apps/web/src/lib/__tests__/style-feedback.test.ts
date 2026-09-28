import { parseCloudStyleFeedback, parseLocalStyleFeedback, styleFeedbackKey, withoutFeedbackEntry } from "../style-feedback";

describe("local style feedback", () => {
  it("scopes storage to the signed-in user and defaults to empty", () => {
    expect(styleFeedbackKey("user-a")).not.toBe(styleFeedbackKey("user-b"));
    expect(parseLocalStyleFeedback(null)).toEqual({ entries: [], summary: "" });
  });

  it("ignores malformed records and bounds text", () => {
    expect(parseLocalStyleFeedback("{")).toEqual({ entries: [], summary: "" });
    const parsed = parseLocalStyleFeedback(JSON.stringify({
      entries: [
        { id: "1", vote: "down", note: "x".repeat(700), createdAt: "2026-09-28T00:00:00Z" },
        { id: "2", vote: "invalid", note: "bad", createdAt: "now" },
      ],
      summary: "y".repeat(700),
    }));
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].note).toHaveLength(500);
    expect(parsed.summary).toHaveLength(600);
  });

  it("clears the derived summary when a vote is deleted", () => {
    const data = {
      entries: [{ id: "1", vote: "down" as const, note: "Too long", createdAt: "2026-09-28T00:00:00Z" }],
      summary: "User prefers brief advice",
    };
    expect(withoutFeedbackEntry(data, "1")).toEqual({ entries: [], summary: "" });
  });

  it("strictly validates cloud entries without expiring old valid records", () => {
    const entry = { id: "a", vote: "down", note: "Brief please", createdAt: "2020-01-01T00:00:00Z" };
    expect(parseCloudStyleFeedback({ entries: [entry], summary: "Brief" })).toEqual({ entries: [entry], summary: "Brief" });
    expect(parseCloudStyleFeedback({ entries: [entry, entry], summary: "" })).toBeNull();
    expect(parseCloudStyleFeedback({ entries: [{ ...entry, createdAt: "invalid" }], summary: "" })).toBeNull();
    expect(parseCloudStyleFeedback({ entries: [{ ...entry, note: "x".repeat(501) }], summary: "" })).toBeNull();
  });
});
