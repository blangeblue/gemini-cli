/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolEditConfirmationDetails, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { FunctionDeclaration } from '@google/genai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Storage } from '../config/storage.js';
import { tildeifyPath } from '../utils/paths.js';
import { ToolErrorType } from './tool-error.js';

const sessionHistoryToolSchemaData: FunctionDeclaration = {
  name: 'save_session_history',
  description:
    'Saves important conversation context or session history to long-term memory for future reference. Use this to preserve valuable conversations, insights, or context that should be remembered across different sessions.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      sessionSummary: {
        type: 'string',
        description:
          'A concise summary of the important conversation or session context to save. Should capture key insights, decisions, or context that would be valuable in future sessions.',
      },
      category: {
        type: 'string',
        description:
          'Optional category to organize the session history (e.g., "development", "configuration", "learning", "debugging")',
        default: 'general',
      },
      timestamp: {
        type: 'string',
        description:
          'Optional timestamp for the session. If not provided, current timestamp will be used.',
      },
    },
    required: ['sessionSummary'],
  },
};

const sessionHistoryToolDescription = `
Saves important conversation context or session history to long-term memory.

Use this tool:

- When a conversation contains valuable insights, solutions, or context that should be preserved for future sessions.
- To save summaries of important work sessions, debugging sessions, or learning conversations.
- When the user explicitly asks to save or remember the current conversation or session.
- To preserve context about ongoing projects, decisions made, or approaches taken.

Do NOT use this tool:

- For trivial or temporary conversations that don't contain lasting value.
- To save entire conversation transcripts (save summaries instead).
- For information that's already covered by the regular save_memory tool.

## Parameters

- \`sessionSummary\` (string, required): A concise summary of the conversation or session context to save.
- \`category\` (string, optional): Category to organize the history (default: "general").
- \`timestamp\` (string, optional): Timestamp for the session (defaults to current time).
`;

export const SESSION_HISTORY_FILENAME = 'session-history.md';

interface SaveSessionHistoryParams {
  sessionSummary: string;
  category?: string;
  timestamp?: string;
  modified_by_user?: boolean;
  modified_content?: string;
}

interface SessionHistoryEntry {
  timestamp: string;
  category: string;
  summary: string;
}

function getSessionHistoryFilePath(): string {
  return path.join(Storage.getGlobalGeminiDir(), SESSION_HISTORY_FILENAME);
}

/**
 * Reads the current session history file content
 */
async function readSessionHistoryContent(): Promise<string> {
  try {
    return await fs.readFile(getSessionHistoryFilePath(), 'utf-8');
  } catch (err) {
    const error = err as Error & { code?: string };
    if (!(error instanceof Error) || error.code !== 'ENOENT') throw err;
    return '';
  }
}

/**
 * Parses session history entries from the content
 */
