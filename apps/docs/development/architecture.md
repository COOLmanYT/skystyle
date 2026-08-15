# Architecture

## Overview

Sky Style is organized as a monorepo with multiple deployable applications.

## Monorepo Structure

```
.
├── apps/
│   ├── web/         # Next.js 16 production app
│   │   ├── src/     # Application source
│   │   │   ├── app/ # App router pages and API routes
│   │   │   ├── lib/ # Shared library code
│   │   │   └── components/ # React components
│   │   ├── next.config.ts
│   │   └── package.json
│   │
│   └── docs/        # VitePress documentation
│       ├── .vitepress/
│       └── api/     # API documentation
│
├── supabase/        # Database schema and migrations
│   ├── schema.sql
│   └── migrations/
│
└── package.json     # Root package with npm workspaces
```

## Web App (apps/web)

### Framework

- **Next.js 16** with App Router
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**

### Key Dependencies

- `@google/generative-ai` - Gemini API client
- `@mistralai/mistralai` - Mistral API client
- `openai` - OpenAI API client
- `@supabase/supabase-js` - Database client
- `next-auth` - Authentication
- `@simplewebauthn/browser` - WebAuthn support

### Directory Structure

```
apps/web/
├── src/
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   ├── style/        # Outfit recommendations
│   │   │   ├── followup/     # Follow-up recommendations
│   │   │   ├── weather/      # Weather data
│   │   │   └── ...
│   │   ├── (auth)/           # Authentication pages
│   │   ├── dashboard/        # Main dashboard
│   │   └── layout.tsx
│   │
│   ├── components/           # React components
│   │   ├── Dashboard.tsx     # Main dashboard component
│   │   ├── WeatherPlanningPanel.tsx
│   │   └── ...
│   │
│   ├── lib/                 # Library code
│   │   ├── ai.ts            # AI integration and model management
│   │   ├── weather.ts       # Weather data fetching and caching
│   │   ├── daily-usage.ts   # Rate limiting and usage tracking
│   │   ├── credits.ts       # Credits system
│   │   ├── api-keys.ts      # API key generation and verification
│   │   └── ...
│   │
│   └── __tests__/           # Test files
│       ├── setup.ts
│       └── mocks.ts
│
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Data Flow

```
User Request
     ↓
API Route (style/followup)
     ↓
Authentication Check
     ↓
Rate Limit Check (daily-usage.ts)
     ↓
Weather Data (weather.ts)
     ↓
AI Recommendation (ai.ts)
     ↓
Response with outfit suggestion
```

## AI Integration

### Supported Providers

- OpenAI (GPT-4o, GPT-4o Mini)
- Google Gemini (2.5 Flash, 2.5 Flash Lite)
- Mistral AI (Large Latest, Small Latest, Ministral)
- Gemma (served through the Gemini provider — no separate key required)

### Model Tiering

**Pro Users:**
1. OpenAI models
2. Gemini models
3. Mistral Large
4. Gemma
5. Mistral Small
6. Ministral

**Free Users:**
1. Gemini models
2. Mistral Small
3. Gemma
4. Ministral

### BYOK Support

Bring Your Own Key (BYOK) is supported for all providers. Users can configure their own API keys for:

- OpenAI
- Gemini
- Mistral

## Database (Supabase)

### Key Tables

- `users` - User accounts
- `daily_usage` - Usage tracking with rate limits
- `credits` - Pro user credits
- `settings` - User preferences
- `closet` - User wardrobe items

### Rate Limits

The `demo` tier is only created automatically when the deployment is a preview/development environment; it multiplies the free limits by 10 for preview testing.

| Feature | Free | Demo | Pro | Dev |
|---------|------|------|-----|-----|
| AI uses | 20/day | 200/day | ∞ | ∞ |
| Follow-ups | 40/day | 400/day | 400/day | ∞ |
| Closet uses | 4/day | 40/day | ∞ | ∞ |
| Source picks | 4/day | 40/day | ∞ | ∞ |
| Model switches | 2/day | 20/day | ∞ | ∞ |
