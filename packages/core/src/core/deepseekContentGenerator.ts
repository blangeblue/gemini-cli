/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensResponse,
  GenerateContentResponse,
  GenerateContentParameters,
  CountTokensParameters,
  EmbedContentResponse,
  EmbedContentParameters,
  Part,
  Content,
} from '@google/genai';
import { FinishReason } from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';

/**
 * Deepseek ContentGenerator implementation using OpenAI-compatible API
 */
export class DeepseekContentGenerator implements ContentGenerator {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly proxy?: string;

  constructor(apiKey: string, baseUrl?: string, proxy?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.deepseek.com';
    this.proxy = proxy;
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const model = request.model || 'deepseek-chat';
    const contents = this.convertContents(request.contents || []);
    const systemInstruction = request.systemInstruction
      ? this.convertPart(request.systemInstruction)
      : undefined;

    const body: Record<string, unknown> = {
      model,
      messages: contents,
      ...(systemInstruction && { system: systemInstruction }),
      ...(request.generationConfig?.temperature !== undefined && {
        temperature: request.generationConfig.temperature,
      }),
      ...(request.generationConfig?.topP !== undefined && {
        top_p: request.generationConfig.topP,
      }),
      ...(request.generationConfig?.maxOutputTokens !== undefined && {
        max_tokens: request.generationConfig.maxOutputTokens,
      }),
    };

    const response = await this.makeRequest('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return this.convertResponse(data);
  }

  async *generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): AsyncGenerator<GenerateContentResponse> {
    const model = request.model || 'deepseek-chat';
    const contents = this.convertContents(request.contents || []);
    const systemInstruction = request.systemInstruction
      ? this.convertPart(request.systemInstruction)
      : undefined;

    const body: Record<string, unknown> = {
      model,
      messages: contents,
      stream: true,
      ...(systemInstruction && { system: systemInstruction }),
      ...(request.generationConfig?.temperature !== undefined && {
        temperature: request.generationConfig.temperature,
      }),
      ...(request.generationConfig?.topP !== undefined && {
        top_p: request.generationConfig.topP,
      }),
      ...(request.generationConfig?.maxOutputTokens !== undefined && {
        max_tokens: request.generationConfig.maxOutputTokens,
      }),
    };

    const response = await this.makeRequest('/v1/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              yield this.convertStreamResponse(parsed);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Deepseek API doesn't have a direct token counting endpoint
    // We'll estimate based on content length (rough approximation: 1 token ≈ 4 characters)
    const contents = request.contents || [];
    let totalChars = 0;

    for (const content of contents) {
      if (content.parts) {
        for (const part of content.parts) {
          if (part.text) {
            totalChars += part.text.length;
          }
        }
      }
    }

    const estimatedTokens = Math.ceil(totalChars / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Deepseek doesn't have a separate embedding API in the OpenAI-compatible format
    // This is a placeholder implementation
    throw new Error('Embedding is not supported for Deepseek models');
  }

  private async makeRequest(
    path: string,
    options: RequestInit,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...(options.headers as Record<string, string>),
    };

    const fetchOptions: RequestInit = {
      ...options,
      headers,
    };

    // Handle proxy if configured
    if (this.proxy) {
      const { ProxyAgent } = await import('undici');
      const agent = new ProxyAgent(this.proxy);
      // Note: undici's ProxyAgent is used via setGlobalDispatcher
      // For now, we'll rely on the global proxy configuration
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Deepseek API error: ${response.status} ${response.statusText}: ${errorText}`,
      );
    }

    return response;
  }

  private convertContents(contents: Content[]): Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }> {
    return contents.map((content) => {
      const role =
        content.role === 'model' ? 'assistant' : (content.role as 'user');
      const textParts = (content.parts || [])
        .filter((part): part is Part => part.type === 'text')
        .map((part) => part.text || '')
        .join('');

      return {
        role,
        content: textParts,
      };
    });
  }

  private convertPart(part: Part | string): string {
    if (typeof part === 'string') {
      return part;
    }
    if (part.type === 'text') {
      return part.text || '';
    }
    return '';
  }

  private convertResponse(data: {
    choices?: Array<{
      message?: { role?: string; content?: string };
      delta?: { role?: string; content?: string };
      finish_reason?: string;
    }>;
    usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
  }): GenerateContentResponse {
    const choice = data.choices?.[0];
    const message = choice?.message || choice?.delta;
    const text = message?.content || '';

    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text, type: 'text' }],
          },
          finishReason:
            choice?.finish_reason === 'stop'
              ? FinishReason.STOP
              : choice?.finish_reason === 'length'
                ? FinishReason.MAX_TOKENS
                : FinishReason.OTHER,
        },
      ],
      promptFeedback: {
        safetyRatings: [],
      },
      text: undefined,
      data: undefined,
      functionCalls: undefined,
      executableCode: undefined,
      codeExecutionResult: undefined,
    };
  }

  private convertStreamResponse(data: {
    choices?: Array<{
      delta?: { role?: string; content?: string };
      finish_reason?: string;
    }>;
  }): GenerateContentResponse {
    const choice = data.choices?.[0];
    const delta = choice?.delta;
    const text = delta?.content || '';

    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text, type: 'text' }],
          },
          finishReason: choice?.finish_reason
            ? choice.finish_reason === 'stop'
              ? FinishReason.STOP
              : choice.finish_reason === 'length'
                ? FinishReason.MAX_TOKENS
                : FinishReason.OTHER
            : undefined,
        },
      ],
      promptFeedback: {
        safetyRatings: [],
      },
      text: undefined,
      data: undefined,
      functionCalls: undefined,
      executableCode: undefined,
      codeExecutionResult: undefined,
    };
  }
}
