import { decodeGenderPreference, decodePreferenceText, encodePreferenceText, saveSettingsPreferences } from "../browser-preferences";

describe("browser preferences", () => {
  it("keeps the default and legacy plain gender selected", () => {
    for (const value of [null, "", "N/A", "not a choice"]) expect(decodeGenderPreference(value)).toBe("N/A");
    expect(decodeGenderPreference("Female")).toBe("Female");
    expect(decodeGenderPreference(btoa("Other - Manual"))).toBe("Other - Manual");
  });
  it("preserves Unicode custom context and reads legacy text", () => {
    const context = "féminin · 日本語 🌤️";
    expect(decodePreferenceText(encodePreferenceText(context))).toBe(context);
    expect(decodePreferenceText(btoa("custom context"))).toBe("custom context");
    expect(decodePreferenceText("text:broken", "fallback")).toBe("fallback");
    expect(decodePreferenceText("text:42", "fallback")).toBe("fallback");
  });
  it("never claims account success after a rejected request", async () => {
    const result = await saveSettingsPreferences(() => {}, async () => false);
    expect(result).toMatchObject({deviceSaved:true,cloudSaved:false});
    expect(result.message).toContain("Account units could not be saved");
  });
  it("preserves device saves after a network failure", async () => {
    const result = await saveSettingsPreferences(() => {}, async () => { throw new Error("offline"); });
    expect(result).toMatchObject({deviceSaved:true,cloudSaved:false});
  });
  it("still saves account units when browser storage is blocked", async () => {
    const result = await saveSettingsPreferences(() => { throw new Error("blocked"); }, async () => true);
    expect(result).toMatchObject({deviceSaved:false,cloudSaved:true});
    expect(result.message).toContain("Browser preferences could not be saved");
  });
  it("distinguishes a demo device save from cloud storage", async () => {
    const result = await saveSettingsPreferences(() => {});
    expect(result.cloudSaved).toBeNull();
    expect(result.message).toContain("saved on this device");
  });
  it("reports when neither destination saves", async () => {
    const result = await saveSettingsPreferences(() => { throw new Error("blocked"); }, async () => false);
    expect(result.message).toContain("selections are preserved");
  });
});