function parseSessionHistory(content: string): SessionHistoryEntry[] {
  const entries: SessionHistoryEntry[] = [];
  const lines = content.split('\n');

  let currentEntry: Partial<SessionHistoryEntry> | null = null;
  let summaryLines: string[] = [];

  for (const line of lines) {
    const timestampMatch = line.match(/^## (.+?) \[(.+?)\]$/);
    if (timestampMatch) {
      // Save previous entry if exists
      if (currentEntry && summaryLines.length > 0) {
        entries.push({
          ...currentEntry,
          summary: summaryLines.join('\n').trim(),
        } as SessionHistoryEntry);
      }

      // Start new entry
      currentEntry = {
        timestamp: timestampMatch[1],
        category: timestampMatch[2],
      };
      summaryLines = [];
    } else if (currentEntry && line.trim()) {
      summaryLines.push(line);
    }
  }

  // Save last entry
  if (currentEntry && summaryLines.length > 0) {
    entries.push({
      ...currentEntry,
      summary: summaryLines.join('\n').trim(),
    } as SessionHistoryEntry);
  }

  return entries;
}

/**
 * Formats session history entries back to content
 */
function formatSessionHistory(entries: SessionHistoryEntry[]): string {
  if (entries.length === 0) {
    return '# Session History\n\nNo session history saved yet.\n';
  }

  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  let content = '# Session History\n\n';
  content +=
    'This file contains summaries of important conversations and session context for long-term memory.\n\n';

  for (const entry of sortedEntries) {
    content += `## ${entry.timestamp} [${entry.category}]\n\n`;
    content += `${entry.summary}\n\n`;
  }

  return content;
}

/**
 * Adds a new session history entry
 */
function addSessionHistoryEntry(
  currentContent: string,
  sessionSummary: string,
  category: string = 'general',
  timestamp?: string,
): string {
  const entries = parseSessionHistory(currentContent);

  const newEntry: SessionHistoryEntry = {
    timestamp: timestamp || new Date().toISOString(),
    category,
    summary: sessionSummary,
  };

  entries.push(newEntry);

  return formatSessionHistory(entries);
}

class SessionHistoryToolInvocation extends BaseToolInvocation<
  SaveSessionHistoryParams,
  ToolResult
> {
  private static readonly allowlist: Set<string> = new Set();

  getDescription(): string {
    const historyFilePath = getSessionHistoryFilePath();
    return `in ${tildeifyPath(historyFilePath)}`;
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<ToolEditConfirmationDetails | false> {
    const historyFilePath = getSessionHistoryFilePath();
    const allowlistKey = historyFilePath;

    if (SessionHistoryToolInvocation.allowlist.has(allowlistKey)) {
      return false;
    }

    return false; // Auto-approve session history saves for now
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const {
      sessionSummary,
      category,
      timestamp,
      modified_by_user,
      modified_content,
    } = this.params;

    try {
      if (modified_by_user && modified_content !== undefined) {
        // User modified the content in external editor, write it directly
        await fs.mkdir(path.dirname(getSessionHistoryFilePath()), {
          recursive: true,
        });
        await fs.writeFile(
          getSessionHistoryFilePath(),
          modified_content,
          'utf-8',
        );
        const successMessage = `Session history updated with your modifications.`;
        return {
          llmContent: JSON.stringify({
            success: true,
            message: successMessage,
          }),
          returnDisplay: successMessage,
        };
      } else {
        // Use the normal session history logic
        await SessionHistoryTool.performAddSessionHistoryEntry(
          sessionSummary,
          category || 'general',
          timestamp,
          getSessionHistoryFilePath(),
          {
            readFile: fs.readFile,
            writeFile: fs.writeFile,
            mkdir: fs.mkdir,
          },
        );
        const successMessage = `Session context saved to long-term memory: "${sessionSummary.substring(0, 100)}${sessionSummary.length > 100 ? '...' : ''}"`;
        return {
          llmContent: JSON.stringify({
            success: true,
            message: successMessage,
          }),
          returnDisplay: successMessage,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[SessionHistoryTool] Error executing save_session_history for summary "${sessionSummary}": ${errorMessage}`,
      );
      return {
        llmContent: JSON.stringify({
          success: false,
          error: `Failed to save session history. Detail: ${errorMessage}`,
        }),
        returnDisplay: `Error saving session history: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.MEMORY_TOOL_EXECUTION_ERROR,
        },
      };
    }
  }
}

export class SessionHistoryTool extends BaseDeclarativeTool<
  SaveSessionHistoryParams,
  ToolResult
> {
  static readonly Name: string = sessionHistoryToolSchemaData.name!;

  constructor() {
    super(
      SessionHistoryTool.Name,
      'Save Session History',
      sessionHistoryToolDescription,
      Kind.Think,
      sessionHistoryToolSchemaData.parametersJsonSchema as Record<
        string,
        unknown
      >,
    );
  }

  protected override validateToolParamValues(
    params: SaveSessionHistoryParams,
  ): string | null {
    if (params.sessionSummary.trim() === '') {
      return 'Parameter "sessionSummary" must be a non-empty string.';
    }

    return null;
  }

  protected createInvocation(params: SaveSessionHistoryParams) {
    return new SessionHistoryToolInvocation(params);
  }

  static async performAddSessionHistoryEntry(
    sessionSummary: string,
    category: string = 'general',
    timestamp?: string,
    historyFilePath?: string,
    fsAdapter?: {
      readFile: (path: string, encoding: 'utf-8') => Promise<string>;
      writeFile: (
        path: string,
        data: string,
        encoding: 'utf-8',
      ) => Promise<void>;
      mkdir: (
        path: string,
        options: { recursive: boolean },
      ) => Promise<string | undefined>;
    },
  ): Promise<void> {
    const filePath = historyFilePath || getSessionHistoryFilePath();
    const fsAdapter_typed = fsAdapter || {
      readFile: fs.readFile,
      writeFile: fs.writeFile,
      mkdir: fs.mkdir,
    };

    try {
      await fsAdapter_typed.mkdir(path.dirname(filePath), { recursive: true });

      let currentContent = '';
      try {
        currentContent = await fsAdapter_typed.readFile(filePath, 'utf-8');
      } catch (_e) {
        // File doesn't exist, which is fine. currentContent will be empty.
      }

      const newContent = addSessionHistoryEntry(
        currentContent,
        sessionSummary,
        category,
        timestamp,
      );

      await fsAdapter_typed.writeFile(filePath, newContent, 'utf-8');
    } catch (error) {
      console.error(
        `[SessionHistoryTool] Error adding session history entry to ${filePath}:`,
        error,
      );
      throw new Error(
        `[SessionHistoryTool] Failed to add session history entry: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Retrieves session history entries, optionally filtered by category
   */
  static async getSessionHistory(
    category?: string,
    limit?: number,
  ): Promise<SessionHistoryEntry[]> {
    try {
      const content = await readSessionHistoryContent();
      let entries = parseSessionHistory(content);

      if (category) {
        entries = entries.filter((entry) => entry.category === category);
      }

      if (limit) {
        entries = entries.slice(0, limit);
      }

      return entries;
    } catch (error) {
      console.error(
        `[SessionHistoryTool] Error retrieving session history:`,
        error,
      );
      return [];
    }
  }

  /**
   * Gets available categories from session history
   */
  static async getCategories(): Promise<string[]> {
    try {
      const content = await readSessionHistoryContent();
      const entries = parseSessionHistory(content);
      const categories = new Set(entries.map((entry) => entry.category));
      return Array.from(categories).sort();
    } catch (error) {
      console.error(`[SessionHistoryTool] Error retrieving categories:`, error);
      return [];
    }
  }
}
