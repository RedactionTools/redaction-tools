'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from '@/lib/api/generated/comments/comments'
import { cn } from '@/lib/utils'

import type { CommentNode } from './build-tree'
import { CommentForm } from './comment-form'
import { formatCommentDate, STATUS_LABELS, STATUS_TONES } from './format'
import { ModerationControls } from './moderation-controls'
import { useRefreshComments } from './use-refresh-comments'

export type Viewer = {
  targetType: 'tool' | 'blog'
  slug: string
  signedIn: boolean
  userId: string | undefined
  isStaff: boolean
}

/**
 * Replies indent under their parent up to a point, then stop: past two levels
 * on a phone and four on a wide screen, a reply sits flush with the one it
 * answers rather than squeezing the text into a sliver.
 */
function indent(level: number): string {
  if (level < 2) return 'mt-4 ml-2 border-l pl-4 sm:ml-4 sm:pl-6'
  if (level < 4) return 'mt-4 sm:ml-4 sm:border-l sm:pl-6'
  return 'mt-4'
}

export function CommentThread({
  nodes,
  viewer,
  level = 0,
}: {
  nodes: CommentNode[]
  viewer: Viewer
  level?: number
}) {
  return (
    <ol className={cn('space-y-6', level > 0 && indent(level - 1))}>
      {nodes.map((node) => (
        <li key={node.id}>
          <CommentItem node={node} viewer={viewer} level={level} />
        </li>
      ))}
    </ol>
  )
}

function CommentItem({
  node,
  viewer,
  level,
}: {
  node: CommentNode
  viewer: Viewer
  level: number
}) {
  const [mode, setMode] = useState<'read' | 'reply' | 'edit' | 'delete'>('read')
  const refresh = useRefreshComments()
  const reply = useCreateComment({ mutation: { onSuccess: () => refresh() } })
  const edit = useUpdateComment({ mutation: { onSuccess: () => refresh() } })
  const remove = useDeleteComment({ mutation: { onSuccess: () => refresh() } })

  const gone = node.body === null || node.author === null
  const mine = !gone && viewer.userId !== undefined && node.author?.id === viewer.userId
  const name = node.author?.name ?? ''

  return (
    <article id={`comment-${node.id}`} className="scroll-mt-24">
      {gone ? (
        <p className="text-muted-foreground text-sm italic">This comment was removed.</p>
      ) : (
        <>
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-medium">{name}</span>
            {node.author?.is_staff ? <Badge>Staff</Badge> : null}
            {node.author?.is_vendor ? <Badge tone="ok">Vendor</Badge> : null}
            <time className="text-muted-foreground" dateTime={node.created_at}>
              {formatCommentDate(node.created_at)}
            </time>
            {node.edited_at ? <span className="text-muted-foreground">· edited</span> : null}
            {node.status === 'published' ? null : (
              <Badge tone={STATUS_TONES[node.status as keyof typeof STATUS_TONES] ?? 'neutral'}>
                {STATUS_LABELS[node.status] ?? node.status}
              </Badge>
            )}
          </header>

          {mode === 'edit' ? (
            <div className="mt-2">
              <CommentForm
                label="Edit your comment"
                submitLabel="Save"
                initial={node.body ?? ''}
                autoFocus
                pending={edit.isPending}
                error={edit.error}
                onCancel={() => setMode('read')}
                onSubmit={(body) =>
                  edit
                    .mutateAsync({ commentId: node.id, data: { body } })
                    .then(() => setMode('read'))
                }
              />
            </div>
          ) : (
            <p className="mt-1 text-pretty break-words whitespace-pre-line">{node.body}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {viewer.signedIn && node.status === 'published' && mode === 'read' ? (
              <Button size="sm" variant="ghost" onClick={() => setMode('reply')}>
                Reply
              </Button>
            ) : null}
            {mine && mode === 'read' ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => setMode('edit')}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode('delete')}>
                  Delete
                </Button>
              </>
            ) : null}
            {mode === 'delete' ? (
              <>
                <span className="text-sm">Delete this comment?</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ commentId: node.id })}
                >
                  Yes, delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMode('read')}>
                  Cancel
                </Button>
              </>
            ) : null}
            {viewer.isStaff ? (
              <ModerationControls commentId={node.id} status={node.status} />
            ) : null}
          </div>

          {mode === 'reply' ? (
            <div className={cn(indent(level))}>
              <CommentForm
                label={`Reply to ${name}`}
                submitLabel="Post reply"
                autoFocus
                pending={reply.isPending}
                error={reply.error}
                onCancel={() => setMode('read')}
                onSubmit={(body) =>
                  reply
                    .mutateAsync({
                      data: {
                        target_type: viewer.targetType,
                        slug: viewer.slug,
                        body,
                        parent_id: node.id,
                      },
                    })
                    .then(() => setMode('read'))
                }
              />
            </div>
          ) : null}
        </>
      )}

      {node.replies.length ? (
        <CommentThread nodes={node.replies} viewer={viewer} level={level + 1} />
      ) : null}
    </article>
  )
}
