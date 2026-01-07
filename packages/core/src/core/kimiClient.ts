/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Content,
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
  Part,
} from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';
import { getResponseText } from '../utils/partUtils.js';

const KIMI_API_BASE_URL = 'https://api.moonshot.cn/v1';

interface KimiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface KimiChatCompletionRequest {
  model: string;
  messages: KimiMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface KimiChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: KimiMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface KimiStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
}

/**
 * Converts Gemini Content format to Kimi messages format
 */
function convertContentsToKimiMessages(
  contents: Content[],
  systemInstruction?: string | Part | Part[] | Content,
): KimiMessage[] {
  const messages: KimiMessage[] = [];

  // Add system instruction if provided
  if (systemInstruction) {
    let systemText = '';
    if (typeof systemInstruction === 'string') {
      systemText = systemInstruction;
    } else if (Array.isArray(systemInstruction)) {
      systemText = systemInstruction
        .map((part) => (typeof part === 'string' ? part : part.text || ''))
        .join('');
    } else if ('text' in systemInstruction) {
      systemText = systemInstruction.text || '';
    } else if ('parts' in systemInstruction) {
      systemText = (systemInstruction.parts || [])
        .map((part) => part.text || '')
        .join('');
    }
    if (systemText) {
      messages.push({ role: 'system', content: systemText });
    }
  }

  // Convert conversation history
  for (const content of contents) {
    if (content.role === 'user') {
      const userText = (content.parts || [])
        .map((part) => {
          if ('text' in part) return part.text || '';
          // Skip function calls and other non-text parts for now
          // Kimi API may not support function calling
          return '';
        })
        .filter((text) => text.length > 0)
        .join('');
      if (userText) {
        messages.push({ role: 'user', content: userText });
      }
    } else if (content.role === 'model') {
      const assistantText = (content.parts || [])
        .map((part) => {
          if ('text' in part) return part.text || '';
          // Skip function calls and other non-text parts for now
          return '';
        })
        .filter((text) => text.length > 0)
        .join('');
      if (assistantText) {
        messages.push({ role: 'assistant', content: assistantText });
      }
    }
  }

  return messages;
}

/**
 * Converts Kimi response to Gemini GenerateContentResponse format
 */
function convertKimiResponseToGemini(
  kimiResponse: KimiChatCompletionResponse,
  model: string,
): GenerateContentResponse {
  const choice = kimiResponse.choices[0];
  if (!choice) {
    throw new Error('No choice in Kimi API response');
  }

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: [{ text: choice.message.content || '' }],
        },
        finishReason: choice.finish_reason as any,
      },
    ],
    usageMetadata: {
      promptTokenCount: kimiResponse.usage.prompt_tokens,
      candidatesTokenCount: kimiResponse.usage.completion_tokens,
      totalTokenCount: kimiResponse.usage.total_tokens,
    },
    modelVersion: kimiResponse.model,
  };
}

/**
 * Kimi API client that implements ContentGenerator interface
 */
export class KimiClient implements ContentGenerator {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly httpOptions?: { headers?: Record<string, string> };

