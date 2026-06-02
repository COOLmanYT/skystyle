/**
 * Unit tests for Weather caching functionality
 * Tests cache key generation, TTL, and cache behavior
 */

import {
  generateCacheKey,
  getCachedWeather,
  WEATHER_CACHE_TTL,
} from '../weather';

import {
  mockWeatherData,
  mockSourceWeatherData,
} from '../../__tests__/mocks';

// Mock the weather cache for testing
const mockWeatherCache = new Map<string, { data: any; timestamp: number }>();

// Mock the weatherCache in the weather module
jest.mock('../weather', () => {
  const originalModule = jest.requireActual('../weather');
  return {
    ...originalModule,
    weatherCache: mockWeatherCache,
  };
});

describe('Weather Caching - Cache Key Generation', () => {
  beforeEach(() => {
    mockWeatherCache.clear();
  });

  it('should generate unique cache keys for different coordinates', () => {
    const key1 = generateCacheKey(40.7128, -74.0060);
    const key2 = generateCacheKey(34.0522, -118.2437);
    
    expect(key1).not.toBe(key2);
  });

  it('should generate same cache key for same coordinates', () => {
    const key1 = generateCacheKey(40.7128, -74.0060);
    const key2 = generateCacheKey(40.7128, -74.0060);
    
    expect(key1).toBe(key2);
  });

  it('should include custom source URL in cache key', () => {
    const key1 = generateCacheKey(40.7128, -74.0060, 'https://api.weather.com');
    const key2 = generateCacheKey(40.7128, -74.0060, 'https://api.weather2.com');
    
    expect(key1).not.toBe(key2);
  });

  it('should include source mode in cache key', () => {
    const key1 = generateCacheKey(40.7128, -74.0060, undefined, 'builtin');
    const key2 = generateCacheKey(40.7128, -74.0060, undefined, 'custom');
    
    expect(key1).not.toBe(key2);
  });

  it('should include custom sources count in cache key', () => {
    const key1 = generateCacheKey(40.7128, -74.0060, undefined, 'custom', []);
    const key2 = generateCacheKey(40.7128, -74.0060, undefined, 'custom', [{ id: '1', name: 'test', type: 'url', value: 'https://test.com' }]);
    
    expect(key1).not.toBe(key2);
  });

  it('should handle undefined parameters correctly', () => {
    const key1 = generateCacheKey(40.7128, -74.0060);
    const key2 = generateCacheKey(40.7128, -74.0060, undefined, undefined, undefined);
    
    expect(key1).toBe(key2);
  });

  it('should format coordinates with 4 decimal places', () => {
    const key = generateCacheKey(40.71281234, -74.00605678);
    
    // The key should contain coordinates formatted to 4 decimal places
    expect(key).toContain('40.7128');
    expect(key).toContain('-74.0061');
  });
});

describe('Weather Caching - TTL Configuration', () => {
  it('should have TTL defined for OpenWeather source', () => {
    expect(WEATHER_CACHE_TTL.OpenWeather).toBe(900); // 15 minutes
  });

  it('should have TTL defined for BOM source', () => {
    expect(WEATHER_CACHE_TTL.BOM).toBe(1800); // 30 minutes
  });

  it('should have TTL defined for Open-Meteo source', () => {
    expect(WEATHER_CACHE_TTL['Open-Meteo']).toBe(1800); // 30 minutes
  });

  it('should have TTL defined for Custom source', () => {
    expect(WEATHER_CACHE_TTL.Custom).toBe(600); // 10 minutes
  });

  it('should have TTL defined for Multi source', () => {
    expect(WEATHER_CACHE_TTL.Multi).toBe(900); // 15 minutes
  });

  it('should have different TTLs for different sources', () => {
    const ttlValues = Object.values(WEATHER_CACHE_TTL);
    const uniqueTtlValues = new Set(ttlValues);
    
    // Should have at least 2 different TTL values
    expect(uniqueTtlValues.size).toBeGreaterThan(1);
  });
});

