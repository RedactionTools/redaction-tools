'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/api-error'
import { useSubmitTool } from '@/lib/api/generated/catalog/catalog'

type FieldError = { loc?: unknown[]; msg?: string }

/**
 * Turn whatever the API refused with into something the submitter can act on.
 *
 * Ninja reports validation failures as a list of per-field entries and business
 * conflicts as a `detail` string; flattening both to "something went wrong"
 * would hide the one message that tells a duplicate submitter to claim the
 * listing instead.
 *
 * Takes `unknown`: the Register augmentation types query errors as ApiError, but
 * a mutation's error is not covered by it, so this narrows rather than asserts.
 */
function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'That could not be submitted. Please try again.'

  const body = error.body as { detail?: string | FieldError[] } | null
  const detail = body?.detail

  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        const field = Array.isArray(entry.loc) ? entry.loc.at(-1) : undefined
        return field ? `${field}: ${entry.msg}` : entry.msg
      })
      .filter(Boolean)
      .join(' ')
  }
  return 'That could not be submitted. Please try again.'
}

export function SubmitForm() {
  const [name, setName] = useState('')
  const [homepage, setHomepage] = useState('')
  const [description, setDescription] = useState('')
  const { mutate, isPending, isSuccess, error } = useSubmitTool()

  if (isSuccess) {
    return (
      <p className="text-ok" role="status">
        Thank you. Your submission is in the review queue. An editor checks every entry and writes
        the listing before it appears in the catalog.
      </p>
    )
  }

  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        mutate({ data: { name, homepage_url: homepage, description } })
      }}
    >
      <Field label="Tool name" value={name} onChange={setName} required />
      <Field
        label="Homepage URL"
        type="url"
        value={homepage}
        onChange={setHomepage}
        required
        placeholder="https://example.com"
      />
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="description">
          What it does
        </label>
        <textarea
          id="description"
          required
          rows={4}
          className="border-border bg-surface w-full rounded-md border px-3 py-2 text-sm"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          We never publish this verbatim - our editors write the listing.
        </p>
      </div>

      {error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(error)}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Submitting…' : 'Submit for review'}
      </Button>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string
  value: string
  onChange: (value: string) => void
} & Omit<React.ComponentProps<'input'>, 'onChange' | 'value'>) {
  const id = label.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props} />
    </div>
  )
}
