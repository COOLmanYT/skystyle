# Settings

The **Settings** page (`/settings`) controls appearance, dashboard behaviour, and layout.

Most appearance/layout preferences stay in this browser. Unit preference and onboarding completion/guided mode are saved to your account; private feedback is local by default, with opt-in cloud storage.

## Profile {#profile}

Set the **gender context** used for outfit recommendations:

| Option | Behaviour |
| --- | --- |
| Male | Recommendations use male-gendered context. |
| Female | Recommendations use female-gendered context. |
| Other | No specific gender context. |
| Other - Manual | Type your own (max 30 characters). |

This is stored locally and never sent to Sky Style except when required for an AI request.

## Units

Switch between **metric** (°C, km/h) and **imperial** (°F, mph). Units save to your account after sign-in; the demo keeps them in this browser. Save messages distinguish device preferences from account storage and preserve your selections if either fails.

## Appearance {#appearance}

- **Theme**: system, light, or dark.
- **Reduce motion**: minimises animated weather effects and interface transitions.

## Preferences {#preferences}

- **Share my location with AI** — include your location in the AI prompt for more relevant recommendations. When off, Sky Style still fetches weather for your coordinates but does not include your location text in the prompt sent to the AI. This setting is stored locally only.
- **Weather only** — show weather data without generating an AI outfit recommendation.
- **Simple Mode default on Terms & Privacy pages** — show plain-English summaries.

## Dashboard behaviour {#dashboard-behaviour}

- **Dashboard sections**: Style and Shop, Style only, or Shop only. The full-width bar and sidebar use the same choice. Saved per account in this browser; storage-blocked sessions show a warning and use a visit-only fallback.

- **Weather Planning Panel**: always open, closed by default, or disabled entirely.
- **Default recommendation mode**: Simple, Simple+, Advanced, or Pro (see [Recommendation modes](./dashboard#recommendation-modes)).
- **Follow-up mode**: Replace or Chat (see [Follow-up questions](./dashboard#follow-up-questions)).
- **Session Diagnostics**: show a diagnostics panel on the dashboard.
- **BYOK panel**: expand the Bring Your Own Key section by default.

## Layout & spacing {#layout-and-spacing}

- **Dashboard layout**: Symmetrical Split, Large Weather (default), or Large Settings — with a live preview.
- **Extra Side Spacing**: add horizontal padding to selected pages — dashboard, account, settings, closet, feedback, inbox, and automatic recommendations.
- **Custom Column Spacing**: when on, drag the divider between dashboard panels to resize them freely. The ratio is saved automatically.

## Tutorials {#tutorials}

Replay any guided tour whenever you need a refresher:

- **First-use tour** — the same onboarding flow shown after first sign-in: choose workspaces, follow highlighted controls, and learn how to request advice or find clothes. No recommendation is generated during the tour.
- **API Dashboard tour** — managing API keys and credits.
- **Dev Dashboard tour** — developer tooling (Dev users only).

## Your day and comfort

The **Your day & comfort** controls are in Style. Set temperature preference, fabric dislikes, coverage, footwear restrictions and a dress code, then save across devices or choose device-only storage. Resetting the controls does not delete saved preferences; use **Delete saved preferences** for removal. See [Everyday Outfits](./daily-outfits#your-day-and-comfort).

Provider keys have separate [session or remember-on-device controls](./dashboard#bring-your-own-key-pro-dev); they are not part of cloud Settings.

## Private style feedback

The Settings panel retains storage, summary editing and deletion controls. Select **Record private style feedback** to open the recording modal, add a thumbs-up/down with a note, and save it. You explicitly choose whether to send feedback to Mistral for summarization; your editable summary can inform later Style and Shop AI requests.
