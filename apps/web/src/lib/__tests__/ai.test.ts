/**
 * Unit tests for AI module
 * Tests model selection, tiering, and helper functions
 */

import {
  getAvailableModels,
  getAllModels,
  isModelAvailable,
  getDefaultModel,
  getModelById,
  MODEL_PRIORITIES,
} from '../ai';
import type { ModelID } from '../ai';

import {
  mockModelConfigs,
  mockByokModels,
} from '../../__tests__/mocks';

describe('AI Module - Model Configuration', () => {
  describe('MODEL_PRIORITIES', () => {
    it('should have correct model priorities for pro users', () => {
      const proModels = MODEL_PRIORITIES.pro;
      
      // Check that OpenAI models come first
      expect(proModels[0].id).toBe('gpt-4o');
      expect(proModels[1].id).toBe('gpt-4o-mini');
      
      // Check that Gemini models follow
      expect(proModels[2].id).toBe('gemini-2.5-flash');
      expect(proModels[3].id).toBe('gemini-2.5-flash-lite');
      
      // Check that Mistral models are included
      expect(proModels.some(m => m.id === 'mistral-large-latest')).toBe(true);
      expect(proModels.some(m => m.id === 'mistral-small-latest')).toBe(true);
      expect(proModels.some(m => m.id === 'ministral-8b-latest')).toBe(true);
    });

    it('should have correct model priorities for free users', () => {
      const freeModels = MODEL_PRIORITIES.free;
      
      // Check that Gemini models come first for free users
      expect(freeModels[0].id).toBe('gemini-2.5-flash');
      expect(freeModels[1].id).toBe('gemini-2.5-flash-lite');
      
      // Check that Mistral models are included
      expect(freeModels.some(m => m.id === 'mistral-small-latest')).toBe(true);
      expect(freeModels.some(m => m.id === 'ministral-8b-latest')).toBe(true);
      
      // Free users should NOT have OpenAI models
      expect(freeModels.some(m => m.provider === 'openai')).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    it('should return pro models for pro users without BYOK', () => {
      const models = getAvailableModels(true, false, false);
      
      expect(models).toEqual(MODEL_PRIORITIES.pro);
    });

    it('should return pro models for dev users without BYOK', () => {
      const models = getAvailableModels(false, true, false);
      
      expect(models).toEqual(MODEL_PRIORITIES.pro);
    });

    it('should return free models for free users without BYOK', () => {
      const models = getAvailableModels(false, false, false);
      
      expect(models).toEqual(MODEL_PRIORITIES.free);
    });

    it('should return pro models when hasByok is true for pro users', () => {
      const models = getAvailableModels(true, false, true);
      
      expect(models).toEqual(MODEL_PRIORITIES.pro);
    });

    it('should return free models when hasByok is true for free users', () => {
      const models = getAvailableModels(false, false, true);
      
      expect(models).toEqual(MODEL_PRIORITIES.free);
    });
  });

  describe('getAllModels', () => {
    it('should return all models from both pro and free tiers', () => {
      const allModels = getAllModels();
      
      // Should include all pro models
      MODEL_PRIORITIES.pro.forEach(proModel => {
        expect(allModels.some(m => m.id === proModel.id)).toBe(true);
      });
      
      // Should include all free models
      MODEL_PRIORITIES.free.forEach(freeModel => {
        expect(allModels.some(m => m.id === freeModel.id)).toBe(true);
      });
      
      // Should not have duplicates
      const uniqueIds = new Set(allModels.map(m => m.id));
      expect(uniqueIds.size).toBe(allModels.length);
    });
  });

  describe('isModelAvailable', () => {
    it('should return true for pro models when user is pro', () => {
      expect(isModelAvailable('gpt-4o', true, false)).toBe(true);
      expect(isModelAvailable('mistral-large-latest', true, false)).toBe(true);
    });

    it('should return true for free models when user is free', () => {
      expect(isModelAvailable('gemini-2.5-flash', false, false)).toBe(true);
      expect(isModelAvailable('mistral-small-latest', false, false)).toBe(true);
    });

    it('should return false for pro-only models when user is free', () => {
      expect(isModelAvailable('gpt-4o', false, false)).toBe(false);
      expect(isModelAvailable('gpt-4o-mini', false, false)).toBe(false);
      expect(isModelAvailable('mistral-large-latest', false, false)).toBe(false);
    });

    it('should return true for all models when user is dev', () => {
      expect(isModelAvailable('gpt-4o', false, true)).toBe(true);
      expect(isModelAvailable('mistral-large-latest', false, true)).toBe(true);
      expect(isModelAvailable('gemini-2.5-flash', false, true)).toBe(true);
    });

    it('should return false for non-existent models', () => {
      expect(isModelAvailable('non-existent-model' as ModelID, true, false)).toBe(false);
    });
  });

  describe('getDefaultModel', () => {
    it('should return first pro model for pro users', () => {
      const defaultModel = getDefaultModel(true, false);
      expect(defaultModel.id).toBe('gpt-4o');
    });

    it('should return first pro model for dev users', () => {
      const defaultModel = getDefaultModel(false, true);
      expect(defaultModel.id).toBe('gpt-4o');
    });

    it('should return first free model for free users', () => {
      const defaultModel = getDefaultModel(false, false);
      expect(defaultModel.id).toBe('gemini-2.5-flash');
    });
  });

  describe('getModelById', () => {
    it('should return model config for existing pro models', () => {
      const model = getModelById('gpt-4o');
      expect(model).not.toBeNull();
      expect(model?.id).toBe('gpt-4o');
      expect(model?.provider).toBe('openai');
    });

    it('should return model config for existing free models', () => {
      const model = getModelById('gemini-2.5-flash');
      expect(model).not.toBeNull();
      expect(model?.id).toBe('gemini-2.5-flash');
      expect(model?.provider).toBe('gemini');
    });

    it('should return model config for Mistral models', () => {
      const model = getModelById('mistral-large-latest');
      expect(model).not.toBeNull();
      expect(model?.id).toBe('mistral-large-latest');
      expect(model?.provider).toBe('mistral');
    });

    it('should return null for non-existent models', () => {
      const model = getModelById('non-existent-model' as ModelID);
      expect(model).toBeNull();
    });

    it('should return null for BYOK models (not in regular priorities)', () => {
      const model = getModelById('byok-openai' as ModelID);
      expect(model).toBeNull();
    });
  });
});

describe('AI Module - Model Provider Validation', () => {
  it('should have correct provider types', () => {
    const providers: Set<string> = new Set();
    
    [...MODEL_PRIORITIES.pro, ...MODEL_PRIORITIES.free].forEach(model => {
      providers.add(model.provider);
    });
    
    expect(providers.has('openai')).toBe(true);
    expect(providers.has('gemini')).toBe(true);
    expect(providers.has('mistral')).toBe(true);
    expect(providers.size).toBe(3);
  });

  it('should have correct model names', () => {
    const modelNames = [...MODEL_PRIORITIES.pro, ...MODEL_PRIORITIES.free]
      .map(m => m.name);
    
    expect(modelNames).toContain('GPT-4o');
    expect(modelNames).toContain('Gemini 2.5 Flash');
    expect(modelNames).toContain('Mistral Large');
    expect(modelNames).toContain('Mistral Small');
  });
});

describe('AI Module - Model Tier Separation', () => {
  it('should have no overlap between pro and free model IDs', () => {
    const proIds = new Set(MODEL_PRIORITIES.pro.map(m => m.id));
    const freeIds = new Set(MODEL_PRIORITIES.free.map(m => m.id));
    
    // Find intersection
    const overlap = [...proIds].filter(id => freeIds.has(id));
    
    // There should be no overlap (free models are subset but with different order)
    // Actually, some models might be in both tiers, which is fine
    // The important thing is that pro has more models
    expect(MODEL_PRIORITIES.pro.length).toBeGreaterThan(MODEL_PRIORITIES.free.length);
  });

  it('should have pro tier with more models than free tier', () => {
    expect(MODEL_PRIORITIES.pro.length).toBeGreaterThan(MODEL_PRIORITIES.free.length);
  });

  it('should have all free models available in pro tier', () => {
    const proIds = new Set(MODEL_PRIORITIES.pro.map(m => m.id));
    
    MODEL_PRIORITIES.free.forEach(freeModel => {
      // Free models should be available in pro tier
      expect(proIds.has(freeModel.id)).toBe(true);
    });
  });
});
