/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionHistoryTool } from './sessionHistoryTool.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// Integration test that uses real filesystem
describe('SessionHistoryTool Integration', () => {
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'session-history-test-'));
    testFilePath = path.join(tempDir, 'session-history.md');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create and manage session history file in real filesystem', async () => {
    // Add first entry
    await SessionHistoryTool.performAddSessionHistoryEntry(
      'First test session about implementing authentication',
      'development',
      '2025-01-16T10:00:00.000Z',
      testFilePath,
    );

    // Verify file exists and has correct content
    const content1 = await fs.readFile(testFilePath, 'utf-8');
    expect(content1).toContain('# Session History');
    expect(content1).toContain(
      'First test session about implementing authentication',
    );
    expect(content1).toContain('[development]');
    expect(content1).toContain('2025-01-16T10:00:00.000Z');

    // Add second entry
    await SessionHistoryTool.performAddSessionHistoryEntry(
      'Second test session about debugging memory leaks',
      'debugging',
      '2025-01-16T11:00:00.000Z',
      testFilePath,
    );

    // Verify both entries exist and are sorted correctly
    const content2 = await fs.readFile(testFilePath, 'utf-8');
    expect(content2).toContain(
      'First test session about implementing authentication',
    );
    expect(content2).toContain(
      'Second test session about debugging memory leaks',
    );
    expect(content2).toContain('[development]');
    expect(content2).toContain('[debugging]');

    // Check that the more recent entry appears first
    const firstEntryIndex = content2.indexOf('First test session');
    const secondEntryIndex = content2.indexOf('Second test session');
    expect(secondEntryIndex).toBeLessThan(firstEntryIndex);
  });

  it('should handle categories correctly', async () => {
    // Add entries with different categories
    await SessionHistoryTool.performAddSessionHistoryEntry(
      'Development session',
      'development',
      '2025-01-16T10:00:00.000Z',
      testFilePath,
    );

    await SessionHistoryTool.performAddSessionHistoryEntry(
      'Learning session',
      'learning',
      '2025-01-16T11:00:00.000Z',
      testFilePath,
    );

    await SessionHistoryTool.performAddSessionHistoryEntry(
      'Another development session',
      'development',
      '2025-01-16T12:00:00.000Z',
      testFilePath,
    );

    // Verify file structure
    const content = await fs.readFile(testFilePath, 'utf-8');

    // Should contain all categories
    expect(content).toContain('[development]');
    expect(content).toContain('[learning]');

    // Should have all entries
    expect(content).toContain('Development session');
    expect(content).toContain('Learning session');
    expect(content).toContain('Another development session');

    // Most recent should be first
    const positions = [
      content.indexOf('Another development session'),
      content.indexOf('Learning session'),
      content.indexOf('Development session'),
    ];

    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);
  });

  it('should use default timestamp when none provided', async () => {
    const beforeTime = new Date().toISOString();

    await SessionHistoryTool.performAddSessionHistoryEntry(
      'Test without timestamp',
      'testing',
      undefined, // No timestamp provided
      testFilePath,
    );

    const afterTime = new Date().toISOString();

    const content = await fs.readFile(testFilePath, 'utf-8');
    expect(content).toContain('Test without timestamp');
    expect(content).toContain('[testing]');

    // Extract the timestamp from the content
    const timestampMatch = content.match(/## ([^[]+) \[testing\]/);
    expect(timestampMatch).toBeTruthy();
    if (timestampMatch) {
      const timestamp = timestampMatch[1].trim();
      expect(timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(timestamp >= beforeTime).toBe(true);
      expect(timestamp <= afterTime).toBe(true);
    }
  });
});
