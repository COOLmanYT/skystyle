# Dashboard & Closet

The dashboard's **Style / Shop** bar connects outfit advice and clothing search. Choose both workspaces, Style only, or Shop only in onboarding or [Settings](./settings#dashboard-behaviour). This choice is saved per account in this browser; blocked storage uses a visit-only fallback.

## Dashboard layout

Style has weather and settings panels. [Layout & spacing](./settings#layout-and-spacing) offers Symmetrical Split, Large Weather and Large Settings. On a narrow screen, the panels stack. Custom Column Spacing enables a draggable divider on wider screens and saves its ratio.

## Location

Use GPS with browser permission, or choose a city or coordinates manually. [Location sharing](./settings#preferences) controls whether location text is included in AI requests; fetching weather still requires coordinates.

## Recommendation modes

Weather Planning provides Simple, Simple+, Advanced and Pro levels, from concise advice to more detailed reasoning. This changes the requested depth, not your account plan. Choose a default in [Dashboard behaviour](./settings#dashboard-behaviour).

## Your day and comfort

The [Everyday Outfits preview](./daily-outfits) adds explicit comfort preferences and a time window of up to 24 hours. Use **Your day & comfort** for temperature preference, fabric dislikes, coverage, footwear restrictions and a dress code. It also explains forecast coverage and the outfit's bring checklist.

## Follow-up questions

After generating advice, ask a question such as “Should I bring an umbrella?” Occasion, time, fragrance and your current private preference summary remain available to follow-ups. Replace mode updates the current advice; Chat mode keeps a conversation. Choose the mode in [Settings](./settings#dashboard-behaviour).

Budget ranges belong in [Shop](./shop), where a maximum applies to sourced item totals excluding delivery. Style does not claim to calculate the value of your wardrobe. Follow-ups have their own [usage counter](./how-it-works#usage-limits).

## Weather Planning panel

Use the panel to choose recommendation depth and a built-in source when your account permits it. Hourly forecasts show available temperatures, conditions, rain probabilities and wind. BOM readings also show station-distance accuracy. Missing forecasts are labelled unavailable; see [How It Works](./how-it-works#weather-sources).

The panel can stay open, start closed, or be disabled in [Settings](./settings#dashboard-behaviour).

## Model switching

Choosing another AI model has a separate counter from generating a recommendation. A retry can use recommendation allowance as well as a model switch. Your Account page shows the limits that apply; the [usage reference](./how-it-works#usage-limits) explains default counters. Model availability depends on the configured providers.

## Bring Your Own Key (Pro & Dev)

Supported providers are OpenAI, Google Gemini, Mistral AI and Anthropic. A key is scoped to your account and provider. **Session only** is the default and clears on sign-out. **Remember on this device** explicitly keeps the key in browser storage until you clear it, including after sign-out. Browser storage is not an encrypted vault.

Requests send the key through Sky Style to the selected provider; it is never saved in the Sky Style database. Changing provider clears the active key. Follow-ups retain their provider, and the key is never sent to another provider. Style and Shop share these controls. Use **Clear saved keys for this account** to remove its saved provider credentials.

A custom AI prompt is optional and stored locally. It must retain JSON output instructions. Without BYOK, hosted models are used according to your account access. BYOK does not bypass app limits. See [Plans](./account-and-support#plans).

## Closet

Open **Closet** from navigation or expand it within Style. In the [Everyday Outfits preview](./daily-outfits), each item has a stable ID and editable category, colour, warmth, waterproofing and availability. Revision checks preserve your draft if another tab changes the wardrobe before you save.

Clothing references highlight an owned item inline. Selecting one opens Closet, focuses its row and briefly highlights it. Stable IDs continue to work after a rename, and separate items with the same label remain distinct. Unavailable owned clothes still open Closet, where their availability is shown; items no longer owned prepare Shop instead.

Editing a closet uses no recommendation allowance. **Owned clothes only** checks the returned item IDs against available clothes and identifies wardrobe gaps. See [usage limits](./how-it-works#usage-limits).

Demo closet changes stay in the current tab until sign-out. They are not saved to cloud Closet or Inbox tables. If browser storage is blocked, changes last only on that page.

## First-use tour and private feedback

The first-use tour highlights the actual controls and uses no AI allowance. Replay it from [Settings → Tutorials](./settings#tutorials).

**Record private style feedback** opens a keyboard-accessible modal. Settings retains summary editing, local/cloud storage choice and deletion. Recording controls live in the modal; explicit [comfort preferences](./daily-outfits#your-day-and-comfort) are separate editable controls.
