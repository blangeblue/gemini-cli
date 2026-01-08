/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ContentGenerator } from './contentGenerator.js';
import {
  createContentGenerator,
  AuthType,
  createContentGeneratorConfig,
} from './contentGenerator.js';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import { GoogleGenAI } from '@google/genai';
import type { Config } from '../config/config.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';

vi.mock('../code_assist/codeAssist.js');
vi.mock('@google/genai');

const mockConfig = {} as unknown as Config;

describe('createContentGenerator', () => {
  it('should create a CodeAssistContentGenerator', async () => {
    const mockGenerator = {} as unknown as ContentGenerator;
    vi.mocked(createCodeAssistContentGenerator).mockResolvedValue(
      mockGenerator as never,
    );
    const generator = await createContentGenerator(
      {
        authType: AuthType.LOGIN_WITH_GOOGLE,
      },
      mockConfig,
    );
    expect(createCodeAssistContentGenerator).toHaveBeenCalled();
    expect(generator).toEqual(
      new LoggingContentGenerator(mockGenerator, mockConfig),
    );
  });

  it('should create a GoogleGenAI content generator', async () => {
    const mockConfig = {
      getUsageStatisticsEnabled: () => true,
    } as unknown as Config;

    const mockGenerator = {
      models: {},
    } as unknown as GoogleGenAI;
    vi.mocked(GoogleGenAI).mockImplementation(() => mockGenerator as never);
    const generator = await createContentGenerator(
      {
        apiKey: 'test-api-key',
        authType: AuthType.USE_GEMINI,
      },
      mockConfig,
    );
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      vertexai: undefined,
      httpOptions: {
        headers: {
          'User-Agent': expect.any(String),
          'x-gemini-api-privileged-user-id': expect.any(String),
        },
      },
    });
    expect(generator).toEqual(
      new LoggingContentGenerator(
        (mockGenerator as GoogleGenAI).models,
        mockConfig,
      ),
    );
  });

  it('should create a GoogleGenAI content generator with client install id logging disabled', async () => {
    const mockConfig = {
      getUsageStatisticsEnabled: () => false,
    } as unknown as Config;
    const mockGenerator = {
      models: {},
    } as unknown as GoogleGenAI;
    vi.mocked(GoogleGenAI).mockImplementation(() => mockGenerator as never);
    const generator = await createContentGenerator(
      {
        apiKey: 'test-api-key',
        authType: AuthType.USE_GEMINI,
      },
      mockConfig,
    );
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      vertexai: undefined,
      httpOptions: {
        headers: {
          'User-Agent': expect.any(String),
        },
      },
    });
    expect(generator).toEqual(
      new LoggingContentGenerator(
        (mockGenerator as GoogleGenAI).models,
        mockConfig,
      ),
    );
  });

  it('should create a GoogleGenAI content generator with custom baseUrl', async () => {
    const mockConfig = {
      getUsageStatisticsEnabled: () => false,
    } as unknown as Config;
    const mockGenerator = {
      models: {},
    } as unknown as GoogleGenAI;
    vi.mocked(GoogleGenAI).mockImplementation(() => mockGenerator as never);
    const generator = await createContentGenerator(
      {
        apiKey: 'test-api-key',
        authType: AuthType.USE_GEMINI,
        apiBaseUrl: 'https://api.deepseek.com',
      },
      mockConfig,
    );
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'test-api-key',
      vertexai: undefined,
      httpOptions: {
        headers: {
          'User-Agent': expect.any(String),
        },
        baseUrl: 'https://api.deepseek.com',
      },
    });
    expect(generator).toEqual(
      new LoggingContentGenerator(
        (mockGenerator as GoogleGenAI).models,
        mockConfig,
      ),
    );
  });
});

describe('createContentGeneratorConfig', () => {
  const mockConfig = {
    getModel: vi.fn().mockReturnValue('gemini-pro'),
    setModel: vi.fn(),
    flashFallbackHandler: vi.fn(),
    getProxy: vi.fn(),
  } as unknown as Config;

  beforeEach(() => {
    // Reset modules to re-evaluate imports and environment variables
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should configure for Gemini using GEMINI_API_KEY when set', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'env-gemini-key');
    const config = await createContentGeneratorConfig(
      mockConfig,
      AuthType.USE_GEMINI,
    );
    expect(config.apiKey).toBe('env-gemini-key');
    expect(config.vertexai).toBe(false);
  });

  it('should not configure for Gemini if GEMINI_API_KEY is empty', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const config = await createContentGeneratorConfig(
      mockConfig,
      AuthType.USE_GEMINI,
    );
    expect(config.apiKey).toBeUndefined();
    expect(config.vertexai).toBeUndefined();
  });

  it('should configure for Vertex AI using GOOGLE_API_KEY when set', async () => {
    vi.stubEnv('GOOGLE_API_KEY', 'env-google-key');
    const config = await createContentGeneratorConfig(
      mockConfig,
      AuthType.USE_VERTEX_AI,
    );
    expect(config.apiKey).toBe('env-google-key');
    expect(config.vertexai).toBe(true);
  });

  it('should configure for Vertex AI using GCP project and location when set', async () => {
    vi.stubEnv('GOOGLE_API_KEY', undefined);
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', 'env-gcp-project');
    vi.stubEnv('GOOGLE_CLOUD_LOCATION', 'env-gcp-location');
    const config = await createContentGeneratorConfig(
      mockConfig,
      AuthType.USE_VERTEX_AI,
    );
    expect(config.vertexai).toBe(true);
    expect(config.apiKey).toBeUndefined();
  });

  it('should not configure for Vertex AI if required env vars are empty', async () => {
    vi.stubEnv('GOOGLE_API_KEY', '');
    vi.stubEnv('GOOGLE_CLOUD_PROJECT', '');
    vi.stubEnv('GOOGLE_CLOUD_LOCATION', '');
    const config = await createContentGeneratorConfig(
      mockConfig,
      AuthType.USE_VERTEX_AI,
    );
    expect(config.apiKey).toBeUndefined();
    expect(config.vertexai).toBeUndefined();
  });

  it('should configure for DeepSeek when DEEPSEEK_API_KEY and DEEPSEEK_BASE_URL are set', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-test-key');
    vi.stubEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com');
    const config = await createContentGeneratorConfig(mockConfig, undefined);
    expect(config.apiKey).toBe('deepseek-test-key');
    expect(config.apiBaseUrl).toBe('https://api.deepseek.com');
    expect(config.vertexai).toBe(false);
  });

  it('should configure custom base URL when GEMINI_API_BASE_URL is set', async () => {
    vi.stubEnv('GEMINI_API_BASE_URL', 'https://custom-api.example.com');
    const config = await createContentGeneratorConfig(mockConfig, undefined);
    expect(config.apiBaseUrl).toBe('https://custom-api.example.com');
  });

  it('should prefer GEMINI_API_BASE_URL over DEEPSEEK_BASE_URL', async () => {
    vi.stubEnv('GEMINI_API_BASE_URL', 'https://custom-api.example.com');
    vi.stubEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com');
    const config = await createContentGeneratorConfig(mockConfig, undefined);
    expect(config.apiBaseUrl).toBe('https://custom-api.example.com');
  });
});
