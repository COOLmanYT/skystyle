/**
 * Unit tests for Style API route
 * Tests model selection, validation, and rate limiting
 */

import { POST } from '../style/route';
import { NextRequest, NextResponse } from 'next/server';

import {
  mockUser,
  mockProUser,
  mockSession,
  mockWeatherData,
  mockStyleRecommendation,
  createMockFetch,
  createMockFetchError,
} from '../../../__tests__/mocks';

// Mock dependencies
jest.mock('@/auth', () => ({
  auth: jest.fn().mockResolvedValue(mockSession),
  DEMO_USER_ID: 'demo-user-id',
}));

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: mockUser, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

jest.mock('@/lib/weather', () => ({
  getWeather: jest.fn().mockResolvedValue(mockWeatherData),
  CustomSource: jest.fn(),
  SourceMode: jest.fn(),
  MAX_CUSTOM_SOURCES: 5,
}));

jest.mock('@/lib/ai', () => ({
  getStyleRecommendation: jest.fn().mockResolvedValue(mockStyleRecommendation),
  getDevChatResponse: jest.fn().mockResolvedValue(mockStyleRecommendation),
  PlanningData: jest.fn(),
  ModelID: jest.fn(),
  getModelById: jest.fn((modelId: string) => {
    const validModels = ['gpt-4o', 'gemini-2.5-flash', 'mistral-large-latest'];
    return validModels.includes(modelId) ? { id: modelId, provider: 'openai', name: modelId } : null;
  }),
}));

jest.mock('@/lib/credits', () => ({
  deductCredit: jest.fn().mockResolvedValue(49),
  getCredits: jest.fn().mockResolvedValue(50),
}));

jest.mock('@/lib/daily-usage', () => ({
  incrementUsage: jest.fn().mockResolvedValue(true),
  canUseFeature: jest.fn().mockResolvedValue({ allowed: true, used: 0, limit: 20 }),
  getDailyLimitsInfo: jest.fn().mockResolvedValue({
    ai: { used: 0, limit: 20 },
    followUps: { used: 0, limit: 40 },
    closet: { used: 0, limit: 4 },
    sourcePicks: { used: 0, limit: 4 },
    model_switches: { used: 0, limit: 2 },
  }),
}));

jest.mock('@/lib/sync-user', () => ({
  syncPublicUser: jest.fn().mockResolvedValue(null),
}));

// Helper to create mock NextRequest
function createMockNextRequest(body: unknown): NextRequest {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn((key: string) => {
        if (key === 'content-type') return 'application/json';
        return null;
      }),
    },
  } as unknown as NextRequest;
}

describe('Style API Route - Authentication', () => {
  it('should return 401 for unauthenticated requests', async () => {
    // Mock unauthenticated session
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue(null);
    
    const req = createMockNextRequest({ lat: 40.7128, lon: -74.0060 });
    const res = await POST(req);
    
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
    
    // Restore original
    authModule.auth = originalAuth;
  });

  it('should return 400 for invalid JSON body', async () => {
    const req = {
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    } as unknown as NextRequest;
    
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid JSON body');
  });
});

describe('Style API Route - Input Validation', () => {
  it('should return 400 for missing coordinates', async () => {
    const req = createMockNextRequest({});
    const res = await POST(req);
    
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid latitude range', async () => {
    const req = createMockNextRequest({ lat: 100, lon: -74.0060 });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('lat must be between -90 and 90');
  });

  it('should return 400 for invalid longitude range', async () => {
    const req = createMockNextRequest({ lat: 40.7128, lon: 200 });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('lon between -180 and 180');
  });

  it('should return 400 for invalid model ID', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060,
      modelId: 'invalid-model-id'
    });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid model ID');
  });

  it('should accept valid model ID', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060,
      modelId: 'gpt-4o'
    });
    
    // Mock the model validation
    const aiModule = await import('@/lib/ai');
    const originalGetModelById = aiModule.getModelById;
    aiModule.getModelById = jest.fn().mockReturnValue({ id: 'gpt-4o', provider: 'openai', name: 'GPT-4o' });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
    
    // Restore original
    aiModule.getModelById = originalGetModelById;
  });
});

describe('Style API Route - Model Switch Rate Limiting', () => {
  it('should allow model switch for free users under limit', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060,
      modelId: 'gemini-2.5-flash' // Different from default
    });
    
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    // Mock canUseFeature to allow model switch
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalCanUseFeature = dailyUsageModule.canUseFeature;
    dailyUsageModule.canUseFeature = jest.fn().mockResolvedValue({ 
      allowed: true, 
      used: 0, 
      limit: 2 
    });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(429);
    
    // Restore originals
    authModule.auth = originalAuth;
    dailyUsageModule.canUseFeature = originalCanUseFeature;
  });

  it('should deny model switch for free users at limit', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060,
      modelId: 'gemini-2.5-flash' // Different from default
    });
    
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    // Mock canUseFeature to deny model switch (at limit)
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalCanUseFeature = dailyUsageModule.canUseFeature;
    dailyUsageModule.canUseFeature = jest.fn().mockResolvedValue({ 
      allowed: false, 
      used: 2, 
      limit: 2 
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('Model switch limit reached');
    
    // Restore originals
    authModule.auth = originalAuth;
    dailyUsageModule.canUseFeature = originalCanUseFeature;
  });

  it('should allow model switch for pro users regardless of usage', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060,
      modelId: 'gpt-4o'
    });
    
    // Mock user as pro
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockProUser });
    
    // Mock canUseFeature to allow (pro users have infinite limit)
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalCanUseFeature = dailyUsageModule.canUseFeature;
    dailyUsageModule.canUseFeature = jest.fn().mockResolvedValue({ 
      allowed: true, 
      used: 100, 
      limit: Infinity 
    });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(429);
    
    // Restore originals
    authModule.auth = originalAuth;
    dailyUsageModule.canUseFeature = originalCanUseFeature;
  });
});

