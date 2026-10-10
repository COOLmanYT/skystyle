import type { ByokProvider } from "./ai";
export interface ByokCredentials { provider: ByokProvider; key: string; remember: boolean; storageAvailable: boolean }
const EMPTY = JSON.stringify({ provider: "openai", key: "", remember: false, storageAvailable: true });
const STORAGE_UNAVAILABLE = JSON.stringify({ provider:"openai",key:"",remember:false,storageAvailable:false });
const listeners = new Set<() => void>();
const memory = new Map<string, string>();
let signedOut = false;
const prefix = "skystyle_byok_v2_";
function emit() { listeners.forEach(listener => listener()); }
export function byokSnapshot(userId: string): string {
  if (typeof window === "undefined" || signedOut) return EMPTY;
  if (memory.has(userId)) return memory.get(userId)!;
  try {
    const selected = sessionStorage.getItem(`${prefix}${userId}_provider`) ?? localStorage.getItem(`${prefix}${userId}_provider`) ?? "openai";
    const provider: ByokProvider = ["openai", "gemini", "mistral", "anthropic"].includes(selected) ? selected as ByokProvider : "openai";
    const keyName = `${prefix}${userId}_${provider}`;
    const persistent = localStorage.getItem(keyName);
    return JSON.stringify({ provider, key: sessionStorage.getItem(keyName) ?? persistent ?? "", remember: persistent !== null, storageAvailable: true });
  } catch { return STORAGE_UNAVAILABLE; }
}
export function writeByok(userId: string, changes: Partial<ByokCredentials>) {
  const previous = JSON.parse(byokSnapshot(userId)) as ByokCredentials;
  let next = { ...previous, ...changes };
  if (changes.provider && changes.provider !== previous.provider) next = { ...next, key: "", remember: false };
  next.key = next.key.slice(0, 500);
  try {
    localStorage.removeItem("skystyle_byok_key");
    const keyName = `${prefix}${userId}_${next.provider}`;
    sessionStorage.setItem(`${prefix}${userId}_provider`, next.provider);
    if (next.remember && next.key) { localStorage.setItem(keyName, next.key); localStorage.setItem(`${prefix}${userId}_provider`, next.provider); sessionStorage.removeItem(keyName); }
    else { localStorage.removeItem(keyName); if (next.key) sessionStorage.setItem(keyName, next.key); else sessionStorage.removeItem(keyName); }
  } catch { next.storageAvailable = false; }
  memory.set(userId, JSON.stringify(next));
  emit();
}
export function clearSavedByok(userId: string) {
  let cleared=true;
  try {
    for (const storage of [localStorage, sessionStorage]) {
      for (const provider of ["openai","gemini","mistral","anthropic","provider"]) storage.removeItem(`${prefix}${userId}_${provider}`);
      for (const key of Object.keys(storage)) if (key.startsWith(`${prefix}${userId}_`)) storage.removeItem(key);
    }
    localStorage.removeItem("skystyle_byok_key");
  } catch { cleared=false; }
  memory.set(userId, cleared?EMPTY:STORAGE_UNAVAILABLE); emit();
}
export function clearByokSessions(broadcast = true) {
  signedOut = true; memory.clear();
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    localStorage.removeItem("skystyle_byok_key");
    if (broadcast) localStorage.setItem("skystyle_byok_logout", crypto.randomUUID());
  } catch { /* Optional browser storage. */ }
  emit();
}
export function subscribeByok(userId: string, listener: () => void) {
  signedOut = false;
  // Remove unowned legacy credentials; never assign them to the signed-in user.
  try { localStorage.removeItem("skystyle_byok_key"); localStorage.removeItem("skystyle_byok_provider"); } catch { /* optional */ }
  listeners.add(listener);
  const storageChange = (event: StorageEvent) => {
    if (event.key === "skystyle_byok_logout") clearByokSessions(false);
    else if (event.key?.startsWith(`${prefix}${userId}_`)) { memory.delete(userId); emit(); }
  };
  window.addEventListener("storage", storageChange); listener();
  return () => { listeners.delete(listener); window.removeEventListener("storage", storageChange); };
}
export const emptyByokSnapshot = () => EMPTY;
