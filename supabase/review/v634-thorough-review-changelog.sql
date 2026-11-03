-- Executed and independently verified on 10 October 2026.
-- Row: 05cbe1d9-b503-4eb7-a6cc-3519b09a2e5e. Development announcement only.
-- Receipt, not a migration; do not replay automatically.
INSERT INTO public.changelog_posts
  (version, title, body, published, created_at, updated_at, category, type, show_on_next_login)
VALUES (
  '6.3.4',
  '6.3.4 development: review and reliability',
  'Development candidate: patched framework/auth dependencies, preserved duplicate wardrobe items, enforced model access and protected comfort edits. Not deployed; acceptance gates remain.',
  true, '2026-10-10T11:39:54Z', '2026-10-10T11:39:54Z', '🚧 Development', 'update', false
);
