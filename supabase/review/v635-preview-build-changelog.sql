-- 6.3.5 development announcement. Receipt, not a migration.
-- Executed and independently verified on 11 October 2026 (Australia/Sydney).
-- Verified row: faaa22e1-3c34-47ea-8f9f-be882e276b68. Do not replay automatically.
INSERT INTO public.changelog_posts
  (version, title, body, published, created_at, updated_at, category, type, show_on_next_login)
VALUES (
  '6.3.5',
  '6.3.5 development: preview build and release gate',
  'Development fix: isolate Jest types from app builds, remove an invalid page export, and require a successful app preview for the exact release commit. Production acceptance remains pending.',
  true, '2026-10-10T20:53:06Z', '2026-10-10T20:53:06Z', '🚧 Development', 'update', false
);
