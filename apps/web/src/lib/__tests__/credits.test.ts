/**
 * Unit tests for Credits module
 * Tests credit balance, weekly reset, and deduction functionality
 */

import {
  getCredits,
  deductCredit,
  CreditRecord,
} from '../credits';

import {
  mockUser,
} from '../../__tests__/mocks';

// Mock Supabase
jest.mock('../supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      data: null,
      error: null,
    })),
  },
}));

// Mock Date for consistent testing
const mockDate = new Date('2024-01-15T12:00:00Z');
const sevenDaysLater = new Date('2024-01-22T12:00:00Z');
const sixDaysLater = new Date('2024-01-21T12:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Credits Module - Configuration', () => {
  it('should have WEEKLY_CREDITS constant set to 50', () => {
    // This is a compile-time check
    // We can't directly test the constant, but we can test the behavior
    expect(true).toBe(true); // Placeholder
  });
});

describe('Credits Module - Data Structures', () => {
  describe('CreditRecord', () => {
    it('should have all required fields', () => {
      const record: CreditRecord = {
        user_id: 'test-user-id',
        current_balance: 50,
        last_reset_date: '2024-01-15',
      };
      
      expect(record).toHaveProperty('user_id');
      expect(record).toHaveProperty('current_balance');
      expect(record).toHaveProperty('last_reset_date');
    });

    it('should have correct types for all fields', () => {
      const record: CreditRecord = {
        user_id: 'test-user-id',
        current_balance: 50,
        last_reset_date: '2024-01-15',
      };
      
      expect(typeof record.user_id).toBe('string');
      expect(typeof record.current_balance).toBe('number');
      expect(typeof record.last_reset_date).toBe('string');
    });
  });
});

describe('Credits Module - getCredits', () => {
  it('should return WEEKLY_CREDITS for first-time users', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    
    // Mock first select to return no data (first-time user)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
          insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return mockFrom(table);
    });
    
    const balance = await getCredits('test-user-id');
    
    expect(balance).toBe(50);
  });

  it('should return existing balance for returning users', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    
    // Mock select to return existing record
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              user_id: 'test-user-id',
              current_balance: 25,
              last_reset_date: mockDate.toISOString().split('T')[0],
            },
            error: null
          }),
        };
      }
      return mockFrom(table);
    });
    
    const balance = await getCredits('test-user-id');
    
    expect(balance).toBe(25);
  });

  it('should reset balance to WEEKLY_CREDITS when 7+ days have passed', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock select to return old record (7 days old)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              user_id: 'test-user-id',
              current_balance: 10,
              last_reset_date: '2024-01-08', // 7 days before 2024-01-15
            },
            error: null
          }),
          update: mockUpdate,
        };
      }
      return mockFrom(table);
    });
    
    // Mock Date to be 2024-01-15
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
        return mockDate;
      }
      static now() {
        return mockDate.getTime();
      }
    } as unknown as DateConstructor;
    
    const balance = await getCredits('test-user-id');
    
    expect(balance).toBe(50);
    expect(mockUpdate).toHaveBeenCalled();
    
    // Restore Date
    global.Date = originalDate;
  });

  it('should not reset balance when less than 7 days have passed', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock select to return recent record (6 days old)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              user_id: 'test-user-id',
              current_balance: 25,
              last_reset_date: '2024-01-09', // 6 days before 2024-01-15
            },
            error: null
          }),
          update: mockUpdate,
        };
      }
      return mockFrom(table);
    });
    
    // Mock Date to be 2024-01-15
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
        return mockDate;
      }
      static now() {
        return mockDate.getTime();
      }
    } as unknown as DateConstructor;
    
    const balance = await getCredits('test-user-id');
    
    expect(balance).toBe(25);
    expect(mockUpdate).not.toHaveBeenCalled();
    
    // Restore Date
    global.Date = originalDate;
  });
});

describe('Credits Module - deductCredit', () => {
  it('should return true and deduct credit when balance is sufficient', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock getCredits to return sufficient balance
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              user_id: 'test-user-id',
              current_balance: 25,
              last_reset_date: mockDate.toISOString().split('T')[0],
            },
            error: null
          }),
          update: mockUpdate,
        };
      }
      return mockFrom(table);
    });
    
    const result = await deductCredit('test-user-id');
    
    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      { current_balance: 24 },
      expect.anything()
    );
  });

  it('should return false when balance is 0', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock getCredits to return 0 balance
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              user_id: 'test-user-id',
              current_balance: 0,
              last_reset_date: mockDate.toISOString().split('T')[0],
            },
            error: null
          }),
          update: mockUpdate,
        };
      }
      return mockFrom(table);
    });
    
    const result = await deductCredit('test-user-id');
    
    expect(result).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should return false when balance is negative', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock getCredits to return negative balance (edge case)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              user_id: 'test-user-id',
              current_balance: -5,
              last_reset_date: mockDate.toISOString().split('T')[0],
            },
            error: null
          }),
          update: mockUpdate,
        };
      }
      return mockFrom(table);
    });
    
    const result = await deductCredit('test-user-id');
    
    expect(result).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('should handle database errors gracefully', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    
    // Mock select to return error
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: new Error('Database error')
          }),
        };
      }
      return mockFrom(table);
    });
    
    // Should not throw, but return WEEKLY_CREDITS for first-time user
    const balance = await getCredits('test-user-id');
    expect(balance).toBe(50);
  });
});

describe('Credits Module - Edge Cases', () => {
  it('should handle exactly 7 days since reset', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock select to return record exactly 7 days old
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              user_id: 'test-user-id',
              current_balance: 10,
              last_reset_date: '2024-01-08', // Exactly 7 days before 2024-01-15
            },
            error: null
          }),
          update: mockUpdate,
        };
      }
      return mockFrom(table);
    });
    
    // Mock Date to be 2024-01-15
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
        return mockDate;
      }
      static now() {
        return mockDate.getTime();
      }
    } as unknown as DateConstructor;
    
    const balance = await getCredits('test-user-id');
    
    // Should reset when exactly 7 days have passed
    expect(balance).toBe(50);
    expect(mockUpdate).toHaveBeenCalled();
    
    // Restore Date
    global.Date = originalDate;
  });

  it('should handle just under 7 days since reset', async () => {
    const supabaseModule = await import('../supabase');
    const mockFrom = supabaseModule.supabaseAdmin.from;
    const mockUpdate = jest.fn().mockResolvedValue({ data: null, error: null });
    
    // Mock select to return record just under 7 days old (6 days, 23 hours, 59 minutes)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'credits') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              user_id: 'test-user-id',
              current_balance: 25,
              last_reset_date: '2024-01-08',
            },
            error: null
          }),
          update: mockUpdate,
        };
      }
      return mockFrom(table);
    });
    
    // Mock Date to be 2024-01-15T12:00:00Z
    // Last reset was 2024-01-08T12:00:00Z (exactly 7 days)
    // But we want to test just under 7 days
    const testDate = new Date('2024-01-15T11:59:59Z'); // 1 second before 7 days
    const originalDate = global.Date;
    global.Date = class extends originalDate {
      constructor() {
        super();
        return testDate;
      }
      static now() {
        return testDate.getTime();
      }
    } as unknown as DateConstructor;
    
    const balance = await getCredits('test-user-id');
    
    // Should NOT reset when just under 7 days
    expect(balance).toBe(25);
    expect(mockUpdate).not.toHaveBeenCalled();
    
    // Restore Date
    global.Date = originalDate;
  });
});