describe('Weather Caching - Cache Behavior', () => {
  const testDate = new Date('2024-01-15T12:00:00Z');
  
  beforeEach(() => {
    mockWeatherCache.clear();
    jest.useFakeTimers();
    jest.setSystemTime(testDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return cached data if within TTL', () => {
    const cacheKey = 'test-key';
    const cachedData = { ...mockWeatherData, source: 'OpenWeather' };
    
    // Add data to cache
    mockWeatherCache.set(cacheKey, { data: cachedData, timestamp: testDate.getTime() });
    
    // Get cached data (should be within TTL)
    const result = getCachedWeather(cacheKey);
    
    expect(result).toEqual(cachedData);
  });

  it('should return null if cache entry does not exist', () => {
    const result = getCachedWeather('non-existent-key');
    
    expect(result).toBeNull();
  });

  it('should return null and remove expired cache entry for OpenWeather', () => {
    const cacheKey = 'test-key';
    const cachedData = { ...mockWeatherData, source: 'OpenWeather' };
    const oldTimestamp = testDate.getTime() - (900 * 1000 + 1000); // 15 minutes + 1 second ago
    
    // Add expired data to cache
    mockWeatherCache.set(cacheKey, { data: cachedData, timestamp: oldTimestamp });
    
    // Get cached data (should be expired)
    const result = getCachedWeather(cacheKey);
    
    expect(result).toBeNull();
    expect(mockWeatherCache.has(cacheKey)).toBe(false); // Should be removed
  });

  it('should return null and remove expired cache entry for BOM', () => {
    const cacheKey = 'test-key';
    const cachedData = { ...mockWeatherData, source: 'BOM' };
    const oldTimestamp = testDate.getTime() - (1800 * 1000 + 1000); // 30 minutes + 1 second ago
    
    // Add expired data to cache
    mockWeatherCache.set(cacheKey, { data: cachedData, timestamp: oldTimestamp });
    
    // Get cached data (should be expired)
    const result = getCachedWeather(cacheKey);
    
    expect(result).toBeNull();
    expect(mockWeatherCache.has(cacheKey)).toBe(false); // Should be removed
  });

  it('should return cached data if exactly at TTL boundary', () => {
    const cacheKey = 'test-key';
    const cachedData = { ...mockWeatherData, source: 'OpenWeather' };
    const boundaryTimestamp = testDate.getTime() - (900 * 1000); // Exactly 15 minutes ago
    
    // Add data at exact TTL boundary
    mockWeatherCache.set(cacheKey, { data: cachedData, timestamp: boundaryTimestamp });
    
    // Get cached data (should still be valid)
    const result = getCachedWeather(cacheKey);
    
    expect(result).toEqual(cachedData);
  });

  it('should use default TTL for unknown sources', () => {
    const cacheKey = 'test-key';
    const cachedData = { ...mockWeatherData, source: 'UnknownSource' as any };
    const oldTimestamp = testDate.getTime() - (900 * 1000 + 1000); // 15 minutes + 1 second ago
    
    // Add expired data with unknown source
    mockWeatherCache.set(cacheKey, { data: cachedData, timestamp: oldTimestamp });
    
    // Get cached data (should be expired with default TTL)
    const result = getCachedWeather(cacheKey);
    
    expect(result).toBeNull();
    expect(mockWeatherCache.has(cacheKey)).toBe(false);
  });

  it('should handle cache entries with missing source', () => {
    const cacheKey = 'test-key';
    const cachedData = { ...mockWeatherData };
    delete (cachedData as any).source;
    
    // Add data without source
    mockWeatherCache.set(cacheKey, { data: cachedData, timestamp: testDate.getTime() });
    
    // Get cached data (should use default TTL)
    const result = getCachedWeather(cacheKey);
    
    expect(result).toEqual(cachedData);
  });
});

describe('Weather Caching - Cache Key Uniqueness', () => {
  it('should generate different keys for different locations', () => {
    const locations = [
      { lat: 40.7128, lon: -74.0060 }, // New York
      { lat: 34.0522, lon: -118.2437 }, // Los Angeles
      { lat: 51.5074, lon: -0.1278 }, // London
      { lat: 35.6762, lon: 139.6503 }, // Tokyo
      { lat: -33.8688, lon: 151.2093 }, // Sydney
    ];
    
    const keys = locations.map(loc => generateCacheKey(loc.lat, loc.lon));
    const uniqueKeys = new Set(keys);
    
    expect(uniqueKeys.size).toBe(locations.length);
  });

  it('should generate different keys for different source modes', () => {
    const sourceModes: Array<'builtin' | 'custom' | 'both'> = ['builtin', 'custom', 'both'];
    
    const keys = sourceModes.map(mode => generateCacheKey(40.7128, -74.0060, undefined, mode));
    const uniqueKeys = new Set(keys);
    
    expect(uniqueKeys.size).toBe(sourceModes.length);
  });

  it('should generate different keys for different custom source URLs', () => {
    const urls = [
      'https://api.openweathermap.org',
      'https://api.weatherapi.com',
      'https://api.visualcrossing.com',
    ];
    
    const keys = urls.map(url => generateCacheKey(40.7128, -74.0060, url));
    const uniqueKeys = new Set(keys);
    
    expect(uniqueKeys.size).toBe(urls.length);
  });
});

describe('Weather Caching - Integration Scenarios', () => {
  const testDate = new Date('2024-01-15T12:00:00Z');
  
  beforeEach(() => {
    mockWeatherCache.clear();
    jest.useFakeTimers();
    jest.setSystemTime(testDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should cache and retrieve weather data correctly', () => {
    const cacheKey = generateCacheKey(40.7128, -74.0060);
    const weatherData = { ...mockWeatherData, source: 'OpenWeather' };
    
    // Simulate caching
    mockWeatherCache.set(cacheKey, { data: weatherData, timestamp: testDate.getTime() });
    
    // Retrieve from cache
    const cached = getCachedWeather(cacheKey);
    
    expect(cached).toEqual(weatherData);
  });

  it('should handle multiple cache entries independently', () => {
    const key1 = generateCacheKey(40.7128, -74.0060);
    const key2 = generateCacheKey(34.0522, -118.2437);
    
    const data1 = { ...mockWeatherData, source: 'OpenWeather' };
    const data2 = { ...mockWeatherData, source: 'BOM' };
    
    // Cache both entries
    mockWeatherCache.set(key1, { data: data1, timestamp: testDate.getTime() });
    mockWeatherCache.set(key2, { data: data2, timestamp: testDate.getTime() });
    
    // Retrieve both
    const cached1 = getCachedWeather(key1);
    const cached2 = getCachedWeather(key2);
    
    expect(cached1).toEqual(data1);
    expect(cached2).toEqual(data2);
  });

  it('should expire entries independently based on their source', () => {
    const key1 = generateCacheKey(40.7128, -74.0060);
    const key2 = generateCacheKey(34.0522, -118.2437);
    
    const data1 = { ...mockWeatherData, source: 'OpenWeather' }; // 15 min TTL
    const data2 = { ...mockWeatherData, source: 'BOM' }; // 30 min TTL
    
    const oldTimestamp1 = testDate.getTime() - (900 * 1000 + 1000); // 15 min + 1 sec ago
    const oldTimestamp2 = testDate.getTime() - (900 * 1000 + 1000); // 15 min + 1 sec ago
    
    // Cache both with old timestamps
    mockWeatherCache.set(key1, { data: data1, timestamp: oldTimestamp1 });
    mockWeatherCache.set(key2, { data: data2, timestamp: oldTimestamp2 });
    
    // OpenWeather should be expired, BOM should still be valid
    const cached1 = getCachedWeather(key1);
    const cached2 = getCachedWeather(key2);
    
    expect(cached1).toBeNull();
    expect(cached2).toEqual(data2); // BOM has 30 min TTL, so still valid
  });
});
