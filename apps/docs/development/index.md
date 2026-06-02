# Development

Sky Style development guides and technical documentation.

## Local Development

From repository root:

```bash
npm install
npm run dev
```

This starts the Next.js web app in development mode.

## Project Structure

```
.
├── apps/
│   ├── web/         # Next.js production app (skystyle.app)
│   └── docs/        # VitePress documentation site
├── supabase/        # Database schema and migrations
└── package.json     # Root package with workspaces
```

## Testing

Sky Style uses Jest for unit testing.

### Running Tests

```bash
npm test
```

### Test Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:ci` | Run tests for CI (single run with coverage) |

### Test Coverage

Tests cover all major modules and API routes:

- AI module (model selection, tiering, BYOK)
- API keys (generation, hashing, verification)
- Credits system
- Weather data and caching
- Daily usage tracking
- API routes (style, followup)

## Deployment

- **Web app**: skystyle.app (Vercel)
- **Docs**: skystyle-docs.vercel.app (Vercel)
- **Database**: Supabase

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request