  constructor(
    apiKey: string,
    httpOptions?: { headers?: Record<string, string> },
  ) {
    if (!apiKey) {
      throw new Error('KIMI_API_KEY is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = KIMI_API_BASE_URL;
    this.httpOptions = httpOptions;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...this.httpOptions?.headers,
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Kimi API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    return response.json();
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const { model, contents, config } = request;

    // Map Gemini model names to Kimi model names
    const kimiModel = this.mapModelToKimi(model);

    const messages = convertContentsToKimiMessages(
      contents,
      config?.systemInstruction,
    );

    const requestBody: KimiChatCompletionRequest = {
      model: kimiModel,
      messages,
      temperature: config?.temperature,
      top_p: config?.topP,
      max_tokens: config?.maxOutputTokens,
      stream: false,
    };

    const response = await this.makeRequest<KimiChatCompletionResponse>(
      '/chat/completions',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      },
    );

    return convertKimiResponseToGemini(response, model);
  }

  async *generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): AsyncGenerator<GenerateContentResponse> {
    const { model, contents, config } = request;

    const kimiModel = this.mapModelToKimi(model);
    const messages = convertContentsToKimiMessages(
      contents,
      config?.systemInstruction,
    );

    const requestBody: KimiChatCompletionRequest = {
      model: kimiModel,
      messages,
      temperature: config?.temperature,
      top_p: config?.topP,
      max_tokens: config?.maxOutputTokens,
      stream: true,
    };

    const url = `${this.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...this.httpOptions?.headers,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Kimi API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';
    let usageMetadata: GenerateContentResponse['usageMetadata'] | undefined;

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
              continue;
            }

            try {
              const chunk: KimiStreamChunk = JSON.parse(data);
              const choice = chunk.choices[0];
              if (choice?.delta?.content) {
                accumulatedContent += choice.delta.content;

                yield {
                  candidates: [
                    {
                      content: {
                        role: 'model',
                        parts: [{ text: accumulatedContent }],
                      },
                      finishReason: choice.finish_reason as any,
                    },
                  ],
                  modelVersion: chunk.model,
                };
              }

              if (choice?.finish_reason && choice.finish_reason !== null) {
                // Final chunk - we'll estimate usage based on content length
                // Note: Actual usage should come from the API response if available
                usageMetadata = {
                  promptTokenCount: 0,
                  candidatesTokenCount: Math.floor(accumulatedContent.length / 4),
                  totalTokenCount: Math.floor(accumulatedContent.length / 4),
                };
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      // Final response with accumulated content
      if (accumulatedContent) {
        yield {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: accumulatedContent }],
              },
              finishReason: 'STOP' as any,
            },
          ],
          usageMetadata,
          modelVersion: kimiModel,
        };
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(
    request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Kimi API doesn't have a separate count_tokens endpoint
    // We'll estimate based on character count (rough approximation: 1 token ≈ 4 characters)
    const contents = request.contents || [];
    let totalChars = 0;

    for (const content of contents) {
      const text = (content.parts || [])
        .map((part) => (part.text || ''))
        .join('');
      totalChars += text.length;
    }

    const estimatedTokens = Math.ceil(totalChars / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Kimi API may not support embeddings, throw an error for now
    throw new Error('Embeddings are not supported by Kimi API');
  }

  /**
   * Maps Gemini model names to Kimi model names
   * Kimi (Moonshot AI) models:
   * - moonshot-v1-8k: 8K context window
   * - moonshot-v1-32k: 32K context window
   * - moonshot-v1-128k: 128K context window
   */
  private mapModelToKimi(model: string): string {
    // Map common kimi model names to Moonshot API model names
    const modelMap: Record<string, string> = {
      'kimi-1': 'moonshot-v1-8k',
      'kimi-2': 'moonshot-v1-32k',
      'kimi-3': 'moonshot-v1-128k',
      'kimi-pro': 'moonshot-v1-8k',
      'kimi-plus': 'moonshot-v1-32k',
      'kimi-max': 'moonshot-v1-128k',
      'moonshot-v1-8k': 'moonshot-v1-8k',
      'moonshot-v1-32k': 'moonshot-v1-32k',
      'moonshot-v1-128k': 'moonshot-v1-128k',
    };

    // If model is already a known kimi model, use the mapping
    if (modelMap[model.toLowerCase()]) {
      return modelMap[model.toLowerCase()];
    }

    // If model starts with kimi- or moonshot-, try to use it directly
    const lowerModel = model.toLowerCase();
    if (lowerModel.startsWith('kimi-') || lowerModel.startsWith('moonshot-')) {
      return model; // Use as-is, assuming it's a valid Kimi model name
    }

    // Default to 32k context window model
    return 'moonshot-v1-32k';
  }
}
