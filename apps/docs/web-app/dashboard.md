# Dashboard & Closet

The dashboard is the heart of Sky Style — live weather, your preferences, and an AI outfit recommendation in one place.

## Dashboard layout

The dashboard is split into a **weather panel** and a **settings panel**. The split is adjustable in [Settings → Layout & spacing](./settings#layout-and-spacing):

- **Symmetrical Split** — both panels equal width.
- **Large Weather** (default) — weather panel is wider.
- **Large Settings** — settings panel is wider.

When **Custom Column Spacing** is on, hover between the two panels to reveal a drag handle and resize them freely. The ratio is saved automatically.

## Location

Choose how Sky Style locates you:

- **GPS** — permit browser location access for the most accurate local weather.
- **Manual** — type any city or coordinates.

Your location consent is controlled in [Settings → Preferences](./settings#preferences).

## Recommendation modes

Each recommendation can run at one of four complexity levels, selected in the Weather Planning panel:

| Mode | Description |
| --- | --- |
| Simple | A concise outfit suggestion. |
| Simple+ | Slightly more detail. |
| Advanced | Deeper reasoning and options. |
| Pro | The most thorough recommendation. |

Your default mode is configurable in [Settings → Dashboard behaviour](./settings#dashboard-behaviour).

## Follow-up questions

After a recommendation, ask follow-ups like "should I bring an umbrella?" or "what if I need formal shoes?". Follow-ups run in one of two modes:

- **Replace mode** (default) — each follow-up overwrites the current outfit suggestion.
- **Chat mode** — follow-ups append below, keeping a running conversation history.

Switch modes in [Settings → Dashboard behaviour](./settings#dashboard-behaviour).

::: tip Daily limits
Follow-ups are limited per day based on your plan (Free: 40/day, Pro: 400/day). When you hit the limit, the dashboard shows your usage and the limit resets at midnight UTC.
:::

## Bring Your Own Key (Pro & Dev)

Pro and Dev users can supply their own AI provider key so recommendations are billed to their own account.

- **Supported providers**: OpenAI, Google Gemini, and Mistral AI.
- Keys are stored **only in your browser** and are never sent to Sky Style servers except for the single AI request.
- A **custom prompt** can replace the default Sky Style prompt — it must include JSON output instructions and is stored locally only.

::: tip BYOK is optional
Without a BYOK key, Sky Style uses its own AI provider according to your plan tier. See [Plans](./account-and-support#plans).
:::

## Closet

The **Closet** page (`/closet`) holds the clothes you own so the AI can tailor recommendations to your actual wardrobe.

- Items are returned in the order you added them.
- Closet usage is limited per day on the Free plan (4 uses/day) and unlimited on Pro/Dev.
- The closet panel can be expanded directly from the dashboard or managed on its own page.
