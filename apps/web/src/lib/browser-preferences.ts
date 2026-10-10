/** New text values support Unicode; readers retain legacy base64 values. */
export function encodePreferenceText(value: string): string {
  return `text:${JSON.stringify(value)}`;
}

export function decodePreferenceText(stored: string | null, fallback = ""): string {
  if (!stored) return fallback;
  try {
    if (stored.startsWith("text:")) {
      const value: unknown = JSON.parse(stored.slice(5));
      return typeof value === "string" ? value : fallback;
    }
    const value = atob(stored);
    return /[\u0000-\u001f\u007f-\u009f]/.test(value) ? stored : value;
  } catch { return stored.startsWith("text:") ? fallback : stored; }
}

export function decodeGenderPreference(stored: string | null): string {
  const options = ["Male", "Female", "N/A", "Other - Manual"];
  if (stored && options.includes(stored)) return stored;
  const value = decodePreferenceText(stored, "N/A");
  return options.includes(value) ? value : "N/A";
}

/** Report each storage destination independently, including partial failures. */
export async function saveSettingsPreferences(saveDevice: () => void, syncUnits?: () => Promise<boolean>) {
  let deviceSaved = false;
  let cloudSaved: boolean | null = null;
  try { saveDevice(); deviceSaved = true; } catch { /* Report blocked browser storage below. */ }
  if (syncUnits) {
    try { cloudSaved = await syncUnits(); } catch { cloudSaved = false; }
  }
  const message = cloudSaved === null
    ? deviceSaved ? "Preferences saved on this device. Sign in to sync units." : "Browser storage is unavailable. Preferences apply to this visit; retry to save them."
    : deviceSaved && cloudSaved ? "Device preferences and account units saved."
    : deviceSaved ? "Device preferences saved. Account units could not be saved; retry."
    : cloudSaved ? "Account units saved. Browser preferences could not be saved; retry."
    : "Preferences could not be saved. Your selections are preserved; retry.";
  return { deviceSaved, cloudSaved, message };
}
