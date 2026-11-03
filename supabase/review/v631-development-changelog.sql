-- Development announcement only; schema and rollout remain unchanged.
INSERT INTO public.changelog_posts
  (version, title, body, published, created_at, updated_at, category, type, content, large, show_on_next_login)
VALUES (
  '6.3.1',
  '6.3.1 development: clothing links and UI fixes',
  'Branch review adds clothing references, fixes wardrobe and settings flows, improves responsive layouts and aligns documentation. Production deployment and live acceptance are pending.',
  true,
  '2026-10-04T06:45:00.000+00',
  '2026-10-04T06:45:00.000+00',
  '🚧 Development',
  'update',
  '## Development candidate

Clothing links use reserved Markdown references by name or stable wardrobe ID. Owned items are highlighted and open their Closet row; unowned or deleted references prepare Shop without automatically searching.

The review consolidates closet editing, preserves single-item swap checklists, repairs settings saves and Unicode preferences, corrects plan and privacy copy, improves touch controls and reduced motion, and aligns the guides and API documentation. Documentation navigation now fits tablet screens.

Local verification passed 537 tests across 52 suites, lint, the app and documentation builds, and responsive checks at six screen sizes. Browser checks used synthetic demo data and do not establish physical-device, authenticated cloud or real-provider acceptance.

The branch remains local and has not been deployed. The reviewed database schema has not been installed in production. Live scheduler authentication and a delivered result remain pending; accounting enforcement and checkout remain disabled.',
  false,
  false
)
RETURNING id, version, title, published, category, show_on_next_login;
