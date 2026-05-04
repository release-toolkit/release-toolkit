/**
 * Markdown bold formatter
 * Makes scope in conventional commits bold
 */
export const markdownBold = {
  name: 'markdown-bold',
  formatLine: (line: string) => {
    return line.replace(/^(\w+)\(([^)]+)\):/, '$1(**$2**):')
  },
}
