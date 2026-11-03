# API Dashboard

Open **API Dashboard** from the app menu to manage keys for the [public API](../api/). Your API key identifies your account; keep it private and use separate keys for separate integrations.

## Keys and folders

- Create a `sk_live_` key and copy the full value immediately. It is shown only once.
- Give each key a descriptive nickname and optionally group it in a folder.
- Review its preview, creation date, status and available credits.
- Revoke a key you no longer use to prevent further authentication.

| Plan | Active keys |
| --- | --- |
| Free | 3 |
| Pro | 20 |
| Dev | Unlimited |

Revoked keys do not occupy an active-key slot. See [Authentication](../api/authentication) for using a key safely.

## Credits and usage

The dashboard shows each key's available API credits. Public API requests consume credits according to the [endpoint costs](../api/errors#credits). An empty key balance may use an available App Credit and return `X-Credit-Warning`; surface that warning in your integration.

API credit purchases and money-wallet top-ups are unavailable. A donation is not a credit purchase. Check the account's displayed balance before making requests; do not assume a future plan or purchase will add credits.

## Help

Replay the API Dashboard tour from [Settings → Tutorials](./settings#tutorials). For failed requests, check the API [errors and response headers](../api/errors).
