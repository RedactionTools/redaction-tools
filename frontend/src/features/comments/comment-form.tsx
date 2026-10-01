'use client'

import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/error-message'

import { MAX_LENGTH } from './format'

const FALLBACK = 'Your comment could not be saved. Please try again.'

export function CommentForm({
  label,
  submitLabel,
  initial = '',
  pending,
  error,
  autoFocus = false,
  onSubmit,
  onCancel,
}: {
  label: string
  submitLabel: string
  initial?: string
  pending: boolean
  error: unknown
  autoFocus?: boolean
  onSubmit: (body: string) => Promise<unknown>
  onCancel?: () => void
}) {
  const id = useId()
  const [body, setBody] = useState(initial)

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault()
        // The text stays until the API takes it, so a refusal never loses what was written.
        onSubmit(body).then(
          () => setBody(''),
          () => undefined,
        )
      }}
    >
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Textarea
        id={id}
        rows={3}
        required
        maxLength={MAX_LENGTH}
        autoFocus={autoFocus}
        placeholder={label}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      {error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(error, FALLBACK)}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Posting…' : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {body.length > MAX_LENGTH * 0.8 ? (
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {body.length} / {MAX_LENGTH}
          </span>
        ) : null}
      </div>
    </form>
  )
}
