-- Development candidate announcement; complete 6.3 deployment is still pending.
INSERT INTO changelog_posts (version, title, body, published, created_at, updated_at, category, type, content, large, show_on_next_login)
VALUES (
 '6.3.2',
 '6.3.2 development: scheduler acceptance fixes',
 'Fixed scheduled provider selection, repaired live scheduler authentication and GitHub sign-in, and verified one delivered outfit. Full 6.3 deployment and device acceptance remain pending.',
 true,
 '2026-10-10T10:18:13.000+00',
 '2026-10-10T10:18:13.000+00',
 '🚧 Development',
 'update',
 'The full 6.3.2 candidate remains undeployed. An isolated 6.1.1 production hotfix selects a configured hosted AI provider for scheduled advice. Scheduler authentication and GitHub issuer configuration were repaired. One Dev schedule generated a usable Gemini outfit, stored its weather and result, and delivered exactly one Inbox recommendation. Subsequent cron invocations returned HTTP 200 without duplicate delivery. Live checks also established GitHub sign-in, cloud wardrobe reads, onboarding persistence, weather provider responses and a usable dashboard outfit. Safari, physical devices and the complete 6.3 cloud flows still need acceptance. A post-hotfix attempt failed before the successful retry, so sustained reliability still needs monitoring. Accounting and checkout stay disabled.',
 false,
 false
);
