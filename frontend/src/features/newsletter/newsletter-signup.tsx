'use client'

import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api/api-error'
import { errorMessage } from '@/lib/api/error-message'
import { useSubscribeNewsletter } from '@/lib/api/generated/newsletter/newsletter'

const TOPICS = [
  { key: 'reviews', label: 'Reviews' },
  { key: 'new_tools', label: 'New tools' },
  { key: 'benchmarks', label: 'Benchmarks' },
] as const

type Topic = (typeof TOPICS)[number]['key']

const FALLBACK = 'That did not work. Please try again.'

function failure(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return 'Too many attempts from here. Please try again later.'
  }
  return errorMessage(error, FALLBACK)
}

/**
 * The footer sign-up. Double opt-in: this only asks for a confirmation link, so
 * the reply is the same whether or not the address is already on the list.
 */
export function NewsletterSignup() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [topics, setTopics] = useState<Record<Topic, boolean>>({
    reviews: true,
    new_tools: true,
    benchmarks: true,
  })
  const subscribe = useSubscribeNewsletter()
  const nothingPicked = !Object.values(topics).some(Boolean)

  if (subscribe.isSuccess) {
    return (
      <p className="text-sm" role="status">
        Check your inbox: we sent a link to confirm <strong>{email}</strong>.
      </p>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        subscribe.mutate({ data: { email, ...topics } })
      }}
    >
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={id}>
          Email address
        </label>
        <Input
          id={id}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={subscribe.isPending || nothingPicked}>
          {subscribe.isPending ? 'Subscribing…' : 'Subscribe'}
        </Button>
      </div>
      <fieldset className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <legend className="sr-only">Topics</legend>
        {TOPICS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5">
            <Checkbox
              checked={topics[key]}
              onChange={(event) => setTopics({ ...topics, [key]: event.target.checked })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {subscribe.error ? (
        <p className="text-warn text-sm" role="alert">
          {failure(subscribe.error)}
        </p>
      ) : null}
    </form>
  )
}
