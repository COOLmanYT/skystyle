# GitHub Copilot Instructions — Sky Style (what2wear)

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

### Example

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

## Codebase conventions

- **Build:** `npm run build` · **Lint:** `npm run lint` (targets `apps/web`) · No test suite exists.
- **Framework:** Next.js 16 App Router + Turbopack.
- **Styles:** Tailwind CSS 4 + CSS custom properties (`var(--accent)`, `var(--foreground)`, `var(--background)`, `var(--card)`, `var(--card-border)`).
- **Auth:** NextAuth v5 JWT — `auth()` server-side, `/api/auth/session` client-side. Demo user: `DEMO_USER_ID` from `@/auth`.
- **DB:** Supabase admin client at `apps/web/src/lib/supabase.ts`. Always set `onConflict` on upserts for tables with non-PK unique constraints.
- **Rate limits:** `free` 5 AI/day · `demo` 10× free · `pro` credits · `dev` unlimited (`apps/web/src/lib/daily-usage.ts`).
- **localStorage prefix:** all keys start with `skystyle_` (e.g. `skystyle_last_seen_changelog`).
- **TypeScript:** `tsconfig` uses `jsx: react-jsx` so React is in scope without an explicit import; use `React.ReactNode`, `React.CSSProperties`, etc. as needed.
