
import { describe, it, expect } from 'vitest';
import { isThinkingSupported, isThinkingDefault } from './client.js';

describe('Gemini 3.0 Support', () => {
  describe('isThinkingSupported', () => {
    it('should return true for gemini-3.0', () => {
      expect(isThinkingSupported('gemini-3.0')).toBe(true);
    });

    it('should return true for gemini-3.0-pro', () => {
      expect(isThinkingSupported('gemini-3.0-pro')).toBe(true);
    });

    it('should return true for gemini-3.0-flash', () => {
      expect(isThinkingSupported('gemini-3.0-flash')).toBe(true);
    });

    it('should still return true for gemini-2.5', () => {
      expect(isThinkingSupported('gemini-2.5')).toBe(true);
    });

    it('should return false for older models like gemini-1.5', () => {
      expect(isThinkingSupported('gemini-1.5-pro')).toBe(false);
    });
  });

  describe('isThinkingDefault', () => {
    it('should return true for gemini-3.0', () => {
      expect(isThinkingDefault('gemini-3.0')).toBe(true);
    });

    it('should return true for gemini-3.0-pro', () => {
      expect(isThinkingDefault('gemini-3.0-pro')).toBe(true);
    });

    it('should return true for gemini-3.0-flash', () => {
      expect(isThinkingDefault('gemini-3.0-flash')).toBe(true);
    });
    
     it('should still return true for gemini-2.5', () => {
      expect(isThinkingDefault('gemini-2.5')).toBe(true);
    });
  });
});
