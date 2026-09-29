import type { Nodes } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'

/**
 * Markdown as the text a reader sees, for fields a crawler quotes verbatim.
 * Blocks are joined with a space - a bare concatenation would run the last word
 * of one paragraph into the first of the next.
 */
export function markdownToPlainText(markdown: string): string {
  return textOf(fromMarkdown(markdown)).replace(/\s+/g, ' ').trim()
}

function textOf(node: Nodes): string {
  // Raw HTML is dropped, as the page drops it when it renders.
  if (node.type === 'html') return ''
  if ('value' in node) return node.value
  if (node.type === 'image') return node.alt ?? ''
  if (!('children' in node)) return ' '
  const separator = node.type === 'paragraph' || node.type === 'heading' ? '' : ' '
  return node.children.map(textOf).join(separator)
}
