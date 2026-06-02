/**
 * Mock data and utilities for SkyStyle tests
 */

import { WeatherData, SourceWeatherData, HourlyForecast } from '@/lib/weather';
import { StyleRecommendation, ModelConfig, ModelID, ModelProvider } from '@/lib/ai';
import { DailyUsageRecord } from '@/lib/daily-usage';

// ============================================================================
// Weather Mock Data
// ============================================================================

export const mockHourlyForecast: HourlyForecast[] = [
  {
    time: '2024-01-15T10:00:00Z',
    temp: 22,
    description: 'Clear sky',
    rainChance: 0,
    windSpeed: 10,
  },
  {
    time: '2024-01-15T11:00:00Z',
    temp: 24,
    description: 'Few clouds',
    rainChance: 5,
    windSpeed: 12,
  },
  {
    time: '2024-01-15T12:00:00Z',
    temp: 26,
    description: 'Scattered clouds',
    rainChance: 10,
    windSpeed: 15,
  },
];

export const mockSourceWeatherData: SourceWeatherData[] = [
  {
    temp: 22,
    feelsLike: 21,
    humidity: 65,
    windSpeed: 10,
    windDir: 'N',
    description: 'Clear sky',
    rainChance: 0,
    uvIndex: 5,
    source: 'OpenWeather',
    hourly: mockHourlyForecast,
  },
  {
    temp: 23,
    feelsLike: 22,
    humidity: 60,
    windSpeed: 12,
    windDir: 'NE',
    description: 'Few clouds',
    rainChance: 5,
    uvIndex: 6,
    source: 'Open-Meteo',
  },
];

export const mockWeatherData: WeatherData = {
  temp: 22.5,
  feelsLike: 21.5,
  humidity: 62,
  windSpeed: 11,
  windDir: 'N',
  description: 'Clear sky with few clouds',
  rainChance: 2,
  uvIndex: 5,
  isDay: true,
  alerts: [],
  stationName: 'Sydney Observatory',
  stationDistanceKm: 5,
  accuracyScore: 'High',
  source: 'Multi',
  hourly: mockHourlyForecast,
  sources: mockSourceWeatherData,
};

// ============================================================================
// AI Mock Data
// ============================================================================

export const mockStyleRecommendation: StyleRecommendation = {
  outfit: 'Wear a light t-shirt, jeans, and comfortable sneakers. Add a light jacket for the evening.',
  reasoning: 'The weather is clear with mild temperatures. A t-shirt and jeans will keep you comfortable during the day, while a light jacket will provide warmth as temperatures drop in the evening.',
  modelUsed: 'gpt-4o',
};

export const mockModelConfigs: ModelConfig[] = [
  { id: 'gpt-4o', provider: 'openai', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', provider: 'openai', name: 'GPT-4o Mini' },
  { id: 'gemini-2.5-flash', provider: 'gemini', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', provider: 'gemini', name: 'Gemini 2.5 Flash Lite' },
  { id: 'mistral-large-latest', provider: 'mistral', name: 'Mistral Large' },
  { id: 'mistral-small-latest', provider: 'mistral', name: 'Mistral Small' },
  { id: 'ministral-8b-latest', provider: 'mistral', name: 'Ministral 8B' },
];

export const mockByokModels: ModelConfig[] = [
  { id: 'byok-openai', provider: 'openai', name: 'BYOK - OpenAI' },
  { id: 'byok-gemini', provider: 'gemini', name: 'BYOK - Gemini' },
  { id: 'byok-mistral', provider: 'mistral', name: 'BYOK - Mistral' },
];

// ============================================================================
// User & Session Mock Data
// ============================================================================

export const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  image: 'https://example.com/avatar.jpg',
  is_pro: false,
  is_dev: false,
};

export const mockProUser = {
  ...mockUser,
  is_pro: true,
};

export const mockDevUser = {
  ...mockUser,
  is_dev: true,
};

export const mockSession = {
  user: mockUser,
  expires: '2024-12-31T23:59:59.000Z',
};

// ============================================================================
// Daily Usage Mock Data
// ============================================================================

export const mockDailyUsageRecord: DailyUsageRecord = {
  user_id: 'test-user-id',
  usage_date: '2024-01-15',
  ai_uses: 5,
  follow_ups: 10,
  closet_uses: 2,
  source_picks: 1,
  model_switches: 0,
};

export const mockDailyUsageRecordWithModelSwitches: DailyUsageRecord = {
  ...mockDailyUsageRecord,
  model_switches: 2,
};

// ============================================================================
// API Response Mocks
// ============================================================================

export const mockSuccessResponse = (data: any, status: number = 200) => ({
  ok: true,
  status,
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
});

export const mockErrorResponse = (message: string, status: number = 400) => ({
  ok: false,
  status,
  json: jest.fn().mockResolvedValue({ error: message }),
  text: jest.fn().mockResolvedValue(JSON.stringify({ error: message })),
});

// ============================================================================
// Supabase Mock
// ============================================================================

export const mockSupabaseAdmin = {
  from: jest.fn((table: string) => mockSupabaseAdmin),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  data: mockUser,
  error: null,
};

// ============================================================================
// Utility Functions
// ============================================================================

export function createMockFetch(response: any, status: number = 200): jest.Mock {
  return jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
    })
  );
}

export function createMockFetchError(message: string, status: number = 500): jest.Mock {
  return jest.fn().mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({ error: message }),
      text: () => Promise.resolve(JSON.stringify({ error: message })),
    })
  );
}

export function mockConsoleMethods() {
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  
  beforeEach(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
  });
  
  afterEach(() => {
    console.error = originalError;
    console.warn = originalWarn;
    console.log = originalLog;
  });
}

export function mockDate(now: Date) {
  const originalDate = global.Date;
  
  beforeEach(() => {
    global.Date = class extends originalDate {
      constructor() {
        super();
        return now;
      }
      
      static now() {
        return now.getTime();
      }
      
      static today() {
        return now.toISOString().split('T')[0];
      }
    } as any;
  });
  
  afterEach(() => {
    global.Date = originalDate;
  });
}

// ============================================================================
// Test Helpers
// ============================================================================

export function expectToBeCalledWith(mock: jest.Mock, expected: any) {
  expect(mock).toHaveBeenCalledWith(expect.objectContaining(expected));
}

export function expectToBeCalledTimes(mock: jest.Mock, times: number) {
  expect(mock).toHaveBeenCalledTimes(times);
}

export function expectToThrowAsync(fn: () => Promise<any>, errorMessage?: string) {
  if (errorMessage) {
    return expect(fn()).rejects.toThrow(errorMessage);
  }
  return expect(fn()).rejects.toThrow();
}

export function waitForTimeout(ms: number = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
