/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ExportMemoryTool } from './exportMemoryTool.js';
import * as fs from 'node:fs/promises';
import { Storage } from '../config/storage.js';

vi.mock('node:fs/promises');
vi.mock('../config/storage.js');

const mockFs = vi.mocked(fs);
const mockStorage = vi.mocked(Storage);

describe('ExportMemoryTool', () => {
  let tool: ExportMemoryTool;
  const mockMemoryFilePath = '/mock/path/.gemini/GEMINI.md';

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ExportMemoryTool();

    mockStorage.getGlobalGeminiDir.mockReturnValue('/mock/path/.gemini');

    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue('/current/working/dir');
  });

  describe('execute', () => {
    it('should export memory content with metadata', async () => {
      const memoryContent = `## Gemini Added Memories
- Remember this fact
- Another memory item`;

      mockFs.readFile.mockResolvedValue(memoryContent);
      mockFs.writeFile.mockResolvedValue();

      const invocation = tool.build({
        fileName: 'backup.md',
        includeMetadata: true,
      });
      const result = await invocation.execute(new AbortController().signal);

      expect(mockFs.readFile).toHaveBeenCalledWith(mockMemoryFilePath, 'utf-8');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/current/working/dir/backup.md',
        expect.stringContaining('# Memory Export'),
        'utf-8',
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/current/working/dir/backup.md',
        expect.stringContaining(memoryContent),
        'utf-8',
      );
      expect(result.returnDisplay).toContain('Memory exported successfully');
    });

    it('should export memory content without metadata', async () => {
      const memoryContent = `## Gemini Added Memories
- Remember this fact`;

      mockFs.readFile.mockResolvedValue(memoryContent);
      mockFs.writeFile.mockResolvedValue();

      const invocation = tool.build({
        fileName: 'backup.md',
        includeMetadata: false,
      });
      await invocation.execute(new AbortController().signal);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/current/working/dir/backup.md',
        memoryContent,
        'utf-8',
      );
    });

    it('should handle empty memory content', async () => {
      mockFs.readFile.mockResolvedValue('');

      const invocation = tool.build({ fileName: 'backup.md' });
      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toBe('Memory is empty. Nothing to export.');
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle memory file not found', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(error);

      const invocation = tool.build({ fileName: 'backup.md' });
      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toBe(
        'Memory file does not exist. Nothing to export.',
      );
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle write errors', async () => {
      const memoryContent = '- Some memory content';
      mockFs.readFile.mockResolvedValue(memoryContent);
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const invocation = tool.build({ fileName: 'backup.md' });
      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toBe('Error exporting memory: Write failed');
      expect(result.error).toBeDefined();
    });

    it('should use default metadata setting when not specified', async () => {
      const memoryContent = '- Some memory';
      mockFs.readFile.mockResolvedValue(memoryContent);
      mockFs.writeFile.mockResolvedValue();

      const invocation = tool.build({ fileName: 'backup.md' });
      await invocation.execute(new AbortController().signal);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('# Memory Export'),
        'utf-8',
      );
    });

    it('should handle whitespace in memory content', async () => {
      const memoryContent = '   \n\n   ';
      mockFs.readFile.mockResolvedValue(memoryContent);

      const invocation = tool.build({ fileName: 'backup.md' });
      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toBe('Memory is empty. Nothing to export.');
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });
  });
});
