# Web App Guide

Sky Style combines live weather, your saved closet, and an AI recommendation in one dashboard. This guide walks through every area of the app.

## Getting started

1. Create an account at [skystyle.app](https://skystyle.app) by signing in with GitHub or Google.
2. On the dashboard, choose a location manually or permit location access.
3. Add the clothes you actually own in **Closet**.
4. Generate a recommendation and use follow-up questions to refine it.

## Dashboard

The dashboard is split into a weather panel and a settings panel. The split is adjustable in [Settings](#settings).

### Recommendation modes

Each recommendation can run at one of four complexity levels, set in the Weather Planning panel:

| Mode | Description |
| --- | --- |
| Simple | A concise outfit suggestion. |
| Simple+ | Slightly more detail. |
| Advanced | Deeper reasoning and options. |
| Pro | The most thorough recommendation. |

Your default mode is configurable in [Settings → Dashboard Behaviour](#dashboard-behaviour).

### Follow-up questions

After a recommendation, ask follow-ups like "should I bring an umbrella?" or "what if I need formal shoes?". Follow-ups run in one of two modes (set in Settings):

- **Replace mode** (default) — each follow-up overwrites the current outfit suggestion.
- **Chat mode** — follow-ups append below, keeping a running conversation history.

### Bring Your Own Key (Pro & Dev)

Pro and Dev users can supply their own AI provider key (OpenAI, Gemini, or Mistral) so recommendations are billed to their own account. Keys are stored only in your browser and are never sent to Sky Style servers except for the single AI request. The BYOK panel also lets you set a custom prompt that replaces the default Sky Style prompt (it must include JSON output instructions).

::: tip BYOK is optional
Without a BYOK key, Sky Style uses its own AI provider according to your plan tier.
:::

## Closet

The **Closet** page (`/closet`) holds the clothes you own so the AI can tailor recommendations to your actual wardrobe. Items are returned in the order you added them. Closet usage is limited per day on the Free plan and unlimited on Pro/Dev.

## Account

The **Account** page (`/account`) is the hub for your profile and safety controls. It shows:

- Your **plan badge** (Free, Pro, or Dev)
- **AI usage today** against your daily limits
- **Credits** balances (Pro/Dev only)
- Embedded **Security** and **Privacy Hub** sections

Use it as the entry point for security settings, privacy controls, and API access.

## Settings

The **Settings** page (`/settings`) controls appearance, dashboard behaviour, and layout. Most preferences are stored in your browser only; only your unit preference is saved to your account.

### Profile

Set the **gender context** used for outfit recommendations: Male, Female, Other, or a manual entry (max 30 characters). This is stored locally and never sent to Sky Style except when required for an AI request.

### Units

Switch between **metric** (°C, km/h) and **imperial** (°F, mph). This is saved to your account and applies across the dashboard and the public API.

### Appearance

- **Theme**: system, light, or dark.
- **Reduce motion**: minimises animated weather effects and interface transitions.

### Preferences

- **Share my location with AI** — include your location in the AI prompt for more relevant recommendations.
- **Weather only** — show weather data without generating an AI outfit recommendation.
- **Simple Mode default on Terms & Privacy pages** — show plain-English summaries.

### Dashboard behaviour

- **Weather Planning Panel**: always open, closed by default, or disabled entirely.
- **Default recommendation mode**: Simple, Simple+, Advanced, or Pro.
- **Follow-up mode**: Replace or Chat (see [Dashboard](#follow-up-questions)).
- **Session Diagnostics**: show a diagnostics panel on the dashboard.
- **BYOK panel**: expand the Bring Your Own Key section by default.

### Layout & spacing

- **Dashboard layout**: Symmetrical Split, Large Weather (default), or Large Settings — with a live preview.
- **Extra Side Spacing**: add horizontal padding to selected pages (dashboard, account, settings, closet, feedback, inbox, automatic recommendations).
- **Custom Column Spacing**: when on, drag the divider between dashboard panels to resize them freely. The ratio is saved automatically.

### Tutorials

Replay any guided tour whenever you need a refresher:

- Dashboard tour
- API Dashboard tour
- Dev Dashboard tour

## Security

The **Security** page (`/settings/security`) protects your account. It is also embedded in the Account page.

### Two-factor authentication (2FA)

Add a TOTP authenticator (Google Authenticator, Authy, or Bitwarden) for an extra sign-in factor:

1. Scan the QR code with your authenticator app.
2. Enter the 6-digit code to verify and enable.
3. Save your **recovery codes** — they are shown only once. Download them as `skystyle-recovery-codes.txt` and keep them safe. Each code can be used once.

You can **regenerate** recovery codes at any time (which invalidates the old ones) and disable 2FA by confirming a current code.

### Passkeys

Sign in with **Face ID, Touch ID, Windows Hello, or a hardware security key**. Register a passkey with a custom name (e.g. "iPhone"), then list or remove registered passkeys.

### API keys

Create and revoke API keys for [public API](./api/) access:

- Keys are prefixed with `sk_live_` and shown **only once** at creation — copy immediately.
- View active and revoked keys with their creation date.
- Revoke any key instantly.

::: tip Full key management
The [API Dashboard](#api-dashboard) offers richer key management — nicknames, folders, and credit allocation.
:::

### Security log

An auditable log of security events on your account, including sign-ins, passkey and MFA changes, API key changes, deletion requests, and data exports. Each entry shows the event, the originating IP, and a timestamp.

## Privacy Hub

The **Privacy Hub** (`/settings/privacy`) controls your data. It is also embedded in the Account page.

### Data export

Download everything Sky Style stores about you — your profile, settings, closet, usage history, feedback, and security logs — as a structured JSON file (human-readable and machine-parseable, with a version stamp and export timestamp).

Exports are rate-limited: non-Dev accounts can request one export every **12 hours**.

### Account deletion

Request permanent deletion of your account and all associated data. This is a **human-reviewed process** — a developer actions it within 7 days. Until then, you can cancel at any time from the Privacy Hub or the banner shown on the dashboard. An optional reason (max 1000 characters) helps improve Sky Style.

## Automatic recommendations

The **Automatic recommendations** page (`/automatic-recommendations`) schedules an exact-time outfit recommendation using a manual location. Each schedule includes:

- A **label** (e.g. "Morning commute")
- **Latitude and longitude** (manual — GPS is not used)
- A **run time** and **recurrence** (once, daily, or weekly)
- A **unit preference** (metric or imperial)
- Your **timezone** (detected automatically)
- An optional **styling prompt** (max 1000 characters)

Schedules can be paused and resumed. Recent results show the status, time, and the saved outfit (or any error). Completed recommendations are also delivered to your **Inbox**.

::: tip Scheduling
The scheduler runs via Supabase Cron and invokes the secure worker each minute, so exact-time recommendations are delivered at the minute you schedule.
:::

## API Dashboard

The **API Dashboard** (`/dashboard/api`) is the full key-management surface for the [public API](./api/):

- **Create and revoke** `sk_live_` API keys (shown only once at creation).
- **Name and group** keys with nicknames and folders.
- **Allocate** `$ Credit` (AUD) to a specific key, converting $1.00 into 50 API Credit.
- View per-key balances.

| Plan | Active keys |
| --- | --- |
| Free | 3 |
| Pro | 20 |
| Dev | Unlimited |

See [Errors & Credits](./api/errors) for how credits are charged and the App Credit fallback.

## Feedback

The **Feedback** page (`/feedback`) lets signed-in users share a bug report, suggestion, or message. Pro and Dev context is passed along automatically. Your past submissions are tracked as **tickets** you can review on the same page.

## Inbox

The **Inbox** keeps recommendation, support, system, and changelog notices together in one place. Automatic recommendation results are delivered here, and unread counts surface across the app.

## Credits

Sky Style keeps three balances distinct:

| Balance | Use |
| --- | --- |
| $ Credit (AUD) | Convert $1.00 into 50 API Credit for a key you choose. Pro receives $1.00 each calendar month. |
| API Credit | Per-key balance consumed by public API requests. |
| App Credit | In-app balance, including developer gifts and API fallback when a key's API Credit is empty. Pro receives 50 App Credits each day. |

API credit purchases are not live yet; the app's donation prompt is intentionally informational.

## Plans

| | Free | Pro |
|---|---|---|
| AI uses | 20/day | 50 App Credits/day |
| Follow-ups | 40/day | 400/day |
| Closet | 4 uses/day | Unlimited |
| Source picker | 4/day | Unlimited |
| BYOK AI key | — | ✅ |
| Custom prompts | — | ✅ |

The **Dev** tier bypasses all limits and is only provisioned to developer accounts. The **Demo** tier is created automatically in preview/development environments and multiplies the free limits by 10 for testing.

## Help and service status

Use the app Inbox or Feedback page for account help. API users should consult the [API error guide](./api/errors) and the [COOLman service status page](https://status.coolmanyt.com/) for service and downtime information. Monitoring integrations can use its [live component status JSON](https://status.coolmanyt.com/v3/components.json).
