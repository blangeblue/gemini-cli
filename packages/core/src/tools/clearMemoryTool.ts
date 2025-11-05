/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolEditConfirmationDetails, ToolResult } from './tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  ToolConfirmationOutcome,
} from './tools.js';
import type { FunctionDeclaration } from '@google/genai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Storage } from '../config/storage.js';
import { tildeifyPath } from '../utils/paths.js';
import {
  getCurrentGeminiMdFilename,
  MEMORY_SECTION_HEADER,
} from './memoryTool.js';
import { ToolErrorType } from './tool-error.js';

const clearMemoryToolSchemaData: FunctionDeclaration = {
  name: 'clear_memory',
  description:
    'Clears all memory content from the GEMINI.md file. This is a destructive operation that removes all saved memories.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      force: {
        type: 'boolean',
        description: 'Force clear without confirmation.',
        default: false,
      },
    },
    required: [],
  },
};

interface ClearMemoryParams {
  force?: boolean;
}

function getGlobalMemoryFilePath(): string {
  return path.join(Storage.getGlobalGeminiDir(), getCurrentGeminiMdFilename());
}

/**
 * Removes the memory section from the content
 */
function clearMemorySection(currentContent: string): string {
  const headerIndex = currentContent.indexOf(MEMORY_SECTION_HEADER);

  if (headerIndex === -1) {
    // No memory section found, return original content
    return currentContent;
  }

  // Find the end of the memory section
  const startOfSectionContent = headerIndex + MEMORY_SECTION_HEADER.length;
  let endOfSectionIndex = currentContent.indexOf(
    '\n## ',
    startOfSectionContent,
  );

  if (endOfSectionIndex === -1) {
    // Memory section goes to end of file
    endOfSectionIndex = currentContent.length;
  }

  // Remove the memory section
  const beforeSection = currentContent.substring(0, headerIndex).trimEnd();
  const afterSection = currentContent.substring(endOfSectionIndex);

  // Join the parts, ensuring proper spacing
  if (beforeSection && afterSection) {
    return beforeSection + '\n\n' + afterSection.trimStart();
  } else if (beforeSection) {
    return beforeSection + '\n';
  } else {
    return afterSection.trimStart();
  }
}

class ClearMemoryToolInvocation extends BaseToolInvocation<
  ClearMemoryParams,
  ToolResult
> {
  private static readonly allowlist: Set<string> = new Set();

  getDescription(): string {
    const memoryFilePath = getGlobalMemoryFilePath();
    return `Clear all memory from ${tildeifyPath(memoryFilePath)}`;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolEditConfirmationDetails | false> {
    if (this.params.force) {
      return false;
    }

    const memoryFilePath = getGlobalMemoryFilePath();
    const allowlistKey = memoryFilePath;

    if (ClearMemoryToolInvocation.allowlist.has(allowlistKey)) {
      return false;
    }

    try {
      const currentContent = await fs.readFile(memoryFilePath, 'utf-8');
      const newContent = clearMemorySection(currentContent);

      const confirmationDetails: ToolEditConfirmationDetails = {
        type: 'edit',
        title: `⚠️  Clear All Memory: ${tildeifyPath(memoryFilePath)}`,
        fileName: memoryFilePath,
        filePath: memoryFilePath,
        fileDiff: `This will permanently delete all memory content from ${tildeifyPath(memoryFilePath)}.\n\nThis action cannot be undone.`,
        originalContent: currentContent,
        newContent,
        onConfirm: async (outcome: ToolConfirmationOutcome) => {
          if (outcome === ToolConfirmationOutcome.ProceedAlways) {
            ClearMemoryToolInvocation.allowlist.add(allowlistKey);
          }
        },
      };
      return confirmationDetails;
    } catch (error) {
      // If file doesn't exist, no need to confirm
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const memoryFilePath = getGlobalMemoryFilePath();

      try {
        const currentContent = await fs.readFile(memoryFilePath, 'utf-8');
        const newContent = clearMemorySection(currentContent);

        await fs.writeFile(memoryFilePath, newContent, 'utf-8');

        const successMessage =
          'All memory content has been cleared successfully.';
        return {
          llmContent: JSON.stringify({
            success: true,
            message: successMessage,
          }),
          returnDisplay: successMessage,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          const successMessage =
            'Memory file does not exist. Nothing to clear.';
          return {
            llmContent: JSON.stringify({
              success: true,
              message: successMessage,
            }),
            returnDisplay: successMessage,
          };
        }
        throw error;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[ClearMemoryTool] Error clearing memory: ${errorMessage}`);
      return {
        llmContent: JSON.stringify({
          success: false,
          error: `Failed to clear memory. Detail: ${errorMessage}`,
        }),
        returnDisplay: `Error clearing memory: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.MEMORY_TOOL_EXECUTION_ERROR,
        },
      };
    }
  }
}

export class ClearMemoryTool extends BaseDeclarativeTool<
  ClearMemoryParams,
  ToolResult
> {
  static readonly Name: string = clearMemoryToolSchemaData.name!;

  constructor() {
    super(
      ClearMemoryTool.Name,
      'Clear Memory',
      'Clears all memory content from the GEMINI.md file.',
      Kind.Think,
      clearMemoryToolSchemaData.parametersJsonSchema as Record<string, unknown>,
    );
  }

  protected createInvocation(params: ClearMemoryParams) {
    return new ClearMemoryToolInvocation(params);
  }
}
