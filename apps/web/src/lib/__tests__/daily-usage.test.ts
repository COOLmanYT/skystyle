/**
 * Unit tests for Daily Usage module
 * Tests rate limiting, usage tracking, and feature availability
 */

import {
  getDailyUsage,
  canUseFeature,
  incrementUsage,
  LIMITS,
  DailyUsageRecord,
} from '../daily-usage';

import {
  mockDailyUsageRecord,
  mockDailyUsageRecordWithModelSwitches,
  mockUser,
  mockDate,
} from '../../__tests__/mocks';

// Mock Supabase
jest.mock('../supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      data: null,
      error: null,
    })),
  },
}));

// Mock today function for consistent testing
const mockToday = '2024-01-15';
jest.mock('../daily-usage', () => {
  const originalModule = jest.requireActual('../daily-usage');
  return {
    ...originalModule,
    today: jest.fn(() => mockToday),
  };
});

describe('Daily Usage Module - Configuration', () => {
  describe('LIMITS', () => {
    it('should have correct limits for free users', () => {
      expect(LIMITS.free.ai_uses).toBe(20);
      expect(LIMITS.free.follow_ups).toBe(40);
      expect(LIMITS.free.closet_uses).toBe(4);
      expect(LIMITS.free.source_picks).toBe(4);
      expect(LIMITS.free.model_switches).toBe(2);
    });

    it('should have correct limits for demo users', () => {
      expect(LIMITS.demo.ai_uses).toBe(200);
      expect(LIMITS.demo.follow_ups).toBe(400);
      expect(LIMITS.demo.closet_uses).toBe(40);
      expect(LIMITS.demo.source_picks).toBe(40);
      expect(LIMITS.demo.model_switches).toBe(20);
    });

    it('should have infinite limits for pro users', () => {
      expect(LIMITS.pro.ai_uses).toBe(Infinity);
      expect(LIMITS.pro.follow_ups).toBe(400);
      expect(LIMITS.pro.closet_uses).toBe(Infinity);
      expect(LIMITS.pro.source_picks).toBe(Infinity);
      expect(LIMITS.pro.model_switches).toBe(Infinity);
    });

    it('should have infinite limits for dev users', () => {
      expect(LIMITS.dev.ai_uses).toBe(Infinity);
      expect(LIMITS.dev.follow_ups).toBe(Infinity);
      expect(LIMITS.dev.closet_uses).toBe(Infinity);
      expect(LIMITS.dev.source_picks).toBe(Infinity);
      expect(LIMITS.dev.model_switches).toBe(Infinity);
    });

    it('should have model_switches limit for all user types', () => {
      expect(LIMITS.free.model_switches).toBe(2);
      expect(LIMITS.demo.model_switches).toBe(20);
      expect(LIMITS.pro.model_switches).toBe(Infinity);
      expect(LIMITS.dev.model_switches).toBe(Infinity);
    });
  });
});

describe('Daily Usage Module - Data Structures', () => {
  describe('DailyUsageRecord', () => {
    it('should have all required fields', () => {
      const record: DailyUsageRecord = mockDailyUsageRecord;
      
      expect(record).toHaveProperty('user_id');
      expect(record).toHaveProperty('usage_date');
      expect(record).toHaveProperty('ai_uses');
      expect(record).toHaveProperty('follow_ups');
      expect(record).toHaveProperty('closet_uses');
      expect(record).toHaveProperty('source_picks');
      expect(record).toHaveProperty('model_switches');
    });

    it('should have correct types for all fields', () => {
      const record: DailyUsageRecord = mockDailyUsageRecord;
      
      expect(typeof record.user_id).toBe('string');
      expect(typeof record.usage_date).toBe('string');
      expect(typeof record.ai_uses).toBe('number');
      expect(typeof record.follow_ups).toBe('number');
      expect(typeof record.closet_uses).toBe('number');
      expect(typeof record.source_picks).toBe('number');
      expect(typeof record.model_switches).toBe('number');
    });

    it('should have model_switches initialized to 0 by default', () => {
      const record: DailyUsageRecord = mockDailyUsageRecord;
      expect(record.model_switches).toBe(0);
    });
  });
});

