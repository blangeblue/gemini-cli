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
} from '@google/genai';
import { GoogleGenAI } from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import type { Config } from '../config/config.js';

import type { UserTierId } from '../code_assist/types.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';
import { InstallationManager } from '../utils/installationManager.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

// 认证类型枚举，定义支持的各种AI服务认证方式
export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal', // 使用 Google 个人账户 OAuth 登录
  USE_GEMINI = 'gemini-api-key', // 使用 Gemini API 密钥认证
  USE_VERTEX_AI = 'vertex-ai', // 使用 Google Cloud Vertex AI 认证
  CLOUD_SHELL = 'cloud-shell', // 在 Google Cloud Shell 环境中使用
  USE_HUNYUAN = 'hunyuan-api-key', // 使用腾讯混元 API 密钥认证
}

export type ContentGeneratorConfig = {
  apiKey?: string;
  vertexai?: boolean;
  authType?: AuthType;
  proxy?: string;
};

export function createContentGeneratorConfig(
  config: Config, // 应用程序配置对象
  authType: AuthType | undefined, // 认证类型，可能未定义
): ContentGeneratorConfig {
  // 从环境变量中获取各种 API 密钥
  const geminiApiKey = process.env['GEMINI_API_KEY'] || undefined; // Gemini API 密钥
  const googleApiKey = process.env['GOOGLE_API_KEY'] || undefined; // Google API 密钥
  const hunyuanApiKey = process.env['HUNYUAN_API_KEY'] || undefined; // 混元 API 密钥（新增支持）
  const googleCloudProject = process.env['GOOGLE_CLOUD_PROJECT'] || undefined; // Google Cloud 项目 ID
  const googleCloudLocation = process.env['GOOGLE_CLOUD_LOCATION'] || undefined; // Google Cloud 位置

  // 创建内容生成器配置对象
  const contentGeneratorConfig: ContentGeneratorConfig = {
    authType, // 设置认证类型
    proxy: config?.getProxy(), // 设置代理配置（如果存在）
  };

  // 如果使用 Google 认证或在 Cloud Shell 中，目前不需要验证其他内容
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE || // Google OAuth 登录
    authType === AuthType.CLOUD_SHELL // Cloud Shell 环境
  ) {
    return contentGeneratorConfig; // 直接返回基础配置
  }

  // 处理 Gemini API 密钥认证
  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey; // 设置 Gemini API 密钥
    contentGeneratorConfig.vertexai = false; // 不使用 Vertex AI

    return contentGeneratorConfig; // 返回 Gemini 配置
  }

  // 处理混元 API 密钥认证（新增功能）
  if (authType === AuthType.USE_HUNYUAN && hunyuanApiKey) {
    contentGeneratorConfig.apiKey = hunyuanApiKey; // 设置混元 API 密钥
    contentGeneratorConfig.vertexai = false; // 不使用 Vertex AI

    return contentGeneratorConfig; // 返回混元配置
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;

    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env['CLI_VERSION'] || process.version;
  const userAgent = `GeminiCLI/${version} (${process.platform}; ${process.arch})`;
  const baseHeaders: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    const httpOptions = { headers: baseHeaders };
    return new LoggingContentGenerator(
      await createCodeAssistContentGenerator(
        httpOptions,
        config.authType,
        gcConfig,
        sessionId,
      ),
      gcConfig,
    );
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    let headers: Record<string, string> = { ...baseHeaders };
    if (gcConfig?.getUsageStatisticsEnabled()) {
      const installationManager = new InstallationManager();
      const installationId = installationManager.getInstallationId();
      headers = {
        ...headers,
        'x-gemini-api-privileged-user-id': `${installationId}`,
      };
    }
    const httpOptions = { headers };

    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });
    return new LoggingContentGenerator(googleGenAI.models, gcConfig);
  }
  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
