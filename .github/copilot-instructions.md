# GitHub Copilot Instructions — Sky Style (skystyle)

# Current version: 4.0.1

This is for the changelog version number. **Update this version number accordingly** to the Semver Guide below, then use it in your end-of-task SQL statement. (Make sure to update the version number in `AGENTS.md` as well.) Remember, update the version number. 

## ⚠️ Mandatory: Update the Changelog in Supabase after every task

After completing **any** code change in this repository, you **must** output a Supabase SQL statement to insert a new changelog entry into the `changelog_posts` table. The JSON changelog system (`changelog.json`) has been **fully removed** — Supabase is the **single source of truth** for all changelog data.

### SQL statement format

```sql
INSERT INTO changelog_posts (version, title, body, published, created_at, updated_at)
VALUES (
  '<semver>',
  '<Short human-readable name ≤ 60 chars>',
  '<One or two sentences describing what changed and why ≤ 200 chars>',
  true,
  '<ISO-8601 UTC timestamp, e.g. 2026-04-03T12:00:00.000+00>',
  '<same ISO-8601 UTC timestamp>'
);
```

Run this statement in the **Supabase SQL Editor** for the project.

### Optional fields

```sql
INSERT INTO changelog_posts (version, title, body, published, created_at, updated_at, category, type, content, image, cta, large, show_on_next_login)
VALUES (
  '2.9.0',
  'My Feature',
  'Short description.',
  true,
  now(),
  now(),
  '✨ Feature',
  'update',
  '## Markdown\nFull Markdown content here.',
  'https://img.url',
  '{"text":"Learn more","url":"https://url.com"}',
  false,
  false
);
```

### Semver guide

| Change type | Bump |
|---|---|
| Bug fix / typo / style tweak | patch (e.g. 1.3.0 → 1.3.1) |
| New feature / new page / new toggle | minor (e.g. 1.3.0 → 1.4.0) |
| Breaking API / schema migration | major (e.g. 1.3.0 → 2.0.0) |

### ⚠️ Important rules

- **DO NOT write to `changelog.json`** — the JSON changelog system is fully deprecated and removed.
- **DO NOT use the JSON file as a fallback** — all changelog reads come from Supabase `changelog_posts`.
- All completed tasks MUST output a Supabase SQL statement for the changelog.
- At the end of a Agent Task series, you may be asked to "squash" or "merge" changelog entries. If possible, make 1 singular chanhelog entry consisting of all changes made in the entire Agent Task. 

---

## Important!

Make sure to tell the user if anything in the supabase folder was changed.

## Codebase conventions

- **Build:** `npm run build` · **Lint:** `npm run lint` (targets `apps/web`) · No test suite exists.
- **Framework:** Next.js 16 App Router + Turbopack.
- **Styles:** Tailwind CSS 4 + CSS custom properties (`var(--accent)`, `var(--foreground)`, `var(--background)`, `var(--card)`, `var(--card-border)`).
- **Auth:** NextAuth v5 JWT — `auth()` server-side, `/api/auth/session` client-side. Demo user: `DEMO_USER_ID` from `@/auth`.
- **DB:** Supabase admin client at `apps/web/src/lib/supabase.ts`. Always set `onConflict` on upserts for tables with non-PK unique constraints.
- **Rate limits:** `free` 5 AI/day · `demo` 10× free · `pro` credits · `dev` unlimited (`apps/web/src/lib/daily-usage.ts`).
- **localStorage prefix:** all keys start with `skystyle_` (e.g. `skystyle_last_seen_changelog`).
- **TypeScript:** `tsconfig` uses `jsx: react-jsx` so React is in scope without an explicit import; use `React.ReactNode`, `React.CSSProperties`, etc. as needed.
