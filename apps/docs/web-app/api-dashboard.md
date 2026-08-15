# API Dashboard

The **API Dashboard** (`/dashboard/api`) is the full key-management surface for the [public API](../api/). It sits at the intersection of the web app and the API — manage keys, group them, and allocate credits to them.

## Managing keys

- **Create** `sk_live_` API keys — the full key is shown **only once** at creation, so copy it immediately.
- **Name** keys with a nickname for easy identification.
- **Group** keys into folders to organise them (e.g. "Production", "Testing").
- **Revoke** any key instantly. Revoked keys immediately stop authenticating.
- View each key's preview, folder, creation date, and active/revoked status.

## Active key limits

| Plan | Active keys |
| --- | --- |
| Free | 3 |
| Pro | 20 |
| Dev | Unlimited |

## Credits

Sky Style keeps three balances distinct. The API Dashboard is where you move value between them:

| Balance | Use |
| --- | --- |
| **$ Credit (AUD)** | Convert $1.00 into 50 API Credit for a key you choose. Pro receives $1.00 each calendar month. |
| **API Credit** | Per-key balance consumed by public API requests. |
| **App Credit** | In-app balance, including developer gifts and API fallback when a key's API Credit is empty. Pro receives 50 App Credits each day. |

### Allocating credit

When you have at least **$1.00** in $ Credit and at least one active API key:

1. Select a key from the dropdown (shown with its folder and nickname).
2. Click **Allocate $1 → 50 API Credit**.
3. The selected key's API Credit balance increases by 50.

::: warning Purchases not live yet
API credit purchases are not live yet. The app's "Get credits" button currently opens an informational donation prompt — it does not process a purchase. App Credit can be gifted by a developer in the meantime.
:::

## App Credit fallback

When an API key's API Credit balance is empty, Sky Style automatically uses one available App Credit for the request and returns an `X-Credit-Warning` header so API clients can surface the fallback. See [Errors & Credits](../api/errors) for the full charging rules.

## Tutorials

The API Dashboard has its own guided tour — replay it from [Settings → Tutorials](./settings#tutorials).
