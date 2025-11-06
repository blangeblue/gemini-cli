/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// 导出默认的 Gemini 模型常量
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro'; // Gemini Pro 模型，用于复杂任务
export const DEFAULT_GEMINI_FLASH_MODEL = 'gemini-2.5-flash'; // Gemini Flash 模型，用于快速响应
export const DEFAULT_GEMINI_FLASH_LITE_MODEL = 'gemini-2.5-flash-lite'; // Gemini Flash Lite 模型，轻量版本

// 自动模型选择常量
export const DEFAULT_GEMINI_MODEL_AUTO = 'auto'; // 自动选择最合适的模型

// 嵌入模型常量
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'; // 用于文本嵌入的模型

// 混元模型常量 - 支持腾讯混元 AI 模型
export const DEFAULT_HUNYUAN_MODEL = 'hunyuan-pro'; // 混元 Pro 模型，用于复杂任务处理
export const DEFAULT_HUNYUAN_STANDARD_MODEL = 'hunyuan-standard'; // 混元标准模型，平衡性能和成本
export const DEFAULT_HUNYUAN_LITE_MODEL = 'hunyuan-lite'; // 混元轻量模型，快速且经济

// 思考模式相关常量
// 某些思考模型不默认使用动态思考，通过 -1 值来启用动态思考
export const DEFAULT_THINKING_MODE = -1;

/**
 * 确定要使用的有效模型，必要时应用回退逻辑。
 *
 * 当回退模式激活时，此函数强制使用标准的回退模型。
 * 但是，它对"lite"模型（名称中包含"lite"的任何模型）进行例外处理，
 * 允许使用它们以保持成本节约。这确保"pro"模型总是被降级，
 * 而"lite"模型请求会被honored。
 *
 * @param isInFallbackMode 应用程序是否处于回退模式
 * @param requestedModel 最初请求的模型
 * @returns 有效的模型名称
 */
export function getEffectiveModel(
  isInFallbackMode: boolean, // 是否处于回退模式的布尔标志
  requestedModel: string, // 用户请求的模型名称
): string {
  // 如果不在回退模式，直接使用请求的模型
  if (!isInFallbackMode) {
    return requestedModel; // 返回原始请求的模型
  }

  // 如果请求的是"lite"模型，优先使用它。这允许各种 lite 模型的变体
  // 而无需将它们全部列为常量
  if (requestedModel.includes('lite')) {
    return requestedModel; // 保持 lite 模型以节省成本
  }

  // 对于混元模型，回退到混元标准模型而不是 Gemini Flash
  // 这确保模型族内的一致性
  if (requestedModel.includes('hunyuan')) {
    return DEFAULT_HUNYUAN_STANDARD_MODEL; // 返回混元标准模型作为回退
  }

  // Gemini CLI 的默认回退选择
  return DEFAULT_GEMINI_FLASH_MODEL; // 返回 Gemini Flash 作为默认回退
}
