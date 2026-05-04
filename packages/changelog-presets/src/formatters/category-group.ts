import { COMMIT_TYPE_CATEGORY } from '../constants.js'

/**
 * Category group formatter
 * Groups changelog entries by commit type category
 */
export const categoryGroup = {
  name: 'category-group',
  format: (entries: Array<{ type: string; scope?: string; subject: string }>) => {
    const grouped = new Map<string, Array<{ type: string; scope?: string; subject: string }>>()

    for (const entry of entries) {
      const category = COMMIT_TYPE_CATEGORY[entry.type as keyof typeof COMMIT_TYPE_CATEGORY]
      const categoryName = category ? category.name : 'Other'
      if (!grouped.has(categoryName)) grouped.set(categoryName, [])
      grouped.get(categoryName)!.push(entry)
    }

    const lines: string[] = []
    for (const [category, items] of grouped) {
      const emoji = COMMIT_TYPE_CATEGORY[items[0]?.type as keyof typeof COMMIT_TYPE_CATEGORY]
      lines.push(`### ${emoji ? emoji.emoji + ' ' : ''}${category}`)
      lines.push('')
      for (const item of items) {
        const scope = item.scope ? `**${item.scope}**: ` : ''
        lines.push(`- ${scope}${item.subject}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  },
}
