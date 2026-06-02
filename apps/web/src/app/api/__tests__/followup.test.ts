/**
 * Unit tests for Followup API route
 * Tests model selection, validation, and rate limiting for followup requests
 */

import { POST } from '../followup/route';
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

jest.mock('@/lib/ai', () => ({
  getFollowUpRecommendation: jest.fn().mockResolvedValue(mockStyleRecommendation),
  getDevChatResponse: jest.fn().mockResolvedValue(mockStyleRecommendation),
  PlanningData: jest.fn(),
  ModelID: jest.fn(),
  getModelById: jest.fn((modelId: string) => {
    const validModels = ['gpt-4o', 'gemini-2.5-flash', 'mistral-large-latest', 'mistral-small-latest'];
    return validModels.includes(modelId) ? { id: modelId, provider: 'openai', name: modelId } : null;
  }),
}));

jest.mock('@/lib/daily-usage', () => ({
  canUseFeature: jest.fn().mockResolvedValue({ allowed: true, used: 0, limit: 40 }),
  incrementUsage: jest.fn().mockResolvedValue(true),
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
function createMockNextRequest(body: any): NextRequest {
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

describe('Followup API Route - Authentication', () => {
  it('should return 401 for unauthenticated requests', async () => {
    // Mock unauthenticated session
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue(null);
    
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      previousReasoning: 'Test reasoning',
      weather: mockWeatherData
    });
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

describe('Followup API Route - Input Validation', () => {
  it('should return 400 for missing message', async () => {
    const req = createMockNextRequest({ 
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
    });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('message is required');
  });

  it('should return 400 for empty message', async () => {
    const req = createMockNextRequest({ 
      message: '   ',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
    });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('message is required');
  });

  it('should return 400 for missing previousOutfit', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      weather: mockWeatherData
    });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('previousOutfit and weather are required');
  });

  it('should return 400 for missing weather', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit'
    });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('previousOutfit and weather are required');
  });

  it('should return 400 for invalid model ID', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      modelId: 'invalid-model-id'
    });
    const res = await POST(req);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid model ID');
  });

  it('should accept valid model ID', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      modelId: 'gpt-4o'
    });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
  });
});

describe('Followup API Route - Model Switch Rate Limiting', () => {
  it('should allow model switch for free users under limit', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      modelId: 'gemini-2.5-flash' // Different from default
    });
    
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    // Mock canUseFeature to allow model switch
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalCanUseFeature = dailyUsageModule.canUseFeature;
    dailyUsageModule.canUseFeature = jest.fn()
      .mockImplementation((userId: string, feature: string, isPro: boolean, isDev: boolean) => {
        if (feature === 'model_switches') {
          return Promise.resolve({ allowed: true, used: 0, limit: 2 });
        }
        return Promise.resolve({ allowed: true, used: 0, limit: 40 });
      });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(429);
    
    // Restore originals
    authModule.auth = originalAuth;
    dailyUsageModule.canUseFeature = originalCanUseFeature;
  });

  it('should deny model switch for free users at limit', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      modelId: 'gemini-2.5-flash' // Different from default
    });
    
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    // Mock canUseFeature to deny model switch (at limit)
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalCanUseFeature = dailyUsageModule.canUseFeature;
    dailyUsageModule.canUseFeature = jest.fn()
      .mockImplementation((userId: string, feature: string, isPro: boolean, isDev: boolean) => {
        if (feature === 'model_switches') {
          return Promise.resolve({ allowed: false, used: 2, limit: 2 });
        }
        return Promise.resolve({ allowed: true, used: 0, limit: 40 });
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
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      modelId: 'gpt-4o'
    });
    
    // Mock user as pro
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockProUser });
    
    // Mock canUseFeature to allow (pro users have infinite limit)
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalCanUseFeature = dailyUsageModule.canUseFeature;
    dailyUsageModule.canUseFeature = jest.fn()
      .mockImplementation((userId: string, feature: string, isPro: boolean, isDev: boolean) => {
        if (feature === 'model_switches') {
          return Promise.resolve({ allowed: true, used: 100, limit: Infinity });
        }
        return Promise.resolve({ allowed: true, used: 0, limit: 400 });
      });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(429);
    
    // Restore originals
    authModule.auth = originalAuth;
    dailyUsageModule.canUseFeature = originalCanUseFeature;
  });

  it('should not count model switch when using default model', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      // No modelId specified, should use default
    });
    
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    // Mock incrementUsage to track if it's called for model_switches
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalIncrementUsage = dailyUsageModule.incrementUsage;
    const mockIncrementUsage = jest.fn().mockResolvedValue(true);
    dailyUsageModule.incrementUsage = mockIncrementUsage;
    
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    
    // Check that incrementUsage was called for follow_ups but not for model_switches
    expect(mockIncrementUsage).toHaveBeenCalled();
    const calls = mockIncrementUsage.mock.calls;
    const modelSwitchCalls = calls.filter(call => call[1] === 'model_switches');
    expect(modelSwitchCalls.length).toBe(0);
    
    // Restore originals
    authModule.auth = originalAuth;
    dailyUsageModule.incrementUsage = originalIncrementUsage;
  });
});

describe('Followup API Route - BYOK Provider Validation', () => {
  it('should accept openai as byokProvider for pro users', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      userApiKey: 'test-key',
      byokProvider: 'openai'
    });
    
    // Mock user as pro
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockProUser });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
    
    // Restore original
    authModule.auth = originalAuth;
  });

  it('should accept gemini as byokProvider for pro users', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      userApiKey: 'test-key',
      byokProvider: 'gemini'
    });
    
    // Mock user as pro
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockProUser });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
    
    // Restore original
    authModule.auth = originalAuth;
  });

  it('should accept mistral as byokProvider for pro users', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      userApiKey: 'test-key',
      byokProvider: 'mistral'
    });
    
    // Mock user as pro
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockProUser });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
    
    // Restore original
    authModule.auth = originalAuth;
  });

  it('should default to openai when byokProvider is not specified', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      userApiKey: 'test-key'
    });
    
    // Mock user as pro
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockProUser });
    
    const res = await POST(req);
    
    expect(res.status).not.toBe(400);
    
    // Restore original
    authModule.auth = originalAuth;
  });
});

