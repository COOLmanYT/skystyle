import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import StyleFeedbackPanel from "../StyleFeedbackPanel";

describe("V6 private feedback controls", () => {
  it("starts local and discloses third-party processing before submission", () => {
    const markup = renderToStaticMarkup(createElement(StyleFeedbackPanel, { userId: "owner" }));
    expect(markup).toContain("Local · this device");
    expect(markup).toContain("Mistral Small");
    expect(markup).toContain("are never public");
    expect(markup).toContain('for="style-feedback-storage"');
    expect(markup).toContain('for="style-feedback-summary"');
    expect(markup).toContain("Save summary");
    expect(markup).toContain("Generate an outfit to rate it");
  });
  it("offers summary and storage settings without voting on the settings page", () => {
    const markup = renderToStaticMarkup(createElement(StyleFeedbackPanel, { userId: "owner", showVoting: false }));
    expect(markup).toContain("Feedback storage");
    expect(markup).not.toContain("Helpful</button>");
    expect(markup).not.toContain("Optional note about this outfit");
  });
});
