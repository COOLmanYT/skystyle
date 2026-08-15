# Production at `skystyle.app`

Sky Style is live at `https://skystyle.app`, with `https://www.skystyle.app` and `https://docs.skystyle.app` attached as production hosts. `NEXT_PUBLIC_SITE_URL` and `AUTH_URL` use the apex production URL for canonical metadata and authentication.

Keep these settings verified after every provider or deployment change:

1. Make the apex domain primary in Vercel and redirect `www` to it.
2. Keep `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` set to `https://skystyle.app` for production; preview deployments retain their own Vercel URL.
3. Keep GitHub and Google callback URLs on `https://skystyle.app/api/auth/callback/...`.
4. Keep Supabase Auth Site URL and redirect allow-list aligned with `https://skystyle.app` plus required preview URLs.
5. Smoke-test sign-in, sign-out, provider callbacks, API requests, canonical URLs, and the `www` redirect after deployment.

## Documentation host

`apps/docs` is deployed as its own Vercel project at `https://docs.skystyle.app`. Keep `DOCS_SITE_URL=https://docs.skystyle.app` in the docs project and verify VitePress sitemap/canonical URLs after docs releases.

The public API remains at `https://skystyle.app/api/v1/*`; no CORS change is required because it already permits external clients.