describe('Daily Usage Module - Feature Availability', () => {
  describe('canUseFeature for model_switches', () => {
    it('should allow model switches for free users under limit', async () => {
      // Mock a user with 0 model switches used
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        model_switches: 0,
      });
      
      // Temporarily replace the getDailyUsage function
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.canUseFeature(
        'test-user-id',
        'model_switches',
        false, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.limit).toBe(2);
      
      // Restore original function
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    });

    it('should deny model switches for free users at limit', async () => {
      // Mock a user with 2 model switches used (at limit)
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        model_switches: 2,
      });
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.canUseFeature(
        'test-user-id',
        'model_switches',
        false, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(2);
      expect(result.limit).toBe(2);
      
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    });

    it('should allow unlimited model switches for pro users', async () => {
      // Mock a user with many model switches used
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        model_switches: 100,
      });
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.canUseFeature(
        'test-user-id',
        'model_switches',
        true, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Infinity);
      
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    });

    it('should allow unlimited model switches for dev users', async () => {
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        model_switches: 1000,
      });
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.canUseFeature(
        'test-user-id',
        'model_switches',
        false, // isPro
        true,  // isDev
        false  // isDemo
      );
      
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(Infinity);
      
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    });
  });

  describe('canUseFeature for other features', () => {
    it('should allow ai_uses for free users under limit', async () => {
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        ai_uses: 10,
      });
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.canUseFeature(
        'test-user-id',
        'ai_uses',
        false, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(10);
      expect(result.limit).toBe(20);
      
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    });

    it('should deny ai_uses for free users at limit', async () => {
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        ai_uses: 20,
      });
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.canUseFeature(
        'test-user-id',
        'ai_uses',
        false, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result.allowed).toBe(false);
      expect(result.used).toBe(20);
      expect(result.limit).toBe(20);
      
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    });

    it('should allow follow_ups for free users under limit', async () => {
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        follow_ups: 20,
      });
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.canUseFeature(
        'test-user-id',
        'follow_ups',
        false, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(20);
      expect(result.limit).toBe(40);
      
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    });
  });
});

describe('Daily Usage Module - Usage Incrementing', () => {
  describe('incrementUsage', () => {
    it('should increment model_switches for free users', async () => {
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        model_switches: 0,
      });
      
      const mockUpsert = jest.fn().mockResolvedValue({});
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      
      // Mock the supabase calls
      const supabaseModule = await import('../supabase');
      const originalFrom = supabaseModule.supabaseAdmin.from;
      supabaseModule.supabaseAdmin.from = jest.fn((table: string) => {
        if (table === 'daily_usage') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: mockGetDailyUsage,
            upsert: mockUpsert,
          };
        }
        return originalFrom(table);
      });
      
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.incrementUsage(
        'test-user-id',
        'model_switches',
        false, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result).toBe(true);
      expect(mockUpsert).toHaveBeenCalled();
      
      // Restore originals
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
      supabaseModule.supabaseAdmin.from = originalFrom;
    });

    it('should not increment when limit is reached', async () => {
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        model_switches: 2, // At limit for free users
      });
      
      const mockUpsert = jest.fn().mockResolvedValue({});
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.incrementUsage(
        'test-user-id',
        'model_switches',
        false, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result).toBe(false);
      expect(mockUpsert).not.toHaveBeenCalled();
      
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    });

    it('should allow incrementing for pro users regardless of current usage', async () => {
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        model_switches: 1000, // Way over free limit
      });
      
      const mockUpsert = jest.fn().mockResolvedValue({});
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.incrementUsage(
        'test-user-id',
        'model_switches',
        true, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result).toBe(true);
      expect(mockUpsert).toHaveBeenCalled();
      
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    });
  });
});

describe('Daily Usage Module - Edge Cases', () => {
  it('should handle demo users correctly', async () => {
    const mockGetDailyUsage = jest.fn().mockResolvedValue({
      ...mockDailyUsageRecord,
      model_switches: 10,
    });
    
    const dailyUsageModule = await import('../daily-usage');
    const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
    dailyUsageModule.getDailyUsage = mockGetDailyUsage;
    
    const result = await dailyUsageModule.canUseFeature(
      'test-user-id',
      'model_switches',
      false, // isPro
      false, // isDev
      true   // isDemo
    );
    
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(20); // Demo limit
    
    dailyUsageModule.getDailyUsage = originalGetDailyUsage;
  });

  it('should handle all usage field types', async () => {
    const fields: Array<'ai_uses' | 'follow_ups' | 'closet_uses' | 'source_picks' | 'model_switches'> = [
      'ai_uses',
      'follow_ups',
      'closet_uses',
      'source_picks',
      'model_switches',
    ];
    
    for (const field of fields) {
      const mockGetDailyUsage = jest.fn().mockResolvedValue({
        ...mockDailyUsageRecord,
        [field]: 0,
      });
      
      const dailyUsageModule = await import('../daily-usage');
      const originalGetDailyUsage = dailyUsageModule.getDailyUsage;
      dailyUsageModule.getDailyUsage = mockGetDailyUsage;
      
      const result = await dailyUsageModule.canUseFeature(
        'test-user-id',
        field,
        false, // isPro
        false, // isDev
        false  // isDemo
      );
      
      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      
      dailyUsageModule.getDailyUsage = originalGetDailyUsage;
    }
  });
});
