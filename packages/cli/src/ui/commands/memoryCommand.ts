/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  getErrorMessage,
  loadServerHierarchicalMemory,
} from '@google/gemini-cli-core';
import { MessageType } from '../types.js';
import type { SlashCommand, SlashCommandActionReturn } from './types.js';
import { CommandKind } from './types.js';

export const memoryCommand: SlashCommand = {
  name: 'memory',
  description: 'Commands for interacting with memory.',
  kind: CommandKind.BUILT_IN,
  subCommands: [
    {
      name: 'show',
      description: 'Show the current memory contents.',
      kind: CommandKind.BUILT_IN,
      action: async (context) => {
        const memoryContent = context.services.config?.getUserMemory() || '';
        const fileCount = context.services.config?.getGeminiMdFileCount() || 0;

        const messageContent =
          memoryContent.length > 0
            ? `Current memory content from ${fileCount} file(s):\n\n---\n${memoryContent}\n---`
            : 'Memory is currently empty.';

        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: messageContent,
          },
          Date.now(),
        );
      },
    },
    {
      name: 'add',
      description: 'Add content to the memory.',
      kind: CommandKind.BUILT_IN,
      action: (context, args): SlashCommandActionReturn | void => {
        if (!args || args.trim() === '') {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /memory add <text to remember>',
          };
        }

        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: `Attempting to save to memory: "${args.trim()}"`,
          },
          Date.now(),
        );

        return {
          type: 'tool',
          toolName: 'save_memory',
          toolArgs: { fact: args.trim() },
        };
      },
    },
    {
      name: 'refresh',
      description: 'Refresh the memory from the source.',
      kind: CommandKind.BUILT_IN,
      action: async (context) => {
        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: 'Refreshing memory from source files...',
          },
          Date.now(),
        );

        try {
          const config = await context.services.config;
          if (config) {
            const { memoryContent, fileCount, filePaths } =
              await loadServerHierarchicalMemory(
                config.getWorkingDir(),
                config.shouldLoadMemoryFromIncludeDirectories()
                  ? config.getWorkspaceContext().getDirectories()
                  : [],
                config.getDebugMode(),
                config.getFileService(),
                config.getExtensionContextFilePaths(),
                config.getFolderTrust(),
                context.services.settings.merged.context?.importFormat ||
                  'tree', // Use setting or default to 'tree'
                config.getFileFilteringOptions(),
                context.services.settings.merged.context?.discoveryMaxDirs,
              );
            config.setUserMemory(memoryContent);
            config.setGeminiMdFileCount(fileCount);
            config.setGeminiMdFilePaths(filePaths);

            const successMessage =
              memoryContent.length > 0
                ? `Memory refreshed successfully. Loaded ${memoryContent.length} characters from ${fileCount} file(s).`
                : 'Memory refreshed successfully. No memory content found.';

            context.ui.addItem(
              {
                type: MessageType.INFO,
                text: successMessage,
              },
              Date.now(),
            );
          }
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Error refreshing memory: ${errorMessage}`,
            },
            Date.now(),
          );
        }
      },
    },
    {
      name: 'list',
      description: 'Lists the paths of the GEMINI.md files in use.',
      kind: CommandKind.BUILT_IN,
      action: async (context) => {
        const filePaths = context.services.config?.getGeminiMdFilePaths() || [];
        const fileCount = filePaths.length;

        const messageContent =
          fileCount > 0
            ? `There are ${fileCount} GEMINI.md file(s) in use:\n\n${filePaths.join('\n')}`
            : 'No GEMINI.md files in use.';

        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: messageContent,
          },
          Date.now(),
        );
      },
    },
    {
      name: 'search',
      description: 'Search for specific content in memory.',
      kind: CommandKind.BUILT_IN,
      action: async (
        context,
        args,
      ): Promise<SlashCommandActionReturn | void> => {
        if (!args || args.trim() === '') {
          return {
            type: 'message',
            messageType: 'error',
            content: 'Usage: /memory search <search term>',
          };
        }

        const memoryContent = context.services.config?.getUserMemory() || '';
        const searchTerm = args.trim().toLowerCase();

        if (memoryContent.length === 0) {
          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: 'Memory is currently empty. Nothing to search.',
            },
            Date.now(),
          );
          return;
        }

        const lines = memoryContent.split('\n');
        const matchingLines: string[] = [];
        let lineNumber = 1;

        for (const line of lines) {
          if (line.toLowerCase().includes(searchTerm)) {
            matchingLines.push(`Line ${lineNumber}: ${line.trim()}`);
          }
          lineNumber++;
        }

        const messageContent =
          matchingLines.length > 0
            ? `Found ${matchingLines.length} match(es) for "${args.trim()}":\n\n${matchingLines.join('\n')}`
            : `No matches found for "${args.trim()}" in memory.`;

        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: messageContent,
          },
          Date.now(),
        );
      },
    },
    {
      name: 'clear',
      description: 'Clear all memory content (requires confirmation).',
      kind: CommandKind.BUILT_IN,
      action: (context, args): SlashCommandActionReturn | void => {
        if (args && args.trim() === '--force') {
          return {
            type: 'tool',
            toolName: 'clear_memory',
            toolArgs: { force: true },
          };
        }

        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: 'This will permanently delete all memory content. Use "/memory clear --force" to confirm.',
          },
          Date.now(),
        );
      },
    },
    {
      name: 'stats',
      description: 'Show memory usage statistics.',
      kind: CommandKind.BUILT_IN,
      action: async (context) => {
        const memoryContent = context.services.config?.getUserMemory() || '';
        const fileCount = context.services.config?.getGeminiMdFileCount() || 0;
        const filePaths = context.services.config?.getGeminiMdFilePaths() || [];

        if (memoryContent.length === 0) {
          context.ui.addItem(
            {
              type: MessageType.INFO,
              text: 'Memory is currently empty.',
            },
            Date.now(),
          );
          return;
        }

        const lines = memoryContent.split('\n');
        const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
        const memoryItems = nonEmptyLines.filter((line) =>
          line.trim().startsWith('- '),
        );
        const wordCount = memoryContent
          .split(/\s+/)
          .filter((word) => word.length > 0).length;

        const stats = [
          `Memory Statistics:`,
          `├─ Total characters: ${memoryContent.length}`,
          `├─ Total lines: ${lines.length}`,
          `├─ Non-empty lines: ${nonEmptyLines.length}`,
          `├─ Memory items: ${memoryItems.length}`,
          `├─ Word count: ${wordCount}`,
          `├─ Files in use: ${fileCount}`,
          `└─ File paths: ${filePaths.length > 0 ? '\n   ' + filePaths.join('\n   ') : 'None'}`,
        ].join('\n');

        context.ui.addItem(
          {
            type: MessageType.INFO,
            text: stats,
          },
          Date.now(),
        );
      },
    },
    {
      name: 'export',
      description: 'Export memory content to a file.',
      kind: CommandKind.BUILT_IN,
      action: (context, args): SlashCommandActionReturn | void => {
        const fileName = args?.trim() || 'memory-export.md';

        return {
          type: 'tool',
          toolName: 'export_memory',
          toolArgs: { fileName },
        };
      },
    },
  ],
};
