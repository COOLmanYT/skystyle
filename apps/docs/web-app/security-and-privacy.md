# Security & Privacy

Sky Style gives you full control over your account security and your data.

## Security page

The **Security** page (`/settings/security`) protects your account. It is also embedded in the [Account](./account-and-support) page.

### Two-factor authentication (2FA)

Add a TOTP authenticator (Google Authenticator, Authy, or Bitwarden) for an extra sign-in factor:

1. Toggle 2FA on to begin setup.
2. Scan the QR code with your authenticator app, or enter the manual key.
3. Enter the 6-digit code from your app to verify and enable.
4. **Save your recovery codes** — they are shown only once. Download them as `skystyle-recovery-codes.txt` and keep them safe. Each code can be used once.

After enabling:

- **Regenerate** recovery codes at any time — this invalidates the old set (requires a current authenticator code).
- **Disable** 2FA by confirming a current code.

### Passkeys

Sign in with a passkey — **Face ID, Touch ID, Windows Hello, or a hardware security key**:

- Register a passkey with a custom name (e.g. "iPhone").
- List registered passkeys with their creation date and transports.
- Remove any passkey at any time.

### API keys

Create and revoke API keys for [public API](../api/) access directly from the Security page:

- Keys are prefixed with `sk_live_` and shown **only once** at creation — copy immediately.
- View active and revoked keys with their creation date.
- Revoke any key instantly.

::: tip Full key management
The [API Dashboard](./api-dashboard) offers richer key management — nicknames, folders, and credit allocation.
:::

### Security log

An auditable log of security events on your account:

| Event | When it appears |
| --- | --- |
| New sign-in | Each successful login. |
| Signed out | Each logout. |
| Passkey added / removed | When a passkey is registered or deleted. |
| API key created / updated / revoked | Any API key lifecycle change. |
| 2FA enabled / disabled | MFA state changes. |
| Recovery codes regenerated | When the recovery set is replaced. |
| Deletion requested / cancelled | Account deletion lifecycle. |
| Data exported | Each data export. |

Each entry shows the event, the originating IP, and a timestamp.

## Privacy Hub

The **Privacy Hub** (`/settings/privacy`) controls your data. It is also embedded in the Account page.

### Data export

Download everything Sky Style stores about you as a structured JSON file:

- Includes your profile, settings, closet, usage history, feedback, and security logs.
- Human-readable and machine-parseable, with a version stamp and export timestamp.

Exports are rate-limited: non-Dev accounts can request one export every **12 hours**. A countdown shows when the next export is available.

### Account deletion

Request permanent deletion of your account and all associated data:

- This is a **human-reviewed process** — a developer actions it within 7 days.
- Until then, you can **cancel** at any time from the Privacy Hub or the banner shown on the dashboard.
- An optional **reason** (max 1000 characters) helps improve Sky Style.

While a deletion is pending, a banner appears on the dashboard with quick links to manage the request or contact a developer.

::: warning Cancellation window
You retain full access to Sky Style while a deletion request is pending review. Cancelling restores your account to normal immediately.
:::
