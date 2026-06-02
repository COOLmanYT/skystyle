/**
 * Jest setup file for SkyStyle tests
 * This file runs before each test file
 */

import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.MISTRAL_API_KEY = 'test-mistral-key';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-supabase-key';
process.env.AUTH_SECRET = 'test-auth-secret';
process.env.AUTH_URL = 'http://localhost:3000';
process.env.OPENWEATHER_API_KEY = 'test-weather-key';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  redirect: jest.fn(),
}));

// Mock Next.js headers
jest.mock('next/headers', () => ({
  cookies: () => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  }),
}));

// Mock Next.js server functions
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => new Response(JSON.stringify(data), {
      status: init?.status || 200,
      headers: { 'content-type': 'application/json' },
    })),
  },
  NextRequest: jest.fn(),
}));

// Global test utilities
beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((...args) => {
    // Only log actual errors, not warnings from dependencies
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Error:')) {
      originalConsoleError(...args);
    }
  });
  
  console.warn = jest.fn((...args) => {
    // Only log actual warnings, not dependency warnings
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Warning:')) {
      originalConsoleWarn(...args);
    }
  });
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock fetch for API tests
global.fetch = jest.fn() as jest.Mock;

// Mock localStorage for client component tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
});
