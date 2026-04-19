# Platform Guide

This guide explains how Sky Style is organized and operated across projects.

## Product Overview

Sky Style delivers weather-aware outfit recommendations powered by AI and user wardrobe context.

Core capabilities:

- Hyper-local weather ingestion and aggregation
- AI recommendations with follow-up prompts
- Closet-aware suggestions
- Account, privacy, and security tooling

## Architecture

Sky Style uses a single monorepo with separate deployable apps.

- apps/web: Main Next.js app
- apps/docs: Documentation website
- apps/api: Future standalone API surface

## Deployment Targets

- skystyle.app: Main product experience
- skystyle-docs.vercel.app: Documentation and integration guides
- api.skystyle.app: Future API endpoint base

## Environment Notes

The current public preview is still a work-in-progress and proof of concept:

- https://what2wear-two.vercel.app

## Local Development

From repository root:

```bash
npm install
npm run dev
```

For docs only:

```bash
cd apps/docs
npm install
npm run dev
```

## Operational Tips

- Keep web and docs as independent Vercel projects with their own root directories.
- Treat apps/api as non-production scaffold until API contracts are finalized.
- Keep changelog updates synchronized with user-facing behavior changes.
