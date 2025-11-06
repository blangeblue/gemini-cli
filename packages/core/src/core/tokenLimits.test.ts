/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { tokenLimit, DEFAULT_TOKEN_LIMIT } from './tokenLimits.js';

describe('tokenLimit', () => {
  describe('Gemini models', () => {
    it('should return 2,097,152 tokens for gemini-1.5-pro', () => {
      expect(tokenLimit('gemini-1.5-pro')).toBe(2_097_152);
    });

    it('should return 1,048,576 tokens for gemini-2.5-pro', () => {
      expect(tokenLimit('gemini-2.5-pro')).toBe(1_048_576);
    });

    it('should return 1,048,576 tokens for gemini-2.5-flash', () => {
      expect(tokenLimit('gemini-2.5-flash')).toBe(1_048_576);
    });

    it('should return 32,000 tokens for gemini-2.0-flash-preview-image-generation', () => {
      expect(tokenLimit('gemini-2.0-flash-preview-image-generation')).toBe(
        32_000,
      );
    });
  });

  describe('Qwen models', () => {
    it('should return 262,144 tokens for qwen3-next-80b-a3b-instruct-maas', () => {
      expect(tokenLimit('qwen3-next-80b-a3b-instruct-maas')).toBe(262_144);
    });

    it('should return 262,144 tokens for qwen3-next-80b-a3b-thinking-maas', () => {
      expect(tokenLimit('qwen3-next-80b-a3b-thinking-maas')).toBe(262_144);
    });

    it('should return 1,000,000 tokens for qwen3-coder', () => {
      expect(tokenLimit('qwen3-coder')).toBe(1_000_000);
    });

    it('should return 262,144 tokens for qwen3-235b', () => {
      expect(tokenLimit('qwen3-235b')).toBe(262_144);
    });
  });

  describe('Default and unknown models', () => {
    it('should return default token limit for unknown model', () => {
      expect(tokenLimit('unknown-model')).toBe(DEFAULT_TOKEN_LIMIT);
    });

    it('should return default token limit for empty string', () => {
      expect(tokenLimit('')).toBe(DEFAULT_TOKEN_LIMIT);
    });
  });
});
