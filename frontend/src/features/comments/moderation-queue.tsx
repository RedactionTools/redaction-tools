'use client'

import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useId, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/error-message'
import {
  getStaffGetCommentSettingsQueryKey,
  useStaffGetCommentSettings,
  useStaffListComments,
  useStaffUpdateCommentSettings,
} from '@/lib/api/generated/comments-staff/comments-staff'
import type { StaffCommentOut } from '@/lib/api/generated/model'

import { formatCommentDate, STATUS_LABELS, STATUS_TONES } from './format'
import { ModerationControls } from './moderation-controls'

const STATUSES = ['pending', 'published', 'rejected', 'removed'] as const
const PAGE = 50

/** Every comment on the site at one status, newest first: pending is the queue. */
export function ModerationQueue() {
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('pending')
  const { data } = useStaffListComments({ status, limit: PAGE, offset: 0 })

  return (
    <section className="space-y-4">
      <div role="tablist" aria-label="Comment status" className="flex flex-wrap gap-2">
        {STATUSES.map((value) => (
          <Button
            key={value}
            role="tab"
            size="sm"
            variant={value === status ? 'primary' : 'outline'}
            aria-selected={value === status}
            onClick={() => setStatus(value)}
          >
            {value === 'pending' ? 'Awaiting review' : STATUS_LABELS[value]}
          </Button>
        ))}
      </div>

      {data === undefined ? (
        <Skeleton className="h-40 w-full" />
      ) : data.items.length ? (
        <>
          <ul className="space-y-4">
            {data.items.map((comment) => (
              <QueueRow key={comment.id} comment={comment} />
            ))}
          </ul>
          {data.count > data.items.length ? (
            <p className="text-muted-foreground text-sm">
              Showing the newest {data.items.length} of {data.count}.
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          {status === 'pending' ? 'Nothing waiting for review.' : 'No comments here.'}
        </p>
      )}
    </section>
  )
}

function QueueRow({ comment }: { comment: StaffCommentOut }) {
  const noteId = useId()
  const [note, setNote] = useState('')
  const href = `/${comment.target_type}/${comment.target_slug}#comment-${comment.id}`

  return (
    <li className="border-border bg-surface space-y-3 rounded-(--radius-card) border p-4">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium">{comment.author?.name ?? 'Deleted account'}</span>
        <span className="text-muted-foreground">on</span>
        <Link className="underline" href={href}>
          {comment.target_title}
        </Link>
        <time className="text-muted-foreground" dateTime={comment.created_at}>
          {formatCommentDate(comment.created_at)}
        </time>
        <Badge tone={STATUS_TONES[comment.status as keyof typeof STATUS_TONES] ?? 'neutral'}>
          {STATUS_LABELS[comment.status] ?? comment.status}
        </Badge>
      </header>
      {comment.parent_body ? (
        <p className="text-muted-foreground border-l pl-3 text-sm">
          In reply to: {comment.parent_body}
        </p>
      ) : null}
      <p className="text-pretty break-words whitespace-pre-line">
        {comment.body || <em className="text-muted-foreground">Deleted by its author.</em>}
      </p>
      {comment.review_note ? (
        <p className="text-muted-foreground text-sm">Note: {comment.review_note}</p>
      ) : null}
      {comment.status === 'pending' ? (
        <div className="max-w-sm space-y-1">
          <label className="text-sm font-medium" htmlFor={noteId}>
            Note (optional)
          </label>
          <Input id={noteId} value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
      ) : null}
      {comment.body ? (
        <ModerationControls commentId={comment.id} status={comment.status} note={note} />
      ) : null}
    </li>
  )
}

/** Whether new comments wait for review: the switch staff flip during a spam wave. */
export function CommentSettingsCard() {
  const thresholdId = useId()
  const queryClient = useQueryClient()
  const { data: settings } = useStaffGetCommentSettings()
  const update = useStaffUpdateCommentSettings({
    mutation: {
      onSuccess: (saved) => queryClient.setQueryData(getStaffGetCommentSettingsQueryKey(), saved),
    },
  })
  const [threshold, setThreshold] = useState<string | null>(null)

  if (!settings) return <Skeleton className="h-40 w-full" />

  return (
    <Card>
      <CardTitle>Moderation</CardTitle>
      <CardDescription className="mt-1">
        Staff comments always publish straight away. Everyone else&apos;s wait for review unless one
        of these applies.
      </CardDescription>
      <div className="mt-4 space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            className="mt-0.5"
            checked={settings.auto_approve}
            disabled={update.isPending}
            onChange={(event) => update.mutate({ data: { auto_approve: event.target.checked } })}
          />
          <span>
            <span className="font-medium">Auto-approve: publish every comment immediately</span>
            <span className="text-muted-foreground block">
              Turn this off if spam starts getting through.
            </span>
          </span>
        </label>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (threshold === null) return
            update.mutate(
              { data: { trusted_after: Number(threshold) } },
              { onSuccess: () => setThreshold(null) },
            )
          }}
        >
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor={thresholdId}>
              Trusted after (published comments)
            </label>
            <Input
              id={thresholdId}
              type="number"
              min={0}
              className="w-28"
              value={threshold ?? String(settings.trusted_after)}
              onChange={(event) => setThreshold(event.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={update.isPending || threshold === null}>
            Save
          </Button>
          <p className="text-muted-foreground basis-full text-xs">
            An account with this many published comments skips review. 0 turns this off.
          </p>
        </form>
        {update.error ? (
          <p className="text-warn text-sm" role="alert">
            {errorMessage(update.error, 'The setting could not be saved.')}
          </p>
        ) : null}
      </div>
    </Card>
  )
}
