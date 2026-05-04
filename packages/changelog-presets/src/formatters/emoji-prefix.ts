import { COMMIT_TYPE_EMOJI } from '../constants.js'

/**
 * Emoji prefix formatter
 * Adds emoji prefix to commit lines based on commit type
 */
export const emojiPrefix = {
  name: 'emoji-prefix',
  formatLine: (line: string) => {
    const match = line.match(/^(\w+)(?:\([^)]+\))?:/)
    if (match) {
      const emoji = COMMIT_TYPE_EMOJI[match[1] as keyof typeof COMMIT_TYPE_EMOJI]
      if (emoji) return `${emoji} ${line}`
    }
    return line
  },
}
