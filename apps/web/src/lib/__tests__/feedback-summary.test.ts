import { parseMistralSummary, parseSummaryInput } from "../feedback-summary";

describe("style feedback summarization", () => {
  it("accepts bounded votes and rejects malformed or excessive requests", () => {
    expect(parseSummaryInput([{ vote: "down", note: "Too detailed" }])).toEqual([{ vote: "down", note: "Too detailed" }]);
    expect(parseSummaryInput([{ vote: "other", note: "x" }])).toBeNull();
    expect(parseSummaryInput([{ vote: "up", note: "x".repeat(501) }])).toBeNull();
    expect(parseSummaryInput(Array.from({ length: 21 }, () => ({ vote: "up", note: "" })))).toBeNull();
  });

  it("accepts only a nonempty bounded JSON summary", () => {
    expect(parseMistralSummary('{"summary":" Prefers brief advice. "}')).toBe("Prefers brief advice.");
    expect(parseMistralSummary('{"summary":""}')).toBeNull();
    expect(parseMistralSummary("not json")).toBeNull();
    expect(parseMistralSummary(JSON.stringify({ summary: "x".repeat(700) }))).toHaveLength(600);
  });
});
