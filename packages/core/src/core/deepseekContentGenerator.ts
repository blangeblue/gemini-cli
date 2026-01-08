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
  EmbedContentParameters,
  EmbedContentResponse,
  Content,
  Part,
} from '@google/genai';
import type { ContentGenerator } from './contentGenerator.js';

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
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
}

/**
 * ContentGenerator implementation for DeepSeek API.
 */
export class DeepSeekContentGenerator implements ContentGenerator {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(apiKey: string, baseUrl = 'https://api.deepseek.com', defaultModel = 'deepseek-chat') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.defaultModel = defaultModel;
  }

  private convertContentToMessages(
    contents: Content[],
    systemInstruction?: string,
  ): DeepSeekMessage[] {
    const messages: DeepSeekMessage[] = [];

    if (systemInstruction) {
      messages.push({
        role: 'system',
        content: systemInstruction,
      });
    }

    for (const content of contents) {
      if (content.role === 'user') {
        const parts = content.parts || [];
        const textParts: string[] = [];
        const imageParts: Array<{ type: string; image_url: { url: string } }> = [];

        for (const part of parts) {
          if (part.text) {
            textParts.push(part.text);
          } else if (part.inlineData) {
            const mimeType = part.inlineData.mimeType || 'image/png';
            const data = part.inlineData.data;
            imageParts.push({
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${data}`,
              },
            });
          } else if (part.functionResponse) {
            // Function responses are handled separately
            textParts.push(
              JSON.stringify({
                name: part.functionResponse.name,
                response: part.functionResponse.response,
              }),
            );
          }
        }

        if (imageParts.length > 0) {
          const contentArray: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
          if (textParts.length > 0) {
            contentArray.push({ type: 'text', text: textParts.join('\n') });
          }
          contentArray.push(...imageParts);
          messages.push({
            role: 'user',
            content: contentArray,
          });
        } else if (textParts.length > 0) {
          messages.push({
            role: 'user',
            content: textParts.join('\n'),
          });
        }
      } else if (content.role === 'model') {
        const parts = content.parts || [];
        const textParts: string[] = [];
        let hasToolCalls = false;

        for (const part of parts) {
          if (part.text) {
            textParts.push(part.text);
          } else if (part.functionCall) {
            hasToolCalls = true;
            // Tool calls are handled separately in the response conversion
          }
        }

        // Always add assistant message, even if empty (for tool call responses)
        messages.push({
          role: 'assistant',
          content: textParts.join('\n') || (hasToolCalls ? '' : ''),
        });
      }
    }

    return messages;
  }

  private convertTools(tools: Array<{ functionDeclarations: Array<{ name: string; description?: string; parameters?: Record<string, unknown> }> }>): Array<{ type: 'function'; function: { name: string; description?: string; parameters: Record<string, unknown> } }> {
    const result: Array<{ type: 'function'; function: { name: string; description?: string; parameters: Record<string, unknown> } }> = [];
    for (const tool of tools) {
      for (const func of tool.functionDeclarations) {
        result.push({
          type: 'function',
          function: {
            name: func.name,
            description: func.description,
            parameters: func.parameters || {},
          },
        });
      }
    }
    return result;
  }

  private convertResponseToGenerateContentResponse(
    response: DeepSeekChatCompletionResponse,
    model: string,
  ): GenerateContentResponse {
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No choices in DeepSeek response');
    }

    const parts: Part[] = [];

    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        parts.push({
          functionCall: {
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments || '{}'),
          },
        });
      }
    }

    return {
      modelVersion: response.model,
      candidates: [
        {
          content: {
            role: 'model',
            parts,
          },
          finishReason: this.convertFinishReason(choice.finish_reason),
        },
      ],
      usageMetadata: {
        promptTokenCount: response.usage.prompt_tokens,
        candidatesTokenCount: response.usage.completion_tokens,
        totalTokenCount: response.usage.total_tokens,
      },
    };
  }

  private convertFinishReason(reason: string): 'STOP' | 'MAX_TOKENS' | 'SAFETY' | 'RECITATION' | 'OTHER' {
    switch (reason) {
      case 'stop':
        return 'STOP';
      case 'length':
        return 'MAX_TOKENS';
      case 'content_filter':
        return 'SAFETY';
      default:
        return 'OTHER';
    }
  }

  async generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const model = request.model || this.defaultModel;
    const messages = this.convertContentToMessages(
      request.contents || [],
      request.systemInstruction,
    );

    const body: DeepSeekChatCompletionRequest = {
      model,
      messages,
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxOutputTokens,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = this.convertTools(request.tools);
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as DeepSeekChatCompletionResponse;
    return this.convertResponseToGenerateContentResponse(data, model);
  }

  async *generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): AsyncGenerator<GenerateContentResponse> {
    const model = request.model || this.defaultModel;
    const messages = this.convertContentToMessages(
      request.contents || [],
      request.systemInstruction,
    );

    const body: DeepSeekChatCompletionRequest = {
      model,
      messages,
      temperature: request.temperature,
      top_p: request.topP,
      max_tokens: request.maxOutputTokens,
      stream: true,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = this.convertTools(request.tools);
      body.tool_choice = 'auto';
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    let accumulatedToolCalls: Array<{ id: string; name: string; arguments: string }> = [];
    let modelVersion = model;
    let usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined;
    let isFirstChunk = true;

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
              continue;
            }

            try {
              const chunk = JSON.parse(data) as DeepSeekStreamChunk;
              modelVersion = chunk.model;

              if (chunk.choices && chunk.choices.length > 0) {
                const choice = chunk.choices[0];
                if (choice.delta.content) {
                  accumulatedText += choice.delta.content;
                }

                if (choice.delta.tool_calls) {
                  for (const toolCall of choice.delta.tool_calls) {
                    const index = toolCall.index || 0;
                    if (!accumulatedToolCalls[index]) {
                      accumulatedToolCalls[index] = {
                        id: toolCall.id || '',
                        name: toolCall.function?.name || '',
                        arguments: toolCall.function?.arguments || '',
                      };
                    } else {
                      accumulatedToolCalls[index].arguments += toolCall.function?.arguments || '';
                    }
                  }
                }

                if (choice.finish_reason) {
                  const parts: Part[] = [];
                  if (accumulatedText) {
                    parts.push({ text: accumulatedText });
                  }
                  for (const toolCall of accumulatedToolCalls) {
                    if (toolCall.name) {
                      parts.push({
                        functionCall: {
                          name: toolCall.name,
                          args: JSON.parse(toolCall.arguments || '{}'),
                        },
                      });
                    }
                  }

                  yield {
                    modelVersion,
                    candidates: [
                      {
                        content: {
                          role: 'model',
                          parts: parts.length > 0 ? parts : [{ text: '' }],
                        },
                        finishReason: this.convertFinishReason(choice.finish_reason),
                      },
                    ],
                    usageMetadata,
                  };

                  accumulatedText = '';
                  accumulatedToolCalls = [];
                } else {
                  // Yield incremental updates
                  const parts: Part[] = [];
                  if (accumulatedText) {
                    parts.push({ text: accumulatedText });
                  }
                  if (parts.length > 0 || isFirstChunk) {
                    yield {
                      modelVersion,
                      candidates: [
                        {
                          content: {
                            role: 'model',
                            parts: parts.length > 0 ? parts : [{ text: '' }],
                          },
                        },
                      ],
                    };
                    isFirstChunk = false;
                  }
                }
              }
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(request: CountTokensParameters): Promise<CountTokensResponse> {
    // DeepSeek API doesn't have a separate count tokens endpoint
    // We'll estimate based on content length
    const contents = request.contents || [];
    let totalTokens = 0;

    for (const content of contents) {
      const parts = content.parts || [];
      for (const part of parts) {
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
    // DeepSeek doesn't have an embedding API in the same way
    // This is a placeholder implementation
    throw new Error('Embedding is not supported for DeepSeek models');
  }
}
