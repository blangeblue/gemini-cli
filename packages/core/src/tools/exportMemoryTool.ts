/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { FunctionDeclaration } from '@google/genai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Storage } from '../config/storage.js';
import { tildeifyPath } from '../utils/paths.js';
import { getCurrentGeminiMdFilename } from './memoryTool.js';
import { ToolErrorType } from './tool-error.js';

const exportMemoryToolSchemaData: FunctionDeclaration = {
  name: 'export_memory',
  description:
    'Exports memory content to a specified file. This creates a backup of all current memory content.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      fileName: {
        type: 'string',
        description:
          'The name of the file to export memory to. Defaults to "memory-export.md".',
        default: 'memory-export.md',
      },
      includeMetadata: {
        type: 'boolean',
        description:
          'Whether to include metadata about the export in the file.',
        default: true,
      },
    },
    required: ['fileName'],
  },
};

interface ExportMemoryParams {
  fileName: string;
  includeMetadata?: boolean;
}

function getGlobalMemoryFilePath(): string {
  return path.join(Storage.getGlobalGeminiDir(), getCurrentGeminiMdFilename());
}

class ExportMemoryToolInvocation extends BaseToolInvocation<
  ExportMemoryParams,
  ToolResult
> {
  getDescription(): string {
    return `Export memory to ${this.params.fileName}`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const memoryFilePath = getGlobalMemoryFilePath();
      const exportFileName = this.params.fileName;
      const includeMetadata = this.params.includeMetadata ?? true;

      // Resolve the export file path (current working directory)
      const exportFilePath = path.resolve(process.cwd(), exportFileName);

      try {
        const memoryContent = await fs.readFile(memoryFilePath, 'utf-8');

        if (memoryContent.trim().length === 0) {
          const message = 'Memory is empty. Nothing to export.';
          return {
            llmContent: JSON.stringify({
              success: false,
              message,
            }),
            returnDisplay: message,
          };
        }

        let exportContent = '';

        if (includeMetadata) {
          const timestamp = new Date().toISOString();
          const sourceFile = tildeifyPath(memoryFilePath);

          exportContent = [
            '# Memory Export',
            '',
            `**Exported on:** ${timestamp}`,
            `**Source:** ${sourceFile}`,
            `**Size:** ${memoryContent.length} characters`,
            '',
            '---',
            '',
            memoryContent,
          ].join('\n');
        } else {
          exportContent = memoryContent;
        }

        await fs.writeFile(exportFilePath, exportContent, 'utf-8');

        const successMessage = `Memory exported successfully to ${tildeifyPath(exportFilePath)}`;
        return {
          llmContent: JSON.stringify({
            success: true,
            message: successMessage,
            exportPath: exportFilePath,
            size: exportContent.length,
          }),
          returnDisplay: successMessage,
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          const message = 'Memory file does not exist. Nothing to export.';
          return {
            llmContent: JSON.stringify({
              success: false,
              message,
            }),
            returnDisplay: message,
          };
        }
        throw error;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[ExportMemoryTool] Error exporting memory: ${errorMessage}`,
      );
      return {
        llmContent: JSON.stringify({
          success: false,
          error: `Failed to export memory. Detail: ${errorMessage}`,
        }),
        returnDisplay: `Error exporting memory: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.MEMORY_TOOL_EXECUTION_ERROR,
        },
      };
    }
  }
}

export class ExportMemoryTool extends BaseDeclarativeTool<
  ExportMemoryParams,
  ToolResult
> {
  static readonly Name: string = exportMemoryToolSchemaData.name!;

  constructor() {
    super(
      ExportMemoryTool.Name,
      'Export Memory',
      'Exports memory content to a specified file for backup purposes.',
      Kind.Think,
      exportMemoryToolSchemaData.parametersJsonSchema as Record<
        string,
        unknown
      >,
    );
  }

  protected override validateToolParamValues(
    params: ExportMemoryParams,
  ): string | null {
    if (!params.fileName || params.fileName.trim() === '') {
      return 'Parameter "fileName" must be a non-empty string.';
    }

    return null;
  }

  protected createInvocation(params: ExportMemoryParams) {
    return new ExportMemoryToolInvocation(params);
  }
}
