import { ILineFormatter, ChangeLogEntry } from '@release-toolkit/core';
import { COMMIT_TYPE_EMOJI } from '@release-toolkit/core';

export const emojiPrefixPlugin: ILineFormatter = {
  name: 'emoji-prefix',
  priority: 10,
  __formatterType: 'line',

  format(entry: ChangeLogEntry): ChangeLogEntry | null {
    // Check if subject already starts with emoji (skip if already prefixed)
    if (/^\p{Emoji}/u.test(entry.subject)) {
      return entry;
    }

    const emoji = COMMIT_TYPE_EMOJI[entry.type] || '';

    return {
      ...entry,
      subject: emoji ? `${emoji} ${entry.subject}` : entry.subject,
    };
  },
};
