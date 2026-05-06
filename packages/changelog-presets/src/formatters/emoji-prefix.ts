import type { ILineFormatter } from '@release-toolkit/core';
import { COMMIT_TYPE_EMOJI } from '../constants.js';

/**
 * Emoji prefix formatter
 * Adds emoji prefix to commit lines based on commit type
 */
export const emojiPrefix: ILineFormatter = {
  name: 'emoji-prefix',
  formatLine: (line: string) => {
    // Match conventional commit format: type(scope): message
    const match = line.match(/^(\w+)(?:\([^)]+\))?:/);
    if (match) {
      const type = match[1];
      const emoji = COMMIT_TYPE_EMOJI[type];
      if (emoji) {
        return `${emoji} ${line}`;
      }
    }
    return line;
  },
};