describe('Style API Route - BYOK Provider Validation', () => {
  it('should accept openai as byokProvider', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060,
      userApiKey: 'test-key',
      byokProvider: 'openai'
    });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
  });

  it('should accept gemini as byokProvider', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060,
      userApiKey: 'test-key',
      byokProvider: 'gemini'
    });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
  });

  it('should accept mistral as byokProvider', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060,
      userApiKey: 'test-key',
      byokProvider: 'mistral'
    });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
  });

  it('should default to openai when byokProvider is not specified', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060,
      userApiKey: 'test-key'
    });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
  });
});

describe('Style API Route - Successful Requests', () => {
  it('should return weather and recommendation for valid request', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060 
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data).toHaveProperty('weather');
    expect(data).toHaveProperty('recommendation');
    expect(data).toHaveProperty('meta');
    
    expect(data.weather).toEqual(mockWeatherData);
    expect(data.recommendation).toEqual(mockStyleRecommendation);
  });

  it('should include modelUsed in response', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060 
    });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(data.meta).toHaveProperty('modelUsed');
  });

  it('should include dailyLimits in response for free users', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060 
    });
    
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(data.meta).toHaveProperty('dailyLimits');
    expect(data.meta.dailyLimits).toHaveProperty('model_switches');
    
    // Restore original
    authModule.auth = originalAuth;
  });

  it('should include creditsRemaining for pro users', async () => {
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060 
    });
    
    // Mock user as pro
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockProUser });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(data.meta).toHaveProperty('creditsRemaining');
    
    // Restore original
    authModule.auth = originalAuth;
  });
});

describe('Style API Route - Error Handling', () => {
  it('should return 502 for weather fetch failure', async () => {
    // Mock weather fetch to fail
    const weatherModule = await import('@/lib/weather');
    const originalGetWeather = weatherModule.getWeather;
    weatherModule.getWeather = jest.fn().mockRejectedValue(new Error('Weather fetch failed'));
    
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060 
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain('Weather fetch failed');
    
    // Restore original
    weatherModule.getWeather = originalGetWeather;
  });

  it('should return 502 for AI recommendation failure', async () => {
    // Mock AI recommendation to fail
    const aiModule = await import('@/lib/ai');
    const originalGetStyleRecommendation = aiModule.getStyleRecommendation;
    aiModule.getStyleRecommendation = jest.fn().mockRejectedValue(new Error('AI request failed'));
    
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060 
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain('AI request failed');
    
    // Restore original
    aiModule.getStyleRecommendation = originalGetStyleRecommendation;
  });

  it('should return 402 for pro users with insufficient credits', async () => {
    // Mock user as pro with no credits
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockProUser });
    
    // Mock getCredits to return 0
    const creditsModule = await import('@/lib/credits');
    const originalGetCredits = creditsModule.getCredits;
    creditsModule.getCredits = jest.fn().mockResolvedValue(0);
    
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060 
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(402);
    const data = await res.json();
    expect(data.error).toContain('Insufficient credits');
    
    // Restore originals
    authModule.auth = originalAuth;
    creditsModule.getCredits = originalGetCredits;
  });

  it('should return 429 for free users at AI limit', async () => {
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    // Mock canUseFeature to deny AI usage
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalCanUseFeature = dailyUsageModule.canUseFeature;
    dailyUsageModule.canUseFeature = jest.fn().mockResolvedValue({ 
      allowed: false, 
      used: 20, 
      limit: 20 
    });
    
    const req = createMockNextRequest({ 
      lat: 40.7128, 
      lon: -74.0060 
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('Daily AI limit reached');
    
    // Restore originals
    authModule.auth = originalAuth;
    dailyUsageModule.canUseFeature = originalCanUseFeature;
  });
});

describe('Style API Route - Dev Mode', () => {
  it('should handle dev chat messages for dev users', async () => {
    const req = createMockNextRequest({ 
      lat: 0, 
      lon: 0,
      devMessage: 'Test dev chat message'
    });
    
    // Mock user as dev
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ 
      user: { 
        ...mockUser, 
        is_dev: true 
      } 
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('recommendation');
    
    // Restore original
    authModule.auth = originalAuth;
  });

  it('should not allow dev chat for non-dev users', async () => {
    const req = createMockNextRequest({ 
      lat: 0, 
      lon: 0,
      devMessage: 'Test dev chat message'
    });
    
    // Mock user as non-dev
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    const res = await POST(req);
    
    // Should not use dev chat, but regular flow
    expect(res.status).toBe(200);
    
    // Restore original
    authModule.auth = originalAuth;
  });
});
