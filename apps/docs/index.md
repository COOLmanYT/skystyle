---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Sky Style Docs"
  text: "Weather-aware outfit intelligence"
  tagline: Product architecture, deployment guides, and API references
  image:
    src: /images/dashboard-2.png
    alt: Sky Style dashboard preview
  actions:
    - theme: brand
      text: Start with Platform Guide
      link: /markdown-examples
    - theme: alt
      text: Open API Guide
      link: /api-examples

features:
  - title: Main Product App
    details: Sky Style main app lives in apps/web and powers skystyle.app and preview deployments.
  - title: Docs Website
    details: This documentation site lives in apps/docs and is ready for docs.skystyle.app deployment.
  - title: Future API Service
    details: A placeholder exists in apps/api for api.skystyle.app, prepared for a staged rollout.
---

## Status

Sky Style is currently in active build mode. The existing public web deployment remains:

- https://what2wear-two.vercel.app

## Monorepo Layout

- apps/web: Next.js production app
- apps/docs: VitePress docs site
- apps/api: Future standalone API scaffold
- supabase: Schema and SQL assets

## Recommended Reading Path

1. Platform Guide: product architecture, environments, and deployment basics
2. API Guide: endpoint behavior and integration examples

## Preserved Starter Templates

The original VitePress generated examples are archived for future reference:

- /reference/vitepress-starter/archive

