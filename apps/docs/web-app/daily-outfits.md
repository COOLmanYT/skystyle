# Everyday Outfits

::: info Release status
This page describes the 6.3 development candidate, including the 6.3.1 review fixes. It has not been deployed. Cloud wardrobe and saved-outfit availability depends on the reviewed database rollout; see [release status](../development/architecture#accounting-and-release-status).
:::

Start with one location and a few clothes. Style shows an illustrative outfit before your first request; that example does not use AI or your allowance. Provider and model controls remain advanced settings.

## Your wardrobe

Each item has a stable ID, description, category, colour, warmth, waterproofing and availability. Unknown attributes stay unknown. Mark clothes unavailable while they are in the wash or away. Saving an item uses a revision check: if another tab changes the wardrobe, your draft stays visible and you can review the latest items before retrying.

“Owned clothes only” verifies returned item IDs against available wardrobe items. It displays missing wardrobe or comfort requirements as gaps. An incomplete outfit uses no recommendation allowance. General advice may include suggestions that you do not own; those have no wardrobe ID.

Demo closet changes stay in the current tab until sign-out. They do not write cloud data. Owned-clothes-only AI advice and cloud saved outfits require a real account. Blocked browser storage uses a page-only fallback.

Clothing references highlight owned items and open their Closet rows. A stable ID survives renaming; unknown or deleted IDs prepare an editable Shop query. See [clothing references](../api/clothing-references).

## Save, adjust and reuse

Save the current outfit with a name, then open **Saved outfits**. Reopening an outfit uses no AI. Its advice describes the weather when it was created, so request new weather advice before relying on it for another day.

A manual swap replaces one item with an available wardrobe item without using AI. **AI swap** selects a replacement for that slot and uses one follow-up allowance only after a valid replacement is returned. Save changes to keep the new version. Other outfit slots and the checklist stay intact. Deleted or unavailable saved items are flagged when you reopen the outfit.

## Your day and comfort

Open **Your day & comfort** to set temperature preference, fabric dislikes, coverage, footwear restrictions and a dress code. These explicit settings take precedence over inferred feedback. Save across devices, or switch to device-only storage; the switch confirms removal of the cloud copy. Failed removal is labelled unfinished and can be retried. Delete saved preferences to remove both this device’s copy and the cloud copy.

A time window can span up to 24 hours. Both ends are required, and the end must be after the start. An invalid window blocks generation rather than silently dropping that context. Enter its start and end in your device’s timezone and clear the single event time. Advice includes a short bring checklist and changes through the day. Forecast coverage is labelled full, partial or unavailable; missing hours are never filled using current conditions.

## Your own provider key

Keys are scoped to your signed-in account and provider. They use session storage by default and are cleared on sign-out. **Remember on this device** opts into persistent browser storage, which survives sign-out until explicitly cleared. Browser storage is not an encrypted vault. Switching provider never sends the previous provider’s key to another provider. Legacy browser-wide keys are removed rather than assigned to an account.

Saved outfits and cloud comfort settings are included in privacy exports and cascade with account deletion. Browser-only settings and keys are excluded from server exports. Packing and multi-day planning are later work built on these foundations.
