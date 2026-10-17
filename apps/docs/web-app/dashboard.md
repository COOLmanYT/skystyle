# Dashboard & Closet

::: warning Accounting rollout
The [approved V6 daily/monthly limits and shared-wallet policy](../development/v6-entitlements) are not active yet. Daily allowance descriptions below reflect legacy enforcement. Style, Shop and automatic AI generations will share recommendation caps after the verified cutover.
:::

The dashboard has a full-width **Style / Shop** navigation bar. **Style** is live weather, your preferences, and an outfit recommendation; **[Shop](./shop)** finds new clothes through an approved product source.

Choose both workspaces, Style only, or Shop only during the first-use tour or in Settings. The sidebar shows the same enabled workspaces. This preference is saved per account in this browser; if storage is blocked, it lasts for the current visit only.

## Dashboard layout

Inside Style, the dashboard is split into a **weather panel** and a **settings panel**. The split is adjustable in [Settings → Layout & spacing](./settings#layout-and-spacing):

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

Occasion, date/time, fragrance and your editable private preference summary remain with follow-ups. Budget ranges belong in Shop, where the maximum applies to sourced item totals (excluding delivery); they are not claimed as a verified wardrobe value in Style.

After a recommendation, ask follow-ups like "should I bring an umbrella?" or "what if I need formal shoes?". Follow-ups run in one of two modes:

- **Replace mode** (default) — each follow-up overwrites the current outfit suggestion.
- **Chat mode** — follow-ups append below, keeping a running conversation history.

Switch modes in [Settings → Dashboard behaviour](./settings#dashboard-behaviour).

::: tip Daily limits
Follow-ups are limited per day based on your plan (Free: 40/day, Pro: 400/day). When you hit the limit, the dashboard shows your usage and the limit resets at midnight UTC.
:::

## Weather Planning panel

The Weather Planning panel on the dashboard lets you control how a recommendation is generated:

- **Recommendation mode** — Simple, Simple+, Advanced, or Pro (see [Recommendation modes](#recommendation-modes) above).
- **Source picker** (Pro) — choose which built-in weather source to use for this recommendation. Free users get 4 source picks/day; Pro is unlimited. See [How It Works → Weather sources](./how-it-works#weather-sources).
- **Hourly forecast** — when the selected source provides it, an hourly breakdown (time, temperature, description, rain chance, wind speed) is shown so you can plan around changing conditions.
- **Accuracy** — for BOM (Australia) data, the panel shows the accuracy score based on distance to the nearest station (see [Accuracy score](./how-it-works#accuracy-score)).

The panel's default state (always open, closed, or disabled) is configurable in [Settings → Dashboard behaviour](./settings#dashboard-behaviour).

## Model switching

You can change which AI model generates your recommendation. **Model switches are a separate daily counter** from AI uses:

| Plan | Model switches |
| --- | --- |
| Free | 2/day |
| Pro | Unlimited |
| Dev | Unlimited |

Switching counts even if the previous model was unavailable. See [How It Works → AI models](./how-it-works#ai-models) for the full model priority list.

## Bring Your Own Key (Pro & Dev)

Pro and Dev users can supply their own AI provider key so recommendations are billed to their own account.

- **Supported providers**: OpenAI, Google Gemini, Mistral AI, and Anthropic (Claude Haiku 4.5).
- Keys are stored in this browser and transmitted through Sky Style for requests to the selected provider, never saved in the Sky Style database. Changing provider clears the previous key; follow-ups retain the provider. BYOK also works in Shop.
- A **custom prompt** can replace the default Sky Style prompt — it must include JSON output instructions and is stored locally only.

::: tip BYOK is optional
Without a BYOK key, Sky Style uses its own AI provider according to your plan tier. See [Plans](./account-and-support#plans).
:::

## Closet

The **Closet** page (`/closet`) holds the clothes you own so the AI can tailor recommendations to your actual wardrobe.

- Items are returned in the order you added them.
- Closet usage is limited per day on the Free plan (4 uses/day) and unlimited on Pro/Dev.
- The closet panel can be expanded directly from the dashboard or managed on its own page.

Demo sessions do not write to cloud Closet or Inbox tables. Sign in with a real account to save those features.

## First-use tour and private feedback

Onboarding and the dashboard tour are one flow: choose workspaces, follow spotlights over the real controls, and learn how to get your first recommendation. It does not generate advice or consume usage. Replay from Settings, not the Dashboard menu.

The **Record private style feedback** button opens a keyboard-accessible modal. In Settings you can still inspect/edit the summary, choose local or cloud storage, and delete feedback. Recording controls appear only in the modal.
