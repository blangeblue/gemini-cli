/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HunyuanContentGenerator } from './hunyuanContentGenerator.js';
import type { GenerateContentParameters } from '@google/genai';

// Mock the OpenAI module
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

describe('HunyuanContentGenerator', () => {
  let generator: HunyuanContentGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new HunyuanContentGenerator('test-api-key');
  });

  describe('generateContent', () => {
    it('should generate content from a simple text prompt', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Hello, world!',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const request: GenerateContentParameters = {
        model: 'hunyuan-turbos-latest',
        contents: 'Hello',
      };

      const result = await generator.generateContent(request, 'test-prompt-id');

      expect(result.candidates).toBeDefined();
      expect(result.candidates).toHaveLength(1);
      expect(result.text).toBe('Hello, world!');
      expect(result.usageMetadata).toEqual({
        promptTokenCount: 10,
        candidatesTokenCount: 5,
        totalTokenCount: 15,
      });
    });

    it('should handle Content array input', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Response',
            },
          },
        ],
        usage: {
          prompt_tokens: 20,
          completion_tokens: 10,
          total_tokens: 30,
        },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const request: GenerateContentParameters = {
        model: 'hunyuan-lite',
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Question' }],
          },
        ],
      };

      const result = await generator.generateContent(request, 'test-prompt-id');

      expect(result.candidates).toBeDefined();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'hunyuan-lite',
          messages: [
            {
              role: 'user',
              content: 'Question',
            },
          ],
          stream: false,
        }),
      );
    });

    it('should pass temperature and topP configuration', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      mockCreate.mockResolvedValue(mockResponse);

      const request: GenerateContentParameters = {
        model: 'hunyuan-turbos-latest',
        contents: 'Test',
        config: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 1000,
        },
      };

      await generator.generateContent(request, 'test-prompt-id');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 1000,
        }),
      );
    });
  });

  describe('generateContentStream', () => {
    it('should return an async generator', async () => {
      const mockStream = [
        {
          choices: [{ delta: { content: 'Hello' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
        {
          choices: [{ delta: { content: ' world' } }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        },
      ];

      // Mock async generator
      mockCreate.mockResolvedValue(
        (async function* () {
          for (const chunk of mockStream) {
            yield chunk;
          }
        })(),
      );

      const request: GenerateContentParameters = {
        model: 'hunyuan-lite',
        contents: 'Test',
      };

      const streamGenerator = await generator.generateContentStream(
        request,
        'test-prompt-id',
      );

      const responses = [];
      for await (const response of streamGenerator) {
        responses.push(response);
      }

      expect(responses).toHaveLength(2);
      expect(responses[0].text).toBe('Hello');
      expect(responses[1].text).toBe('Hello world');
    });
  });

  describe('countTokens', () => {
    it('should return a token count response', async () => {
      const request = {
        model: 'hunyuan-turbos-latest',
        contents: 'Test content',
      };

      const result = await generator.countTokens(request);

      expect(result).toEqual({
        totalTokens: 0,
      });
    });
  });

  describe('embedContent', () => {
    it('should throw an error for embedding requests', async () => {
      const request = {
        model: 'hunyuan-turbos-latest',
        contents: ['Test'],
      };

      await expect(generator.embedContent(request)).rejects.toThrow(
        'Embedding is not supported for Hunyuan models',
      );
    });
  });
});
