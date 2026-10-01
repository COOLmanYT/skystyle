# Agent Instructions — Sky Style (skystyle)

This file is read by AI coding agents (GitHub Copilot, OpenAI Codex, Cursor, Claude, etc.).

## Current version: 6.1.0

This is for the changelog version number. **Update this version number accordingly** to the Semver Guide below, then use it in your end-of-task SQL statement. (Make sure to update the version number in .github\copilot-instructions.md as well.) Remember, update the version number.

## ⚠️ Mandatory: Update the Changelog in Supabase after every task

After completing **any** code change in this repository, you **must** prepare a Supabase SQL statement to insert a new changelog entry into the `changelog_posts` table. If the Sky Style Supabase project is accessible, run the statement and verify the entry exists. If it is inaccessible, output the statement for manual execution and clearly say it was not run. The JSON changelog system has been **fully removed** — Supabase is the **single source of truth** for all changelog data.

You do not need to do this **only if** user says so. For example, if the user says "just fix the typo in `README.md` and no changelog entry is needed", then you can skip the changelog update. For any non-trivial change, follow the Supabase access rule above.

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

Run and verify this statement in the Sky Style Supabase project when it is accessible. Do not include access or execution instructions in user-facing output.

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
  '✨ Feature',      -- category label
  'update',          -- 'update' or 'post'
  '## Markdown\nFull Markdown content here.',  -- extended content
  'https://img.url', -- header image
  '{"text":"Learn more","url":"https://url.com"}',  -- CTA button (JSONB)
  false,             -- large (modal view)
  false              -- show_on_next_login
);
```

### Changelog media and CTA guidance

- Use standard Markdown images in `content` (`![Concise alt text](https://...)`) for inline visuals, or use the CMS header `image` field for the card/modal hero image.
- The custom `![IMAGE-alt text][https://image-url.com]` and `!![IMAGE-CAR]` syntax remain available for legacy rich posts.
- A CTA needs **both** a label and a safe `https://` or relative URL. Use it for one meaningful next action only; preview the post before publishing.
- Never put API keys, user data, or unlicensed assets in a changelog image, link, or CTA.

### Semver guide

| Change type | Bump |
| --- | --- |
| Bug fix / typo / style tweak | patch (e.g. 1.3.0 → 1.3.1) |
| New feature / new page / new toggle | minor (e.g. 1.3.0 → 1.4.0) |
| Breaking API / schema migration | major (e.g. 1.3.0 → 2.0.0) |

### ⚠️ Important rules

- **DO NOT write to `changelog.json`** — the JSON changelog system is fully deprecated and removed.
- **DO NOT use the JSON file as a fallback** — all changelog reads come from Supabase `changelog_posts`.
- For completed code-change tasks, run and verify the changelog SQL when Supabase is accessible. Otherwise, output the SQL and state that it was not run. Never claim an unverified entry was added.
- At the end of an Agent Task series, you may be asked to "squash" or "merge" changelog entries. If possible, make 1 singular changelog entry consisting of all changes made in the entire Agent Task.

---

> [!IMPORTANT]
> Make sure to tell the user if anything in the supabase folder was changed.

## Key codebase facts

- **Build:** `npm run build` (Next.js 16.2.3 with Turbopack)
- **Lint:** `npm run lint` (targets `apps/web`)
- **Tests:** `npm test -- --runInBand` (Jest); validate with tests, build, and lint.
- **Styles:** Tailwind CSS 4 + CSS custom properties (`var(--accent)`, `var(--foreground)`, `var(--background)`, `var(--card)`, `var(--card-border)`)
- **Auth:** NextAuth v5 JWT — `auth()` server-side, `/api/auth/session` client-side
- **DB:** Supabase admin client at `apps/web/src/lib/supabase.ts`; always set `onConflict` on upserts
- **Current enforcement:** Legacy Free 20 AI/day and 40 follow-ups/day; preview demo 200/400; Pro uses daily credits; dev unlimited. Approved V6 values live in `lib/entitlement-policy.ts`. Active branches are integrated but rollout stays disabled pending coordinated writer drain, revocation SQL approval, atomic access/finalization review and real-account acceptance. Local concurrency/controlled-clock tests pass; no current real Pro accounts need date backfill. Checkout stays disabled.
- **localStorage prefix:** all keys use `skystyle_` (e.g. `skystyle_last_seen_changelog`)
