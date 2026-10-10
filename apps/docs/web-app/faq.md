# FAQ & Troubleshooting

Common questions and fixes for Sky Style.

## Recommendations

### My recommendation doesn't mention my closet items

Recommendations can use your saved wardrobe without opening the Closet panel. To restrict advice to owned clothing, select **Owned clothes only** in Style. Check that the clothes are available to wear and that your [owned-clothes-only allowance](./how-it-works#usage-limits) remains available. In the development candidate, missing wardrobe requirements appear as gaps instead of invented owned items.

### The recommendation says the wrong temperature unit

Units are controlled by your account's **unit preference** (metric or imperial), set in [Settings → Units](./settings#units). The dashboard uses this preference. Public API requests use their explicit `unit` parameter, defaulting to metric when omitted. If it hasn't updated, refresh the page after saving.

### I got a 502 error

A `502 Bad Gateway` means the upstream weather provider or AI backend was unavailable. This is transient — wait 2–5 seconds and retry. If it persists, check the [COOLman service status page](https://status.coolmanyt.com/).

### The AI model isn't the one I expected

Sky Style picks the first **available** model in your plan's priority list (see [How It Works → AI models](./how-it-works#ai-models)). If a provider's key isn't configured server-side, its models are skipped. To force a specific provider, Pro/Dev users can use [BYOK](./dashboard#bring-your-own-key-pro-dev) to supply their own key.

## Usage & limits

Your account and dashboard show current usage and available credits. Checkout and credit purchases are unavailable.

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

Yes — the Privacy Hub offers a **JSON export** of your profile, settings, closet, usage, feedback and security logs. The development candidate also exports structured wardrobe data, saved outfits and cloud comfort preferences; local-only data is excluded. Non-Dev accounts are limited to one export every **12 hours**. See [Privacy Hub → Data export](./security-and-privacy#data-export).

## API keys & credits

### I can't create more API keys

Each plan has a limit on **active** (non-revoked) keys: Free 3, Pro 20, Dev unlimited. Revoke a key you no longer need to free up a slot. See [API Dashboard](./api-dashboard#active-key-limits).

### My API key has no credits

Check the key balance in the API Dashboard. If it is empty, a request may use one available App Credit and return a warning header. Credit purchases and money-wallet top-ups are unavailable. See [API credits](./api-dashboard#credits-and-usage).

::: tip Credit purchases
Checkout and credit purchases are unavailable. A voluntary donation does not grant access or credits.
:::

## Weather

### Why is my accuracy "Low"?

For BOM (Australia) data, accuracy is based on distance to the nearest reporting station: **Low** means the nearest station is more than 50 km away. The reading is still valid, just less local. See [How It Works → Accuracy score](./how-it-works#accuracy-score).

### Can I use my own weather source?

Yes — Pro users can add custom HTTPS weather sources. See [Custom Weather Sources](./custom-weather-sources).

### The weather looks wrong

Sky Style aggregates comparable, valid provider measurements. Missing values are excluded in the development candidate, and forecast coverage is reported separately. If a source returns bad data, it can skew the average. Pro users can use the **source picker** to choose a specific built-in source, or add a [custom source](./custom-weather-sources) they trust.

## App behaviour

### My settings didn't save

Most preferences are stored in your browser's `localStorage` (keys prefixed with `skystyle_`). If they're not persisting:

1. Make sure you clicked **Save** in Settings.
2. Check that your browser isn't blocking `localStorage` (private/incognito mode, or strict privacy settings).
3. Clearing site data will reset local preferences — you'll need to reconfigure them.

### The dashboard tour keeps appearing

Onboarding completion and guided mode are saved to your account. Workspace and tutorial preferences also use browser storage. If a tour keeps reappearing, check whether account settings failed to save or this browser is clearing local preferences. You can dismiss it with **Skip**, or replay it anytime from [Settings → Tutorials](./settings#tutorials).

### Dark mode isn't working

Theme is controlled in [Settings → Appearance](./settings#appearance): system, light, or dark. "System" follows your OS preference — if your OS is in light mode, selecting "system" won't appear dark. Choose "dark" explicitly to force it.

## Still stuck?

- Browse the full [Web App Guide](/web-app) for detailed references.
- Send a message from the [Feedback](./account-and-support#feedback) page — every message is read personally.
- Check the [COOLman service status page](https://status.coolmanyt.com/) for outages.
