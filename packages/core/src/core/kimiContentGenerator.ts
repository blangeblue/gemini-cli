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
  Content,
  Part,
} from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';
import type { UserTierId } from '../code_assist/types.js';
import { ProxyAgent } from 'undici';

/**
 * Kimi Content Generator implementation.
 * Kimi uses OpenAI-compatible API, so we need to adapt the Google GenAI interface.
 */
export class KimiContentGenerator implements ContentGenerator {
  private apiKey: string;
  private baseUrl: string;
  private httpOptions: { headers: Record<string, string> };
  private proxy?: string;

  constructor(
    apiKey: string,
    httpOptions?: { headers?: Record<string, string> },
    proxy?: string,
  ) {
    this.apiKey = apiKey;
    this.baseUrl = process.env['KIMI_API_BASE_URL'] || 'https://api.moonshot.cn';
    this.httpOptions = httpOptions || { headers: {} };
    this.proxy = proxy;
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const model = request.model || 'moonshot-v1-8k';
    const contents = request.contents || [];
    const config = request.config || {};

    // Convert Google GenAI format to OpenAI format
    const messages = this.convertContentsToMessages(contents);

    const requestBody: any = {
      model,
      messages,
      temperature: config.temperature,
      top_p: config.topP,
      max_tokens: config.maxOutputTokens,
      stream: false,
    };

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.httpOptions.headers,
      },
      body: JSON.stringify(requestBody),
    };

    if (this.proxy) {
      const proxyAgent = new ProxyAgent(this.proxy);
      (fetchOptions as any).dispatcher = proxyAgent;
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, fetchOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Kimi API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Convert OpenAI format to Google GenAI format
    return this.convertOpenAIResponseToGenAI(data);
  }

  async *generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): AsyncGenerator<GenerateContentResponse> {
    const model = request.model || 'moonshot-v1-8k';
    const contents = request.contents || [];
    const config = request.config || {};

    // Convert Google GenAI format to OpenAI format
    const messages = this.convertContentsToMessages(contents);

    const requestBody: any = {
      model,
      messages,
      temperature: config.temperature,
      top_p: config.topP,
      max_tokens: config.maxOutputTokens,
      stream: true,
    };

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.httpOptions.headers,
      },
      body: JSON.stringify(requestBody),
    };

    if (this.proxy) {
      const proxyAgent = new ProxyAgent(this.proxy);
      (fetchOptions as any).dispatcher = proxyAgent;
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, fetchOptions);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Kimi API error: ${error.error?.message || response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response stream');
    }

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
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const parsed = JSON.parse(data);
              yield this.convertOpenAIStreamResponseToGenAI(parsed);
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

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // Kimi doesn't have a separate token counting endpoint
    // We'll estimate based on content length
    const contents = request.contents || [];
    let totalTokens = 0;

    for (const content of contents) {
      for (const part of content.parts || []) {
        if (part.text) {
          // Rough estimation: ~4 characters per token
          totalTokens += Math.ceil(part.text.length / 4);
        }
      }
    }

    return {
      totalTokens,
    };
  }

  async embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse> {
    // Kimi doesn't have an embedding endpoint in the same way
    // This is a placeholder implementation
    throw new Error('Embedding is not supported for Kimi models');
  }

  private convertContentsToMessages(contents: Content[]): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];

    for (const content of contents) {
      const role = content.role === 'user' ? 'user' : content.role === 'model' ? 'assistant' : 'system';
      const textParts: string[] = [];

      for (const part of content.parts || []) {
        if (part.text) {
          textParts.push(part.text);
        }
      }

      if (textParts.length > 0) {
        messages.push({
          role,
          content: textParts.join('\n'),
        });
      }
    }

    return messages;
  }

  private convertOpenAIResponseToGenAI(data: any): GenerateContentResponse {
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No choice in Kimi API response');
    }

    const content = choice.message?.content || '';
    const finishReason = this.mapFinishReason(choice.finish_reason);

    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [{ text: content }],
          },
          finishReason,
          index: 0,
        },
      ],
      usageMetadata: {
        promptTokenCount: data.usage?.prompt_tokens || 0,
        candidatesTokenCount: data.usage?.completion_tokens || 0,
        totalTokenCount: data.usage?.total_tokens || 0,
      },
    };
  }

  private convertOpenAIStreamResponseToGenAI(data: any): GenerateContentResponse {
    const choice = data.choices?.[0];
    if (!choice) {
      return {
        candidates: [],
      };
    }

    const delta = choice.delta || {};
    const content = delta.content || '';
    const finishReason = choice.finish_reason
      ? this.mapFinishReason(choice.finish_reason)
      : undefined;

    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: content ? [{ text: content }] : [],
          },
          finishReason,
          index: 0,
        },
      ],
    };
  }

  private mapFinishReason(reason: string): string {
    const mapping: Record<string, string> = {
      stop: 'STOP',
      length: 'MAX_TOKENS',
      content_filter: 'SAFETY',
    };
    return mapping[reason] || 'OTHER';
  }
}
