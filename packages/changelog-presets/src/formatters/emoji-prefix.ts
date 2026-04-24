import { ILineFormatter, ChangeLogEntry, PluginContext } from '@release-toolkit/core';
import { COMMIT_TYPE_EMOJI } from '@release-toolkit/core';

export const emojiPrefixPlugin: ILineFormatter = {
  name: 'emoji-prefix',
  priority: 10,

  init(context?: PluginContext): void {
    // Can accept custom prefix map from context.options
  },

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
