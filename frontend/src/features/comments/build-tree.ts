import type { CommentOut } from '@/lib/api/generated/model'

export type CommentNode = CommentOut & { replies: CommentNode[] }

/**
 * Nest the API's flat, oldest-first list into threads.
 *
 * `extra` is what only this reader can see - their own comments awaiting
 * review, or for staff the page's whole queue - merged in by id so a comment
 * that is in both lists appears once. A reply whose parent is not visible
 * stays at the top level rather than vanishing.
 */
export function buildTree(comments: CommentOut[], extra: CommentOut[] = []): CommentNode[] {
  const byId = new Map<number, CommentNode>()
  for (const comment of [...comments, ...extra]) {
    if (!byId.has(comment.id)) byId.set(comment.id, { ...comment, replies: [] })
  }
  const ordered = [...byId.values()].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id,
  )

  const roots: CommentNode[] = []
  for (const node of ordered) {
    const parent = node.parent_id === null ? undefined : byId.get(node.parent_id)
    if (parent) parent.replies.push(node)
    else roots.push(node)
  }
  return roots
}

/** Comments with text in them: a placeholder for one that has gone is not counted. */
export function countVisible(nodes: CommentNode[]): number {
  return nodes.reduce(
    (total, node) => total + (node.body === null ? 0 : 1) + countVisible(node.replies),
    0,
  )
}
