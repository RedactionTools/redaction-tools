'use client'

import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api/error-message'
import { useStaffReviewComment } from '@/lib/api/generated/comments-staff/comments-staff'

import { useRefreshComments } from './use-refresh-comments'

/**
 * Publish, reject or remove one comment. Shown to staff only, but that is
 * cosmetic: the API refuses the review to anyone else.
 */
export function ModerationControls({
  commentId,
  status,
  note = '',
}: {
  commentId: number
  status: string
  note?: string
}) {
  const refresh = useRefreshComments()
  const review = useStaffReviewComment({ mutation: { onSuccess: () => refresh() } })
  const decide = (next: string) => review.mutate({ commentId, data: { status: next, note } })

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'published' ? null : (
        <Button
          size="sm"
          variant="outline"
          disabled={review.isPending}
          onClick={() => decide('published')}
        >
          Publish
        </Button>
      )}
      {status === 'pending' ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={review.isPending}
          onClick={() => decide('rejected')}
        >
          Reject
        </Button>
      ) : null}
      {status === 'published' ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={review.isPending}
          onClick={() => decide('removed')}
        >
          Remove
        </Button>
      ) : null}
      {review.error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(review.error, 'The review could not be saved.')}
        </p>
      ) : null}
    </div>
  )
}
