# Moving production to `skystyle.app`

This repository is configured to use `NEXT_PUBLIC_SITE_URL=https://skystyle.app` for canonical metadata and `AUTH_URL=https://skystyle.app` for production authentication. Complete the following in order when the domain has been registered.

1. In Vercel, add `skystyle.app` and `www.skystyle.app` to the web project. Make the apex domain primary and redirect `www` to it.
2. At the domain registrar, add the DNS records Vercel provides. Do not remove the current Vercel domain until production smoke tests pass.
3. In Vercel production environment variables, set `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to `https://skystyle.app`, then redeploy. Preview deployments keep using their own Vercel URL automatically.
4. Update the GitHub OAuth app callback URL to `https://skystyle.app/api/auth/callback/github` and the Google OAuth client redirect URI to `https://skystyle.app/api/auth/callback/google`. Keep the old callback URLs temporarily if the providers allow multiple entries.
5. In Supabase Auth URL Configuration, set the Site URL to `https://skystyle.app` and allow `https://skystyle.app/**` plus the Vercel preview URLs required for testing.
6. Verify sign-in, sign-out, passwordless/provider callbacks, API requests, canonical URLs, and the `www` redirect. Only then redirect or retire the old production hostname.

## Documentation host

Deploy `apps/docs` as its own Vercel project, then add `docs.skystyle.app` to that project and create the Vercel DNS record supplied for the hostname. Set `DOCS_SITE_URL=https://docs.skystyle.app` in the docs project, redeploy, and verify the VitePress sitemap/canonical URLs before retiring `skystyle-docs.vercel.app`.

The public API remains at `https://skystyle.app/api/v1/*`; no CORS change is required because it already permits external clients.
