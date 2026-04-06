---
outline: deep
---

# API Guide

This page summarizes the currently available API surface in the Sky Style web app.

## Base Path

Current API endpoints are served from the web app under:

- /api/*

Future plan:

- Dedicated API host at api.skystyle.app

## Common Endpoints

### Recommendations

- POST /api/style
- Generates outfit recommendations based on weather and profile context

### Weather

- POST /api/weather
- POST /api/geocode
- POST /api/demo/weather
- POST /api/demo/geocode

### User Data

- POST /api/closet
- GET or POST /api/settings
- GET /api/credits
- GET /api/daily-limits

### Follow-up and Chat

- POST /api/followup

### Security and Privacy

- POST /api/mfa/setup
- POST /api/mfa/verify
- POST /api/mfa/disable
- GET /api/passkeys/list
- POST /api/passkeys/register
- GET /api/security/logs
- POST /api/privacy/export
- POST /api/privacy/request-deletion
- POST /api/privacy/cancel-deletion

## Auth

Sky Style uses NextAuth v5 with JWT sessions. Client-side session reads are available via:

- /api/auth/session

Auth route handler:

- /api/auth/[...nextauth]

## Integration Notes

- Expect JSON request and response payloads for API endpoints.
- Treat endpoints as product-internal APIs until the standalone API project is launched.
- Apply rate-limit and plan-tier checks in any client integration flow.
