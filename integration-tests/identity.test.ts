/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import { TestRig, validateModelOutput } from './test-helper.js';

describe('Identity questions', () => {
  let rig: TestRig;

  beforeEach(async () => {
    rig = new TestRig();
    await rig.setup('identity-test');
  });

  afterEach(async () => {
    await rig.cleanup();
  });

  it('should identify itself as Gemini CLI when asked "Who are you?" in English', async () => {
    const result = await rig.run('Who are you?');
    
    validateModelOutput(result, ['gemini cli', 'gemini'], 'identity check');
    
    // The response should mention Gemini CLI or Gemini
    const lowerResult = result.toLowerCase();
    expect(
      lowerResult.includes('gemini cli') || lowerResult.includes('gemini'),
      `Expected response to mention "Gemini CLI" or "Gemini", got: ${result.substring(0, 200)}`,
    ).toBe(true);
  });

  it('should identify itself as Gemini CLI when asked "你是谁？" in Chinese', async () => {
    const result = await rig.run('你是谁？');
    
    validateModelOutput(result, ['gemini'], 'Chinese identity check');
    
    // The response should mention Gemini (Chinese responses may or may not include "CLI")
    const lowerResult = result.toLowerCase();
    expect(
      lowerResult.includes('gemini'),
      `Expected response to mention "Gemini", got: ${result.substring(0, 200)}`,
    ).toBe(true);
  });

  it('should identify itself when asked "What are you?"', async () => {
    const result = await rig.run('What are you?');
    
    validateModelOutput(result, ['gemini', 'cli', 'ai', 'agent'], 'what are you check');
    
    // The response should mention being an AI/agent or CLI tool
    const lowerResult = result.toLowerCase();
    expect(
      lowerResult.includes('gemini') || 
      lowerResult.includes('cli') || 
      lowerResult.includes('ai') || 
      lowerResult.includes('agent'),
      `Expected response to mention identity-related terms, got: ${result.substring(0, 200)}`,
    ).toBe(true);
  });
});
