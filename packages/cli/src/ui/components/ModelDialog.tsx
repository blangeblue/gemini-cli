/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useCallback, useContext, useMemo } from 'react';
import { Box, Text } from 'ink';
import {
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODEL_AUTO,
  QWEN3_NEXT_80B_INSTRUCT,
  QWEN3_NEXT_80B_THINKING,
  ModelSlashCommandEvent,
  logModelSlashCommand,
} from '@google/gemini-cli-core';
import { useKeypress } from '../hooks/useKeypress.js';
import { theme } from '../semantic-colors.js';
import { DescriptiveRadioButtonSelect } from './shared/DescriptiveRadioButtonSelect.js';
import { ConfigContext } from '../contexts/ConfigContext.js';

interface ModelDialogProps {
  onClose: () => void;
}

const MODEL_OPTIONS = [
  {
    value: DEFAULT_GEMINI_MODEL_AUTO,
    title: 'Auto (recommended)',
    description: 'Let the system choose the best model for your task',
    key: DEFAULT_GEMINI_MODEL_AUTO,
  },
  {
    value: DEFAULT_GEMINI_MODEL,
    title: 'Gemini Pro',
    description: 'For complex tasks that require deep reasoning and creativity',
    key: DEFAULT_GEMINI_MODEL,
  },
  {
    value: DEFAULT_GEMINI_FLASH_MODEL,
    title: 'Gemini Flash',
    description: 'For tasks that need a balance of speed and reasoning',
    key: DEFAULT_GEMINI_FLASH_MODEL,
  },
  {
    value: DEFAULT_GEMINI_FLASH_LITE_MODEL,
    title: 'Gemini Flash-Lite',
    description: 'For simple tasks that need to be done quickly',
    key: DEFAULT_GEMINI_FLASH_LITE_MODEL,
  },
  {
    value: QWEN3_NEXT_80B_INSTRUCT,
    title: 'Qwen3-Next 80B Instruct',
    description: 'Alibaba Qwen model for instruction-following (Vertex AI)',
    key: QWEN3_NEXT_80B_INSTRUCT,
  },
  {
    value: QWEN3_NEXT_80B_THINKING,
    title: 'Qwen3-Next 80B Thinking',
    description: 'Alibaba Qwen model for deep reasoning tasks (Vertex AI)',
    key: QWEN3_NEXT_80B_THINKING,
  },
];

export function ModelDialog({ onClose }: ModelDialogProps): React.JSX.Element {
  const config = useContext(ConfigContext);

  // Determine the Preferred Model (read once when the dialog opens).
  const preferredModel = config?.getModel() || DEFAULT_GEMINI_MODEL_AUTO;

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onClose();
      }
    },
    { isActive: true },
  );

  // Calculate the initial index based on the preferred model.
  const initialIndex = useMemo(
    () => MODEL_OPTIONS.findIndex((option) => option.value === preferredModel),
    [preferredModel],
  );

  // Handle selection internally (Autonomous Dialog).
  const handleSelect = useCallback(
    (model: string) => {
      if (config) {
        config.setModel(model);
        const event = new ModelSlashCommandEvent(model);
        logModelSlashCommand(config, event);
      }
      onClose();
    },
    [config, onClose],
  );

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border.default}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Select Model</Text>
      <Box marginTop={1}>
        <DescriptiveRadioButtonSelect
          items={MODEL_OPTIONS}
          onSelect={handleSelect}
          initialIndex={initialIndex}
          showNumbers={true}
        />
      </Box>
      <Box flexDirection="column">
        <Text color={theme.text.secondary}>
          {'> To use any Gemini or Qwen model, use the --model flag.'}
        </Text>
        <Text color={theme.text.secondary}>
          {'> Qwen models require Vertex AI authentication.'}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text color={theme.text.secondary}>(Press Esc to close)</Text>
      </Box>
    </Box>
  );
}
