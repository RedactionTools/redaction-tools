'use client'

import { signIn, useSession } from 'next-auth/react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetMe } from '@/lib/api/generated/auth/auth'
import {
  useCreateComment,
  useListBlogComments,
  useListMyPendingComments,
  useListToolComments,
} from '@/lib/api/generated/comments/comments'
import { useStaffListComments } from '@/lib/api/generated/comments-staff/comments-staff'

import { useIsStaff } from '@/features/catalog/staff/use-is-staff'
import { buildTree, countVisible } from './build-tree'
import { CommentForm } from './comment-form'
import { CommentThread, type Viewer } from './comment-thread'
import { useRefreshComments } from './use-refresh-comments'

/**
 * The discussion under a tool page or a blog post.
 *
 * The thread is public. What else shows depends on who is reading, and is
 * asked for in the browser because both pages are the same HTML for everyone:
 * a signed-in reader also sees their own comments still awaiting review, and
 * staff see every comment awaiting review on the page, with the controls to
 * decide it.
 */
export function CommentSection({
  targetType,
  slug,
}: {
  targetType: 'tool' | 'blog'
  slug: string
}) {
  const { data: session } = useSession()
  // Same rule as the account menu: a session whose token refresh failed cannot
  // call the API, so it is signed out for this purpose.
  const signedIn = Boolean(session && !session.error)
  const isStaff = useIsStaff()
  const { data: me } = useGetMe({ query: { enabled: signedIn } })

  const tool = useListToolComments(slug, { query: { enabled: targetType === 'tool' } })
  const blog = useListBlogComments(slug, { query: { enabled: targetType === 'blog' } })
  const published = targetType === 'tool' ? tool : blog
  const target = { target_type: targetType, slug }
  const mine = useListMyPendingComments(target, { query: { enabled: signedIn } })
  const queue = useStaffListComments(
    { ...target, status: 'pending' },
    { query: { enabled: isStaff } },
  )

  const refresh = useRefreshComments()
  const create = useCreateComment({ mutation: { onSuccess: () => refresh() } })

  const tree = buildTree(published.data ?? [], [...(mine.data ?? []), ...(queue.data?.items ?? [])])
  const count = countVisible(buildTree(published.data ?? []))
  const viewer: Viewer = { targetType, slug, signedIn, userId: me?.id, isStaff }

  return (
    <section className="max-w-3xl space-y-6" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-xl font-semibold">
        Comments{count ? ` (${count})` : ''}
      </h2>

      {signedIn ? (
        <div className="space-y-2">
          <CommentForm
            label="Add a comment"
            submitLabel="Post comment"
            pending={create.isPending}
            error={create.error}
            onSubmit={(body) => create.mutateAsync({ data: { ...target, body, parent_id: null } })}
          />
          {create.data?.status === 'pending' ? (
            <p className="text-muted-foreground text-sm" role="status">
              Thanks - your comment is waiting for review. Only you can see it until it is approved.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 rounded-(--radius-card) border p-4">
          <p className="text-muted-foreground text-sm">Sign in to join the discussion.</p>
          <Button size="sm" onClick={() => void signIn()}>
            Sign in to comment
          </Button>
        </div>
      )}

      {published.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : tree.length ? (
        <CommentThread nodes={tree} viewer={viewer} />
      ) : (
        <p className="text-muted-foreground text-sm">No comments yet. Start the discussion.</p>
      )}
    </section>
  )
}