describe('Followup API Route - Successful Requests', () => {
  it('should return recommendation for valid request', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      previousReasoning: 'Test reasoning',
      weather: mockWeatherData
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    const data = await res.json();
    
    expect(data).toHaveProperty('recommendation');
    expect(data).toHaveProperty('meta');
    
    expect(data.recommendation).toEqual(mockStyleRecommendation);
  });

  it('should include meta information with isPro and isDev flags', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
    });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(data.meta).toHaveProperty('isPro');
    expect(data.meta).toHaveProperty('isDev');
    expect(data.meta).toHaveProperty('dailyLimits');
  });

  it('should include dailyLimits in response for free users', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
    });
    
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    const res = await POST(req);
    const data = await res.json();
    
    expect(data.meta.dailyLimits).toHaveProperty('model_switches');
    expect(data.meta.dailyLimits.model_switches.limit).toBe(2);
    
    // Restore original
    authModule.auth = originalAuth;
  });
});

describe('Followup API Route - Error Handling', () => {
  it('should return 502 for AI recommendation failure', async () => {
    // Mock AI recommendation to fail
    const aiModule = await import('@/lib/ai');
    const originalGetFollowUpRecommendation = aiModule.getFollowUpRecommendation;
    aiModule.getFollowUpRecommendation = jest.fn().mockRejectedValue(new Error('AI request failed'));
    
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data.error).toContain('AI request failed');
    
    // Restore original
    aiModule.getFollowUpRecommendation = originalGetFollowUpRecommendation;
  });

  it('should return 429 for free users at follow-up limit', async () => {
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    // Mock canUseFeature to deny follow-up usage
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalCanUseFeature = dailyUsageModule.canUseFeature;
    dailyUsageModule.canUseFeature = jest.fn().mockResolvedValue({ 
      allowed: false, 
      used: 40, 
      limit: 40 
    });
    
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain('Daily follow-up limit reached');
    
    // Restore originals
    authModule.auth = originalAuth;
    dailyUsageModule.canUseFeature = originalCanUseFeature;
  });

  it('should allow follow-ups for dev users regardless of limit', async () => {
    // Mock user as dev
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ 
      user: { 
        ...mockUser, 
        is_dev: true 
      } 
    });
    
    // Mock canUseFeature to deny (but devs should bypass)
    const dailyUsageModule = await import('@/lib/daily-usage');
    const originalCanUseFeature = dailyUsageModule.canUseFeature;
    dailyUsageModule.canUseFeature = jest.fn().mockResolvedValue({ 
      allowed: false, 
      used: 1000, 
      limit: 40 
    });
    
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
    });
    
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    
    // Restore originals
    authModule.auth = originalAuth;
    dailyUsageModule.canUseFeature = originalCanUseFeature;
  });
});

describe('Followup API Route - Dev Mode', () => {
  it('should handle dev chat messages for dev users', async () => {
    const req = createMockNextRequest({ 
      message: 'Test dev message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
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
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
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

describe('Followup API Route - Model Selection', () => {
  it('should use specified model when modelId is provided', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData,
      modelId: 'mistral-large-latest'
    });
    
    // Mock user as pro
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockProUser });
    
    // Mock getFollowUpRecommendation to verify modelId is passed
    const aiModule = await import('@/lib/ai');
    const originalGetFollowUpRecommendation = aiModule.getFollowUpRecommendation;
    const mockGetFollowUpRecommendation = jest.fn().mockResolvedValue(mockStyleRecommendation);
    aiModule.getFollowUpRecommendation = mockGetFollowUpRecommendation;
    
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    
    // Verify that the modelId was passed to the AI function
    expect(mockGetFollowUpRecommendation).toHaveBeenCalled();
    const callArgs = mockGetFollowUpRecommendation.mock.calls[0][0];
    expect(callArgs.modelId).toBe('mistral-large-latest');
    
    // Restore originals
    authModule.auth = originalAuth;
    aiModule.getFollowUpRecommendation = originalGetFollowUpRecommendation;
  });

  it('should use default model when modelId is not provided', async () => {
    const req = createMockNextRequest({ 
      message: 'Test message',
      previousOutfit: 'Test outfit',
      weather: mockWeatherData
    });
    
    // Mock user as free
    const authModule = await import('@/auth');
    const originalAuth = authModule.auth;
    authModule.auth = jest.fn().mockResolvedValue({ user: mockUser });
    
    // Mock getFollowUpRecommendation to verify modelId is undefined
    const aiModule = await import('@/lib/ai');
    const originalGetFollowUpRecommendation = aiModule.getFollowUpRecommendation;
    const mockGetFollowUpRecommendation = jest.fn().mockResolvedValue(mockStyleRecommendation);
    aiModule.getFollowUpRecommendation = mockGetFollowUpRecommendation;
    
    const res = await POST(req);
    
    expect(res.status).toBe(200);
    
    // Verify that modelId was not passed (undefined)
    expect(mockGetFollowUpRecommendation).toHaveBeenCalled();
    const callArgs = mockGetFollowUpRecommendation.mock.calls[0][0];
    expect(callArgs.modelId).toBeUndefined();
    
    // Restore originals
    authModule.auth = originalAuth;
    aiModule.getFollowUpRecommendation = originalGetFollowUpRecommendation;
  });
});
