# Agent Instructions — Sky Style (what2wear)

This file is read by AI coding agents (GitHub Copilot, OpenAI Codex, Cursor, Claude, etc.).

## ⚠️ Mandatory: Update `changelog.json` after every task

After completing **any** code change in this repository, **prepend** a new entry to `/changelog.json`.

### Entry format

```json
{
  "date": "<ISO-8601 UTC timestamp, e.g. 2026-04-03T12:00:00.000Z>",
  "version": "<semver — see guide below>",
  "title": "<Short human-readable name ≤ 60 chars>",
  "description": "<One or two sentences describing what changed and why ≤ 200 chars>"
}
```

The array is **newest-first** — insert your entry at **index 0**.

### Semver guide

| Change type | Bump |
|---|---|
| Bug fix / typo / style tweak | patch (e.g. 1.3.0 → 1.3.1) |
| New feature / new page / new toggle | minor (e.g. 1.3.0 → 1.4.0) |
| Breaking API / schema migration | major (e.g. 1.3.0 → 2.0.0) |

### Example diff to `changelog.json`

```diff
 [
+  {
+    "date": "2026-04-03T12:00:00.000Z",
+    "version": "1.3.1",
+    "title": "Fix TypeScript cast in style route",
+    "description": "Cast Supabase settings fields to string | undefined to resolve TS2322 build error."
+  },
   {
     "date": "2026-04-03T00:00:00.000Z",
     "version": "1.3.0",
```

---

## Important!

Make sure to tell the user if anything in the supabase folder was changed.

## Key codebase facts

- **Build:** `npm run build` (Next.js 16.1.6 with Turbopack)
- **Lint:** `npm run lint` (targets `apps/web`)
- **No test suite** — validate with build + lint only
- **Styles:** Tailwind CSS 4 + CSS custom properties (`var(--accent)`, `var(--foreground)`, `var(--background)`, `var(--card)`, `var(--card-border)`)
- **Auth:** NextAuth v5 JWT — `auth()` server-side, `/api/auth/session` client-side
- **DB:** Supabase admin client at `apps/web/src/lib/supabase.ts`; always set `onConflict` on upserts
- **Rate limits:** `free` 5 AI/day · `demo` 10× free · `pro` credits · `dev` unlimited
- **localStorage prefix:** all keys use `skystyle_` (e.g. `skystyle_last_seen_changelog`)
