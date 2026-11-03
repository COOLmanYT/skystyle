"use client";
import { BYOK_PROVIDERS, type ByokProvider } from "@/lib/ai-models";
export default function ByokCredentialControls({ provider, apiKey, remember, storageAvailable, onProvider, onKey, onRemember, onClear }: {
  provider: ByokProvider; apiKey: string; remember: boolean; storageAvailable: boolean;
  onProvider: (provider: ByokProvider) => void; onKey: (key: string) => void; onRemember: (remember: boolean) => void; onClear: () => void;
}) {
  const style = { background: "var(--background)", borderColor: "var(--card-border)" };
  return <fieldset className="byok-controls space-y-3"><legend className="sr-only">Bring your own AI key</legend>
    <label className="block text-sm">Provider<select value={provider} onChange={e => onProvider(e.target.value as ByokProvider)} className="form-control mt-1" style={style}>{BYOK_PROVIDERS.map(value => <option key={value} value={value}>{{ openai: "OpenAI", gemini: "Google Gemini", mistral: "Mistral AI", anthropic: "Anthropic" }[value]}</option>)}</select></label>
    <label className="block text-sm">API key<input type="password" autoComplete="off" maxLength={500} value={apiKey} onChange={e => onKey(e.target.value)} className="form-control mt-1" style={style} /></label>
    <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={remember} onChange={e => onRemember(e.target.checked)} />Remember on this device for this account and provider</label>
    <p className="text-xs opacity-65">Session-only by default; cleared on sign-out. Remembered keys remain until cleared. Browser storage is not an encrypted vault. Keys are sent only for your selected provider’s requests and never saved in Sky Style’s database.</p>
    <p className="text-xs opacity-65">Anthropic uses Claude Haiku 4.5.</p>
    {!storageAvailable && <p role="status" className="text-xs">Browser storage could not be read or changed. The current key is held for this page visit; a previously saved key may remain. Retry clearing it when storage is available.</p>}
    <button type="button" onClick={onClear} className="control-button text-sm underline">Clear saved keys for this account</button>
  </fieldset>;
}
