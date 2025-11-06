/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  getEffectiveModel,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_QWEN_NEXT_80B_INSTRUCT_MODEL,
  DEFAULT_QWEN_NEXT_80B_THINKING_MODEL,
  DEFAULT_QWEN_CODER_MODEL,
  DEFAULT_QWEN_235B_MODEL,
} from './models.js';

describe('getEffectiveModel', () => {
  describe('When NOT in fallback mode', () => {
    const isInFallbackMode = false;

    it('should return the Pro model when Pro is requested', () => {
      const model = getEffectiveModel(isInFallbackMode, DEFAULT_GEMINI_MODEL);
      expect(model).toBe(DEFAULT_GEMINI_MODEL);
    });

    it('should return the Flash model when Flash is requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_GEMINI_FLASH_MODEL,
      );
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });

    it('should return the Lite model when Lite is requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_GEMINI_FLASH_LITE_MODEL,
      );
      expect(model).toBe(DEFAULT_GEMINI_FLASH_LITE_MODEL);
    });

    it('should return a custom model name when requested', () => {
      const customModel = 'custom-model-v1';
      const model = getEffectiveModel(isInFallbackMode, customModel);
      expect(model).toBe(customModel);
    });

    it('should return Qwen Instruct model when requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_QWEN_NEXT_80B_INSTRUCT_MODEL,
      );
      expect(model).toBe(DEFAULT_QWEN_NEXT_80B_INSTRUCT_MODEL);
    });

    it('should return Qwen Thinking model when requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_QWEN_NEXT_80B_THINKING_MODEL,
      );
      expect(model).toBe(DEFAULT_QWEN_NEXT_80B_THINKING_MODEL);
    });

    it('should return Qwen Coder model when requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_QWEN_CODER_MODEL,
      );
      expect(model).toBe(DEFAULT_QWEN_CODER_MODEL);
    });

    it('should return Qwen 235B model when requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_QWEN_235B_MODEL,
      );
      expect(model).toBe(DEFAULT_QWEN_235B_MODEL);
    });
  });

  describe('When IN fallback mode', () => {
    const isInFallbackMode = true;

    it('should downgrade the Pro model to the Flash model', () => {
      const model = getEffectiveModel(isInFallbackMode, DEFAULT_GEMINI_MODEL);
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });

    it('should return the Flash model when Flash is requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_GEMINI_FLASH_MODEL,
      );
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });

    it('should HONOR the Lite model when Lite is requested', () => {
      const model = getEffectiveModel(
        isInFallbackMode,
        DEFAULT_GEMINI_FLASH_LITE_MODEL,
      );
      expect(model).toBe(DEFAULT_GEMINI_FLASH_LITE_MODEL);
    });

    it('should HONOR any model with "lite" in its name', () => {
      const customLiteModel = 'gemini-2.5-custom-lite-vNext';
      const model = getEffectiveModel(isInFallbackMode, customLiteModel);
      expect(model).toBe(customLiteModel);
    });

    it('should downgrade any other custom model to the Flash model', () => {
      const customModel = 'custom-model-v1-unlisted';
      const model = getEffectiveModel(isInFallbackMode, customModel);
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });

    it('should downgrade Qwen models to Flash model in fallback mode', () => {
      const qwenModel = DEFAULT_QWEN_NEXT_80B_INSTRUCT_MODEL;
      const model = getEffectiveModel(isInFallbackMode, qwenModel);
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });

    it('should downgrade Qwen Coder model to Flash model in fallback mode', () => {
      const qwenCoderModel = DEFAULT_QWEN_CODER_MODEL;
      const model = getEffectiveModel(isInFallbackMode, qwenCoderModel);
      expect(model).toBe(DEFAULT_GEMINI_FLASH_MODEL);
    });
  });
});
