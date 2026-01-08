/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import { theme } from '../semantic-colors.js';

interface KimiPrivacyNoticeProps {
  onExit: () => void;
}

export const KimiPrivacyNotice = ({
  onExit,
}: KimiPrivacyNoticeProps) => (
  <Box flexDirection="column" paddingX={1}>
    <Box marginBottom={1}>
      <Text bold color={theme.text.accent}>
        Kimi API Privacy Notice
      </Text>
    </Box>
    <Box marginBottom={1}>
      <Text color={theme.text.primary}>
        When using Kimi API, your data is handled by Moonshot AI according to
        their Terms of Service and Privacy Policy.
      </Text>
    </Box>
    <Box marginBottom={1}>
      <Text color={theme.text.primary}>
        Please review Moonshot AI's privacy policy at:{' '}
        <Text color={theme.text.link}>https://platform.moonshot.cn/privacy</Text>
      </Text>
    </Box>
    <Box marginTop={1}>
      <Text color={theme.text.secondary}>
        Press any key to continue...
      </Text>
    </Box>
  </Box>
);
