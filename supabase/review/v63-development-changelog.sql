-- Development announcement only. This does not apply schema or enable rollout.
INSERT INTO public.changelog_posts
  (version, title, body, published, created_at, updated_at, category, type, content, large, show_on_next_login)
VALUES (
  '6.3.0',
  '6.3.0 development: dependable daily outfits',
  'Branch work adds structured wardrobes, saved outfits, comfort controls and reliability fixes. Production rollout is pending database review and live acceptance.',
  true,
  '2026-10-04T00:25:35.000+00',
  '2026-10-04T00:25:35.000+00',
  '🚧 Development',
  'update',
  '## Development candidate

Sky Style 6.3.0 branch work improves everyday outfit advice with structured wardrobe items, saved and reusable outfits, single-item swaps, explicit comfort controls and advice across a time window.

Reliability work includes missing-weather handling, bounded provider requests, usable-output validation before charging, account-scoped BYOK controls, concurrent edit protection and durable scheduled finalization.

This is a development announcement. The new database schema has not been applied to production and the branch has not been deployed. Accounting enforcement and checkout remain disabled. Production release requires exact SQL review, authenticated acceptance, a verified scheduled delivery and real-provider usefulness and cost evidence.',
  false,
  false
);
