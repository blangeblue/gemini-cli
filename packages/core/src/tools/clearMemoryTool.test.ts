/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ClearMemoryTool } from './clearMemoryTool.js';
import * as fs from 'node:fs/promises';
import { Storage } from '../config/storage.js';

vi.mock('node:fs/promises');
vi.mock('../config/storage.js');

const mockFs = vi.mocked(fs);
const mockStorage = vi.mocked(Storage);

describe('ClearMemoryTool', () => {
  let tool: ClearMemoryTool;
  const mockMemoryFilePath = '/mock/path/.gemini/GEMINI.md';

  beforeEach(() => {
    vi.clearAllMocks();
    tool = new ClearMemoryTool();

    mockStorage.getGlobalGeminiDir.mockReturnValue('/mock/path/.gemini');
  });

  describe('execute', () => {
    it('should clear memory section from file', async () => {
      const currentContent = `# Project Info

Some content here.

## Gemini Added Memories
- Remember this fact
- Another memory item

## Other Section
More content.`;

      const expectedContent = `# Project Info

Some content here.

## Other Section
More content.`;

      mockFs.readFile.mockResolvedValue(currentContent);
      mockFs.writeFile.mockResolvedValue();

      const invocation = tool.build({ force: true });
      const result = await invocation.execute(new AbortController().signal);

      expect(mockFs.readFile).toHaveBeenCalledWith(mockMemoryFilePath, 'utf-8');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        mockMemoryFilePath,
        expectedContent,
        'utf-8',
      );
      expect(result.returnDisplay).toBe(
        'All memory content has been cleared successfully.',
      );
    });

    it('should handle file not found error', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(error);

      const invocation = tool.build({ force: true });
      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toBe(
        'Memory file does not exist. Nothing to clear.',
      );
    });

    it('should handle file with no memory section', async () => {
      const currentContent = `# Project Info

Some content here.

## Other Section
More content.`;

      mockFs.readFile.mockResolvedValue(currentContent);
      mockFs.writeFile.mockResolvedValue();

      const invocation = tool.build({ force: true });
      await invocation.execute(new AbortController().signal);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        mockMemoryFilePath,
        currentContent,
        'utf-8',
      );
    });

    it('should handle memory section at end of file', async () => {
      const currentContent = `# Project Info

Some content here.

## Gemini Added Memories
- Remember this fact
- Another memory item`;

      const expectedContent = `# Project Info

Some content here.
`;

      mockFs.readFile.mockResolvedValue(currentContent);
      mockFs.writeFile.mockResolvedValue();

      const invocation = tool.build({ force: true });
      await invocation.execute(new AbortController().signal);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        mockMemoryFilePath,
        expectedContent,
        'utf-8',
      );
    });

    it('should handle write errors', async () => {
      const currentContent = `## Gemini Added Memories\n- Some memory`;
      mockFs.readFile.mockResolvedValue(currentContent);
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'));

      const invocation = tool.build({ force: true });
      const result = await invocation.execute(new AbortController().signal);

      expect(result.returnDisplay).toBe('Error clearing memory: Write failed');
      expect(result.error).toBeDefined();
    });
  });
});
