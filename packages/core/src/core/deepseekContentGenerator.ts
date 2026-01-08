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
  GenerateContentResponseUsageMetadata,
  Part,
} from '@google/genai';
import { FinishReason } from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';
import { ProxyAgent, setGlobalDispatcher } from 'undici';

const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekChatCompletionRequest {
  model: string;
  messages: DeepSeekMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: Record<string, unknown>;
    };
  }>;
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

interface DeepSeekChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DeepSeekStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Converts Gemini Content format to DeepSeek messages format
 */
function convertContentsToDeepSeekMessages(
  contents: Content[],
  systemInstruction?: string | Part | Part[] | Content,
): DeepSeekMessage[] {
  const messages: DeepSeekMessage[] = [];

  // Add system instruction if provided
  if (systemInstruction) {
    if (typeof systemInstruction === 'string') {
      messages.push({ role: 'system', content: systemInstruction });
    } else if (Array.isArray(systemInstruction)) {
      const systemParts = systemInstruction
        .map((part) => {
          if (typeof part === 'string') return part;
          if ('text' in part) return part.text;
          return '';
        })
        .filter(Boolean)
        .join('\n');
      if (systemParts) {
        messages.push({ role: 'system', content: systemParts });
      }
    } else if ('parts' in systemInstruction && systemInstruction.parts) {
      const systemText = systemInstruction.parts
        .map((part) => {
          if (typeof part === 'string') return part;
          if ('text' in part) return part.text;
          return '';
        })
        .filter(Boolean)
        .join('\n');
      if (systemText) {
        messages.push({ role: 'system', content: systemText });
      }
    }
  }

  // Convert conversation contents
  for (const content of contents) {
    if (content.role === 'user') {
      const textParts = content.parts
        ?.map((part) => {
          if (typeof part === 'string') return part;
          if ('text' in part) return part.text;
          if ('functionResponse' in part) {
            // Convert function response to text representation
            return `[Function Response: ${JSON.stringify(part.functionResponse)}]`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
      if (textParts) {
        messages.push({ role: 'user', content: textParts });
      }
    } else if (content.role === 'model') {
      const textParts = content.parts
        ?.map((part) => {
          if (typeof part === 'string') return part;
          if ('text' in part) return part.text;
          if ('functionCall' in part) {
            // Convert function call to text representation
            return `[Function Call: ${part.functionCall.name}(${JSON.stringify(part.functionCall.args)})]`;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
      if (textParts) {
        messages.push({ role: 'assistant', content: textParts });
      }
    }
  }

  return messages;
}

/**
 * Converts DeepSeek response to Gemini format
 */
function convertDeepSeekResponseToGemini(
  deepseekResponse: DeepSeekChatCompletionResponse,
  model: string,
): GenerateContentResponse {
  const choice = deepseekResponse.choices[0];
  if (!choice) {
    throw new Error('No choice in DeepSeek response');
  }

  const parts: Part[] = [];
  if (choice.message.content) {
    parts.push({ text: choice.message.content });
  }

  // Handle tool calls
  if (choice.message.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args,
          },
        });
      } catch (e) {
        // If parsing fails, include as text
        parts.push({
          text: `[Tool Call: ${toolCall.function.name}(${toolCall.function.arguments})]`,
        });
      }
    }
  }

  const usageMetadata: GenerateContentResponseUsageMetadata = {
    promptTokenCount: deepseekResponse.usage.prompt_tokens,
    candidatesTokenCount: deepseekResponse.usage.completion_tokens,
    totalTokenCount: deepseekResponse.usage.total_tokens,
  };

  return {
    response: {
      candidates: [
        {
          content: {
            role: 'model',
            parts,
          },
          finishReason:
            choice.finish_reason === 'stop'
              ? FinishReason.STOP
              : FinishReason.OTHER,
        },
      ],
    },
    usageMetadata,
    modelVersion: model,
  };
}

/**
 * Converts DeepSeek stream chunk to Gemini format
 */
function convertDeepSeekStreamChunkToGemini(
  chunk: DeepSeekStreamChunk,
  model: string,
): GenerateContentResponse {
  const choice = chunk.choices[0];
  if (!choice) {
    return {
      response: {
        candidates: [],
      },
      modelVersion: model,
    };
  }

  const parts: Part[] = [];
  if (choice.delta.content) {
    parts.push({ text: choice.delta.content });
  }

  // Handle tool calls in stream
  if (choice.delta.tool_calls) {
    for (const toolCall of choice.delta.tool_calls) {
      if (toolCall.function) {
        try {
          const args = toolCall.function.arguments
            ? JSON.parse(toolCall.function.arguments)
            : {};
          parts.push({
            functionCall: {
              name: toolCall.function.name || '',
              args,
            },
          });
        } catch (e) {
          // If parsing fails, skip
        }
      }
    }
  }

  const usageMetadata: GenerateContentResponseUsageMetadata | undefined =
    chunk.usage
      ? {
          promptTokenCount: chunk.usage.prompt_tokens,
          candidatesTokenCount: chunk.usage.completion_tokens,
          totalTokenCount: chunk.usage.total_tokens,
        }
      : undefined;

  return {
    response: {
      candidates: [
        {
          content: {
            role: 'model',
            parts,
          },
          finishReason:
            choice.finish_reason === 'stop'
              ? FinishReason.STOP
              : undefined,
        },
      ],
    },
    usageMetadata,
    modelVersion: model,
  };
}

/**
 * ContentGenerator implementation for DeepSeek API
 */
export class DeepSeekContentGenerator implements ContentGenerator {
  private apiKey: string;
  private baseUrl: string;
  private proxy?: string;

  constructor(apiKey: string, baseUrl?: string, proxy?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || DEEPSEEK_API_BASE_URL;
    this.proxy = proxy;

    // Configure proxy if provided
    if (this.proxy) {
      const proxyAgent = new ProxyAgent(this.proxy);
      setGlobalDispatcher(proxyAgent);
    }
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const messages = convertContentsToDeepSeekMessages(
      request.contents,
      request.config?.systemInstruction,
    );

    const deepseekRequest: DeepSeekChatCompletionRequest = {
      model: request.model,
      messages,
      temperature: request.config?.temperature,
      top_p: request.config?.topP,
      max_tokens: request.config?.maxOutputTokens,
      stream: false,
    };

    // Convert tools if present
    if (request.config?.tools && request.config.tools.length > 0) {
      deepseekRequest.tools = request.config.tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.functionDeclarations[0]?.name || '',
          description: tool.functionDeclarations[0]?.description,
          parameters:
            (tool.functionDeclarations[0]?.parameters as Record<
              string,
              unknown
            >) || {},
        },
      }));

      // Handle tool_choice
      if (request.config.toolConfig) {
        const mode = request.config.toolConfig.functionCallingConfig?.mode;
        if (mode === 'NONE') {
          deepseekRequest.tool_choice = 'none';
        } else if (mode === 'AUTO') {
          deepseekRequest.tool_choice = 'auto';
        } else if (mode === 'ANY') {
          deepseekRequest.tool_choice = 'auto';
        }
      }
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(deepseekRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const deepseekResponse: DeepSeekChatCompletionResponse =
      await response.json();
    return convertDeepSeekResponseToGemini(deepseekResponse, request.model);
  }

  async *generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): AsyncGenerator<GenerateContentResponse> {
    const messages = convertContentsToDeepSeekMessages(
      request.contents,
      request.config?.systemInstruction,
    );

    const deepseekRequest: DeepSeekChatCompletionRequest = {
      model: request.model,
      messages,
      temperature: request.config?.temperature,
      top_p: request.config?.topP,
      max_tokens: request.config?.maxOutputTokens,
      stream: true,
    };

    // Convert tools if present
    if (request.config?.tools && request.config.tools.length > 0) {
      deepseekRequest.tools = request.config.tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.functionDeclarations[0]?.name || '',
          description: tool.functionDeclarations[0]?.description,
          parameters:
            (tool.functionDeclarations[0]?.parameters as Record<
              string,
              unknown
            >) || {},
        },
      }));

      // Handle tool_choice
      if (request.config.toolConfig) {
        const mode = request.config.toolConfig.functionCallingConfig?.mode;
        if (mode === 'NONE') {
          deepseekRequest.tool_choice = 'none';
        } else if (mode === 'AUTO') {
          deepseekRequest.tool_choice = 'auto';
        } else if (mode === 'ANY') {
          deepseekRequest.tool_choice = 'auto';
        }
      }
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(deepseekRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    if (!response.body) {
      throw new Error('No response body from DeepSeek API');
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
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const chunk: DeepSeekStreamChunk = JSON.parse(jsonStr);
              yield convertDeepSeekStreamChunkToGemini(chunk, request.model);
            } catch (e) {
              // Skip malformed JSON
            }
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim() && buffer.trim().startsWith('data: ')) {
        const jsonStr = buffer.trim().slice(6);
        if (jsonStr !== '[DONE]') {
          try {
            const chunk: DeepSeekStreamChunk = JSON.parse(jsonStr);
            yield convertDeepSeekStreamChunkToGemini(chunk, request.model);
          } catch (e) {
            // Skip malformed JSON
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
    // DeepSeek doesn't have a separate token counting endpoint
    // We'll estimate based on character count (rough approximation)
    const contents = request.contents || [];
    let totalChars = 0;

    for (const content of contents) {
      if (content.parts) {
        for (const part of content.parts) {
          if (typeof part === 'string') {
            totalChars += part.length;
          } else if ('text' in part && part.text) {
            totalChars += part.text.length;
          }
        }
      }
    }

    // Rough estimation: ~4 characters per token for English text
    const estimatedTokens = Math.ceil(totalChars / 4);

    return {
      totalTokens: estimatedTokens,
    };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // DeepSeek doesn't have an embedding API endpoint
    throw new Error('Embedding is not supported by DeepSeek API');
  }
}
