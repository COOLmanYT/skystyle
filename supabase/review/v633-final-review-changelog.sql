-- Development review fix; the full candidate remains undeployed.
INSERT INTO changelog_posts (version, title, body, published, created_at, updated_at, category, type, content, large, show_on_next_login)
VALUES (
 '6.3.3',
 '6.3.3 development: reliable AI item swaps',
 'AI item swaps now select a configured hosted provider while preserving BYOK selection. The full candidate remains undeployed; device and cloud acceptance are pending.',
 true,
 '2026-10-10T11:00:17.000+00',
 '2026-10-10T11:00:17.000+00',
 '🚧 Development',
 'update',
 'Final review found that Pro and Dev item swaps selected OpenAI even when its hosted credentials were absent. Hosted swaps now reuse the configured-provider selection used by scheduled advice. BYOK continues through its selected provider without requiring hosted credentials. Regression tests cover configured Gemini, BYOK without hosted keys, and recoverable failure when no hosted provider is configured. The full 6.3.3 candidate remains on a separate branch and is not deployed. Structured cloud flows, Safari and physical-device acceptance remain pending. Accounting and checkout remain disabled.',
 false,
 false
);
