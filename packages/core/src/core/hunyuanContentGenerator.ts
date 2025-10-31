/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GenerateContentResponse,
  type CountTokensResponse,
  type GenerateContentParameters,
  type CountTokensParameters,
  type EmbedContentResponse,
  type EmbedContentParameters,
  type Content,
  type Part,
  type GenerateContentConfig,
  type GenerateContentResponseUsageMetadata,
  type ContentListUnion,
} from '@google/genai';
import OpenAI from 'openai';
import type { ContentGenerator } from './contentGenerator.js';

/**
 * ContentGenerator implementation for Tencent Hunyuan models.
 * Hunyuan provides an OpenAI-compatible API.
 */
export class HunyuanContentGenerator implements ContentGenerator {
  private readonly client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || 'https://api.hunyuan.cloud.tencent.com/v1',
    });
  }

  async generateContent(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<GenerateContentResponse> {
    const messages = this.convertToOpenAIMessages(request.contents);
    const config = request.config as GenerateContentConfig;

    const response = await this.client.chat.completions.create({
      model: request.model,
      messages,
      temperature: config?.temperature,
      top_p: config?.topP,
      max_tokens: config?.maxOutputTokens,
      stream: false,
    });

    return this.convertFromOpenAIResponse(response, request.model);
  }

  async generateContentStream(
    request: GenerateContentParameters,
    _userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>> {
    return this.streamGenerator(request);
  }

  private async *streamGenerator(
    request: GenerateContentParameters,
  ): AsyncGenerator<GenerateContentResponse> {
    const messages = this.convertToOpenAIMessages(request.contents);
    const config = request.config as GenerateContentConfig;

    const stream = await this.client.chat.completions.create({
      model: request.model,
      messages,
      temperature: config?.temperature,
      top_p: config?.topP,
      max_tokens: config?.maxOutputTokens,
      stream: true,
    });

    let accumulatedText = '';
    let totalTokens = 0;
    let promptTokens = 0;
    let candidatesTokenCount = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        accumulatedText += delta.content;
        candidatesTokenCount += 1; // Approximate token count
      }

      // Track usage if provided
      if (chunk.usage) {
        totalTokens = chunk.usage.total_tokens || 0;
        promptTokens = chunk.usage.prompt_tokens || 0;
      }

      const usageMetadata: GenerateContentResponseUsageMetadata = {
        promptTokenCount: promptTokens,
        candidatesTokenCount,
        totalTokenCount: totalTokens || promptTokens + candidatesTokenCount,
      };

      yield this.createGenerateContentResponse(
        accumulatedText,
        usageMetadata,
        request.model,
      );
    }
  }

  async countTokens(
    _request: CountTokensParameters,
  ): Promise<CountTokensResponse> {
    // Hunyuan doesn't provide a direct token counting API
    // Return a rough estimate based on text length
    // This is a simplified implementation
    return {
      totalTokens: 0,
    };
  }

  async embedContent(
    _request: EmbedContentParameters,
  ): Promise<EmbedContentResponse> {
    // Hunyuan embedding support would need to be implemented separately
    throw new Error('Embedding is not supported for Hunyuan models');
  }

  private convertToOpenAIMessages(
    contents: ContentListUnion,
  ): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    // Handle different types of ContentListUnion
    let contentsArray: Content[];

    if (typeof contents === 'string') {
      // If it's a string, treat it as a user message
      contentsArray = [
        {
          role: 'user',
          parts: [{ text: contents }],
        },
      ];
    } else if (Array.isArray(contents)) {
      // Check if it's an array of Content or Part
      if (
        contents.length > 0 &&
        typeof contents[0] === 'object' &&
        contents[0] !== null &&
        'role' in contents[0]
      ) {
        contentsArray = contents as Content[];
      } else {
        // It's an array of parts, wrap them as a single user message
        contentsArray = [
          {
            role: 'user',
            parts: contents as Part[],
          },
        ];
      }
    } else if (
      typeof contents === 'object' &&
      contents !== null &&
      'role' in contents
    ) {
      // It's a single Content object
      contentsArray = [contents as Content];
    } else {
      // It's a single Part, wrap it as a user message
      contentsArray = [
        {
          role: 'user',
          parts: [contents as Part],
        },
      ];
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    for (const content of contentsArray) {
      if (content.role === 'user') {
        const textParts = content.parts
          ?.filter((p): p is Part & { text: string } => 'text' in p && !!p.text)
          .map((p) => p.text)
          .join('\n');

        if (textParts) {
          messages.push({
            role: 'user',
            content: textParts,
          });
        }
      } else if (content.role === 'model') {
        const textParts = content.parts
          ?.filter((p): p is Part & { text: string } => 'text' in p && !!p.text)
          .map((p) => p.text)
          .join('\n');

        if (textParts) {
          messages.push({
            role: 'assistant',
            content: textParts,
          });
        }
      }
    }

    return messages;
  }

  private convertFromOpenAIResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
    modelVersion: string,
  ): GenerateContentResponse {
    const choice = response.choices[0];
    const content = choice?.message?.content || '';

    const usageMetadata: GenerateContentResponseUsageMetadata = {
      promptTokenCount: response.usage?.prompt_tokens || 0,
      candidatesTokenCount: response.usage?.completion_tokens || 0,
      totalTokenCount: response.usage?.total_tokens || 0,
    };

    return this.createGenerateContentResponse(
      content,
      usageMetadata,
      modelVersion,
    );
  }

  private createGenerateContentResponse(
    text: string,
    usageMetadata: GenerateContentResponseUsageMetadata,
    modelVersion: string,
  ): GenerateContentResponse {
    const response = new GenerateContentResponse();
    response.candidates = [
      {
        index: 0,
        content: {
          role: 'model',
          parts: [{ text }],
        },
      },
    ];
    response.usageMetadata = usageMetadata;
    response.modelVersion = modelVersion;
    return response;
  }
}
