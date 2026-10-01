import { renderToStaticMarkup } from "react-dom/server";
import { shouldOpenTutorial } from "../Tutorial";
import Dialog from "../Dialog";

describe("Unified first-use tour", () => {
  it("honors server first-use and replay even when browser history says seen", () => {
    expect(shouldOpenTutorial(true, false, true)).toBe(true);
    expect(shouldOpenTutorial(true, false, false)).toBe(true);
  });
  it("shows ordinary automatic tours only when unseen", () => {
    expect(shouldOpenTutorial(false, true, false)).toBe(true);
    expect(shouldOpenTutorial(false, true, true)).toBe(false);
  });
  it("keeps manual-only tours closed without a first-use request", () => {
    expect(shouldOpenTutorial(false, false, false)).toBe(false);
  });
  it("uses a browser completion fallback only when account settings are unavailable", () => {
    expect(shouldOpenTutorial(true, false, true, true)).toBe(false);
    expect(shouldOpenTutorial(true, false, false, true)).toBe(true);
    expect(shouldOpenTutorial(true, false, true, false)).toBe(true);
  });
  it("replays despite a browser completion fallback and remains usable without a marker", () => {
    expect(shouldOpenTutorial(true, false, true, true, true)).toBe(true);
    expect(shouldOpenTutorial(true, false, false, true, false)).toBe(true);
  });
  it("renders named modal semantics and a focusable panel for keyboard containment", () => {
    const markup = renderToStaticMarkup(<Dialog title="Getting started tutorial" onClose={() => {}}>First use</Dialog>);
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="Getting started tutorial"');
    expect(markup).toContain('tabindex="-1"');
  });
});
