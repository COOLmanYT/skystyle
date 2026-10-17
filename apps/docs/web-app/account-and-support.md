# Account & Support

## Account page

The **Account** page (`/account`) is the hub for your profile and safety controls. It shows:

- Your **plan badge** — Free, Pro, or Dev.
- **AI usage today** against your daily limits.
- **Credits** balances (Pro/Dev only), via the Credit Center.
- Embedded **[Security](./security-and-privacy#security-page)** and **[Privacy Hub](./security-and-privacy#privacy-hub)** sections.

Use it as the entry point for security settings, privacy controls, and API access.

### Credit Center

The Credit Center (embedded in the Account page for Pro/Dev users) shows your three balances and lets you allocate `$1.00 → 50 API Credit` to a chosen key. See [API Dashboard → Credits](./api-dashboard#credits) for the full breakdown.

## Plans {#plans}

Approved V6 values are [documented centrally](../development/v6-entitlements#authoritative-values) and shown with an inactive-rollout notice on the homepage, Pricing and Account. They include A$6.99/month Pro and daily **and** monthly caps. The current account allowance is still governed by legacy accounting until cutover; do not interpret the new plan cards as an activated entitlement or a purchase offer.

- The **Dev** tier bypasses all limits and is only provisioned to developer accounts.
- The **Demo** tier retains fixed preview limits (200 recommendations and 400 follow-ups/day), not ten times the new Free caps.

PAYG values are approved but purchases are unavailable. Pro periods can be explicitly configured by a whitelisted Dev administrator without collecting a payment; staging them does not change legacy access. Donations are not subscriptions or credit top-ups.

## Live Demo {#live-demo}

The landing page at [skystyle.app/#demo](https://skystyle.app/#demo) offers a **no-login live demo**: pick a location and see real weather data (no AI recommendation in the demo). It's a quick way to evaluate Sky Style before creating an account.

## Feedback {#feedback}

The **Feedback** page (`/feedback`) lets signed-in users share a bug report, suggestion, or message:

- Pro and Dev context is passed along automatically.
- Your past submissions are tracked as **tickets** you can review on the same page.
- Every message is read personally.

You must be signed in to send feedback.

## Inbox {#inbox}

The **Inbox** keeps recommendation, support, system, and changelog notices together in one place:

- Automatic recommendation results are delivered here.
- Unread counts surface across the app.
- Notices are categorised (recommendation, support, system, changelog).

## Changelog {#changelog}

The **Changelog** page (`/changelog`) lists every published release. Entries can include:

- A version number, title, and short description.
- Extended Markdown content with inline images.
- A category and type (update or post).
- A call-to-action button linking to more detail.
- A "large" modal view for richer posts.

New entries can surface on your next login; the [Settings](./settings) page also shows a preview of recent changes.

## Help and service status {#help-and-service-status}

Use the app **[Inbox](#inbox)** or **[Feedback](#feedback)** page for account help. API users should consult the [API error guide](../api/errors) and the [COOLman service status page](https://status.coolmanyt.com/) for service and downtime information.

Monitoring integrations can use the status page's [live component status JSON](https://status.coolmanyt.com/v3/components.json).
