# Shop — Sky Style 6.1.0

Shop is a separate Dashboard workspace for buying new clothes. Style remains for weather-aware outfit advice and your existing wardrobe. The full-width bar and shared sidebar use the same enabled sections: **Style and Shop**, **Style only**, or **Shop only**. Choose during onboarding or in Settings; the preference is scoped to your account in this browser, not cloud-synced. With browser storage blocked it lasts only for the current visit.

## Search controls

Describe what you want, add a size/fit, clothing preference and occasion, and optionally enter a minimum/maximum outfit budget. Budget inputs now live in Shop, not Style. The minimum is a preference, not a requirement to spend more. Sourced item totals cannot exceed your maximum; delivery, taxes and size availability must be checked at the retailer.

Shop uses the same account model list/default and existing recommendation allowance as Style. Pro/Dev can use their own provider key or add custom AI preferences. OpenAI, Gemini, Mistral and Anthropic BYOK are supported; Anthropic uses Claude Haiku 4.5. Keys are browser-local and transmitted through Sky Style for your chosen provider, never stored in the database. Changing provider clears the previous key. Follow-ups in Style retain the BYOK provider.

## Product-source gate

The source adapter uses the official eBay Browse API for Australia, not website scraping. Live widget search requires approved production API access and credentials. Until connected, the app shows an explicit unavailable state with direct THE ICONIC search, and performs no AI generation or charge. THE ICONIC website scraping is not enabled: its terms require explicit authorization.

Only source-supplied product ids, direct links, names, prices and images can appear in cards. AI ranks candidates but cannot supply replacements for source metadata. Product ratings are **unavailable** when the source supplies none; seller feedback is not a product rating. Invalid/duplicate links and affiliate/referral parameters are discarded. Images are delivered through Sky Style's image optimization endpoint rather than a direct browser request to the source.

Prices show their original currency and the source check time. There is no currency conversion or worldwide retailer-coverage claim. A budget in a different currency excludes nonmatching prices; choose the source currency to compare reliably. A listed item is not a verified guarantee of your size or current stock. Confirm price, delivery and availability at checkout.

No Sky Style shopping query, product, impression or click analytics is recorded. Shopping requests transmit the search/fit terms to the product API and preferences/candidate text to your selected AI provider. Account usage counters remain necessary to enforce the existing recommendation allowance. Neither affiliate programs nor live payments are enabled.

Sources: [eBay Browse API](https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search), [THE ICONIC terms](https://www.theiconic.com.au/terms-conditions/), [Anthropic API](https://platform.claude.com/docs/en/api/overview).
