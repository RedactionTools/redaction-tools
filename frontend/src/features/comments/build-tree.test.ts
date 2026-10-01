import { describe, expect, it } from 'vitest'

import { buildTree, countVisible } from './build-tree'
import { makeComment } from './fixtures'

describe('buildTree', () => {
  it('nests replies under their parents, oldest first', () => {
    const root = makeComment({ id: 1, created_at: '2026-10-01T10:00:00Z' })
    const late = makeComment({ id: 2, created_at: '2026-10-01T12:00:00Z' })
    const reply = makeComment({ id: 3, parent_id: 1, depth: 1, created_at: '2026-10-01T11:00:00Z' })

    const tree = buildTree([late, reply, root])

    expect(tree.map((node) => node.id)).toEqual([1, 2])
    expect(tree[0].replies.map((node) => node.id)).toEqual([3])
  })

  it('merges in comments only this reader can see, without duplicates', () => {
    const root = makeComment({ id: 1 })
    const mine = makeComment({ id: 2, parent_id: 1, depth: 1, status: 'pending' })

    const tree = buildTree([root], [mine, root])

    expect(tree).toHaveLength(1)
    expect(tree[0].replies[0]).toMatchObject({ id: 2, status: 'pending' })
  })

  it('keeps a reply whose parent it cannot see at the top level', () => {
    const orphan = makeComment({ id: 5, parent_id: 99, depth: 1 })

    expect(buildTree([orphan]).map((node) => node.id)).toEqual([5])
  })
})

describe('countVisible', () => {
  it('counts comments with text, not placeholders', () => {
    const gone = makeComment({ id: 1, status: 'removed', body: null, author: null })
    const reply = makeComment({ id: 2, parent_id: 1, depth: 1 })

    expect(countVisible(buildTree([gone, reply]))).toBe(1)
  })
})
