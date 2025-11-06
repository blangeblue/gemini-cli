/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionHistoryTool } from './sessionHistoryTool.js';

const mockFsAdapter = {
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
};

describe('SessionHistoryTool', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFsAdapter.mkdir.mockResolvedValue(undefined);
  });

  describe('performAddSessionHistoryEntry', () => {
    it('should create a new session history file when none exists', async () => {
      mockFsAdapter.readFile.mockRejectedValue({ code: 'ENOENT' });
      mockFsAdapter.writeFile.mockResolvedValue(undefined);

      await SessionHistoryTool.performAddSessionHistoryEntry(
        'Test session summary',
        'development',
        '2025-01-01T10:00:00.000Z',
        '/test/session-history.md',
        mockFsAdapter,
      );

      expect(mockFsAdapter.writeFile).toHaveBeenCalledWith(
        '/test/session-history.md',
        expect.stringContaining('# Session History'),
        'utf-8',
      );

      const writtenContent = mockFsAdapter.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('Test session summary');
      expect(writtenContent).toContain('[development]');
      expect(writtenContent).toContain('2025-01-01T10:00:00.000Z');
    });

    it('should append to existing session history file', async () => {
      const existingContent = `# Session History

This file contains summaries of important conversations and session context for long-term memory.

## 2025-01-01T09:00:00.000Z [general]

Previous session summary

`;

      mockFsAdapter.readFile.mockResolvedValue(existingContent);
      mockFsAdapter.writeFile.mockResolvedValue(undefined);

      await SessionHistoryTool.performAddSessionHistoryEntry(
        'New session summary',
        'debugging',
        '2025-01-01T10:00:00.000Z',
        '/test/session-history.md',
        mockFsAdapter,
      );

      const writtenContent = mockFsAdapter.writeFile.mock.calls[0][1];
      expect(writtenContent).toContain('New session summary');
      expect(writtenContent).toContain('[debugging]');
      expect(writtenContent).toContain('Previous session summary');
    });

    it('should sort entries by timestamp in descending order', async () => {
      const firstEntry = `# Session History

This file contains summaries of important conversations and session context for long-term memory.

## 2025-01-01T08:00:00.000Z [general]

First entry

`;

      mockFsAdapter.readFile.mockResolvedValueOnce(''); // First call returns empty
      mockFsAdapter.writeFile.mockResolvedValue(undefined);

      // Add first entry
      await SessionHistoryTool.performAddSessionHistoryEntry(
        'First entry',
        'general',
        '2025-01-01T08:00:00.000Z',
        '/test/session-history.md',
        mockFsAdapter,
      );

      // For second call, return the first entry content
      mockFsAdapter.readFile.mockResolvedValueOnce(firstEntry);

      // Add second entry (more recent)
      await SessionHistoryTool.performAddSessionHistoryEntry(
        'Second entry',
        'general',
        '2025-01-01T10:00:00.000Z',
        '/test/session-history.md',
        mockFsAdapter,
      );

      const lastWrittenContent = mockFsAdapter.writeFile.mock.calls[1][1];
      const firstEntryIndex = lastWrittenContent.indexOf('First entry');
      const secondEntryIndex = lastWrittenContent.indexOf('Second entry');

      // Second entry (more recent) should appear before first entry
      expect(secondEntryIndex).toBeLessThan(firstEntryIndex);
      expect(firstEntryIndex).toBeGreaterThan(-1);
      expect(secondEntryIndex).toBeGreaterThan(-1);
    });

    it('should handle errors gracefully', async () => {
      mockFsAdapter.readFile.mockResolvedValue('');
      mockFsAdapter.writeFile.mockRejectedValue(new Error('Write error'));

      await expect(
        SessionHistoryTool.performAddSessionHistoryEntry(
          'Test session',
          'general',
          undefined,
          '/test/session-history.md',
          mockFsAdapter,
        ),
      ).rejects.toThrow('Failed to add session history entry: Write error');
    });
  });

  describe('getSessionHistory', () => {
    it('should return empty array when no history file exists', async () => {
      const tool = new SessionHistoryTool();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(tool.constructor as any, 'getSessionHistory').mockResolvedValue(
        [],
      );

      const history = await SessionHistoryTool.getSessionHistory();
      expect(history).toEqual([]);
    });
  });

  describe('getCategories', () => {
    it('should return empty array when no history file exists', async () => {
      const tool = new SessionHistoryTool();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.spyOn(tool.constructor as any, 'getCategories').mockResolvedValue([]);

      const categories = await SessionHistoryTool.getCategories();
      expect(categories).toEqual([]);
    });
  });

  describe('tool validation', () => {
    const tool = new SessionHistoryTool();

    it('should validate required sessionSummary parameter', () => {
      const result = tool['validateToolParamValues']({
        sessionSummary: '',
      });
      expect(result).toBe(
        'Parameter "sessionSummary" must be a non-empty string.',
      );
    });

    it('should pass validation with valid parameters', () => {
      const result = tool['validateToolParamValues']({
        sessionSummary: 'Valid session summary',
        category: 'development',
      });
      expect(result).toBeNull();
    });
  });

  describe('tool schema', () => {
    const tool = new SessionHistoryTool();

    it('should have correct tool name', () => {
      expect(SessionHistoryTool.Name).toBe('save_session_history');
    });

    it('should have correct display name', () => {
      expect(tool['displayName']).toBe('Save Session History');
    });

    it('should have Think kind', () => {
      expect(tool['kind']).toBe('think');
    });
  });
});
