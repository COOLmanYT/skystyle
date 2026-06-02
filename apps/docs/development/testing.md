# Testing

Sky Style uses Jest with TypeScript support for unit testing.

## Setup

All test dependencies are included in the project. No additional setup is required.

## Running Tests

```bash
# Run all tests once
npm test

# Run in watch mode (auto-reload on changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run for CI (single run with coverage)
npm run test:ci
```

## Test Structure

```
apps/web/src/
├── __tests__/
│   ├── setup.ts    # Global test setup and mocks
│   └── mocks.ts    # Mock data and utilities
├── lib/
│   └── __tests__/
│       ├── ai.test.ts           # AI module
│       ├── api-keys.test.ts     # API keys
│       ├── credits.test.ts      # Credits system
│       ├── weather.test.ts       # Weather functions
│       ├── weather-cache.test.ts # Weather caching
│       └── daily-usage.test.ts   # Usage tracking
└── app/api/
    └── __tests__/
        ├── style.test.ts      # Style API route
        └── followup.test.ts    # Followup API route
```

## Test Coverage

| Module | Tests | Coverage |
|--------|-------|----------|
| AI Module | 20+ | ~90% |
| API Keys | 25+ | ~100% |
| Credits | 20+ | ~95% |
| Weather | 30+ | ~95% |
| Weather Cache | 25+ | ~100% |
| Daily Usage | 20+ | ~90% |
| Style API | 25+ | ~85% |
| Followup API | 30+ | ~85% |

**Total: 170+ unit tests**

## Mocking

### Environment Variables

All required environment variables are mocked in `setup.ts`:

- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_SECRET`, `AUTH_URL`
- `OPENWEATHER_API_KEY`

### Next.js

Next.js specific functionality is mocked:

- `next/navigation` - Router mocks
- `next/headers` - Headers mock
- `next/server` - Server functions mock

### External Dependencies

- Supabase - Database operations mocked
- Auth.js - Session handling mocked
- Fetch - Global fetch mocked
- localStorage - Client storage mocked

## Writing Tests

### Unit Tests for Library Functions

```typescript
// apps/web/src/lib/__tests__/module.test.ts

import { functionToTest } from '../module';

describe('Module', () => {
  describe('functionToTest', () => {
    it('should do something', () => {
      const result = functionToTest(input);
      expect(result).toBe(expected);
    });
  });
});
```

### API Route Tests

```typescript
// apps/web/src/app/api/__tests__/route.test.ts

import { POST } from '../route';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: mockUser }),
}));

describe('API Route', () => {
  it('should return 200 for valid request', async () => {
    const req = { json: jest.fn().mockResolvedValue(body) } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

## Best Practices

- Group related tests with `describe()` blocks
- Use clear, descriptive test names
- Mock at the module level
- Restore mocks between tests
- Test edge cases and error conditions
- Keep test data realistic
