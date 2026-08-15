# FAQ & Troubleshooting

Common questions and fixes for Sky Style.

## Recommendations

### My recommendation doesn't mention my closet items

The AI uses your closet when the closet panel is engaged on the dashboard. Make sure:

1. You've added items on the **Closet** page (`/closet`).
2. The closet is active for the recommendation (open the closet panel on the dashboard before generating).
3. You haven't hit your daily **closet usage** limit (4/day on Free).

### The recommendation says the wrong temperature unit

Units are controlled by your account's **unit preference** (metric or imperial), set in [Settings → Units](./settings#units). Changing it updates both the dashboard and the public API. If it hasn't updated, refresh the page after saving.

### I got a 502 error

A `502 Bad Gateway` means the upstream weather provider or AI backend was unavailable. This is transient — wait 2–5 seconds and retry. If it persists, check the [COOLman service status page](https://status.coolmanyt.com/).

### The AI model isn't the one I expected

Sky Style picks the first **available** model in your plan's priority list (see [How It Works → AI models](./how-it-works#ai-models)). If a provider's key isn't configured server-side, its models are skipped. To force a specific provider, Pro/Dev users can use [BYOK](./dashboard#bring-your-own-key-pro-dev) to supply their own key.

## Usage & limits

### I hit my daily limit — when does it reset?

All daily counters reset at **midnight UTC**. The dashboard shows your current usage against each limit.

### What counts as a "model switch"?

Changing which AI model generates your recommendation counts as a **model switch** — a separate counter from AI uses (2/day on Free, unlimited on Pro/Dev). See [Usage limits](./how-it-works#usage-limits).

### Why is my follow-up not working?

Follow-ups require an existing recommendation to refine. If you're in **Chat mode**, follow-ups append below; in **Replace mode**, they overwrite the current outfit. Check your [follow-up mode](./settings#dashboard-behaviour) in Settings.

## Account & security

### I lost my 2FA device

Use one of your **recovery codes** (saved when you enabled 2FA) to sign in. If you've lost those too, contact support via the [Feedback](./account-and-support#feedback) page — a developer can reset 2FA after verifying your identity.

::: warning Recovery codes are shown once
Recovery codes are displayed only at setup. Download `skystyle-recovery-codes.txt` and store it safely. You can [regenerate](./security-and-privacy#two-factor-authentication-2fa) them anytime (which invalidates the old set).
:::

### How do I delete my account?

Go to **Settings → Privacy Hub** (or the Account page) and request deletion. It's a **human-reviewed process** — a developer actions it within 7 days. You can cancel anytime before then. See [Privacy Hub → Account deletion](./security-and-privacy#account-deletion).

### Can I export my data?

Yes — the Privacy Hub offers a **JSON export** of your profile, settings, closet, usage, feedback, and security logs. Non-Dev accounts are limited to one export every **12 hours**. See [Privacy Hub → Data export](./security-and-privacy#data-export).

## API keys & credits

### I can't create more API keys

Each plan has a limit on **active** (non-revoked) keys: Free 3, Pro 20, Dev unlimited. Revoke a key you no longer need to free up a slot. See [API Dashboard](./api-dashboard#active-key-limits).

### My API key has no credits

Each key starts with 50 API Credit. When it's empty, Sky Style uses one available **App Credit** as a fallback and returns an `X-Credit-Warning` header. To top up a key, allocate `$1.00 → 50 API Credit` on the [API Dashboard](./api-dashboard#allocating-credit) (requires $ Credit, which Pro users receive monthly).

::: tip Credit purchases
API credit purchases are not live yet. The "Get credits" button opens an informational donation prompt — it doesn't process a purchase.
:::

## Weather

### Why is my accuracy "Low"?

For BOM (Australia) data, accuracy is based on distance to the nearest reporting station: **Low** means the nearest station is more than 50 km away. The reading is still valid, just less local. See [How It Works → Accuracy score](./how-it-works#accuracy-score).

### Can I use my own weather source?

Yes — Pro users can add custom HTTPS weather sources. See [Custom Weather Sources](./custom-weather-sources).

### The weather looks wrong

Sky Style aggregates multiple sources and averages them. If a source returns bad data, it can skew the average. Pro users can use the **source picker** to choose a specific built-in source, or add a [custom source](./custom-weather-sources) they trust.

## App behaviour

### My settings didn't save

Most preferences are stored in your browser's `localStorage` (keys prefixed with `skystyle_`). If they're not persisting:

1. Make sure you clicked **Save** in Settings.
2. Check that your browser isn't blocking `localStorage` (private/incognito mode, or strict privacy settings).
3. Clearing site data will reset local preferences — you'll need to reconfigure them.

### The dashboard tour keeps appearing

The tour shows once per browser (tracked by `skystyle_tutorial_seen_<id>`). If it keeps reappearing, your browser may be clearing `localStorage` on exit. You can dismiss it with **Skip**, or replay it anytime from [Settings → Tutorials](./settings#tutorials).

### Dark mode isn't working

Theme is controlled in [Settings → Appearance](./settings#appearance): system, light, or dark. "System" follows your OS preference — if your OS is in light mode, selecting "system" won't appear dark. Choose "dark" explicitly to force it.

## Still stuck?

- Browse the full [Web App Guide](./web-app) for detailed references.
- Send a message from the [Feedback](./account-and-support#feedback) page — every message is read personally.
- Check the [COOLman service status page](https://status.coolmanyt.com/) for outages.
