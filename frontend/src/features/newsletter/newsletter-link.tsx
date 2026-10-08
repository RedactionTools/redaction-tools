'use client'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { errorMessage } from '@/lib/api/error-message'
import {
  useConfirmNewsletter,
  useUnsubscribeNewsletter,
} from '@/lib/api/generated/newsletter/newsletter'

const FALLBACK = 'That did not work. Please try again.'

const TOPIC_LABELS: Record<string, string> = {
  reviews: 'Reviews',
  new_tools: 'New tools',
  benchmarks: 'Benchmarks',
}

function listed(topics: string[]): string {
  const labels = topics.map((topic) => TOPIC_LABELS[topic] ?? topic)
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : labels[0]
}

function Incomplete() {
  return (
    <Card>
      <CardTitle>This link is incomplete</CardTitle>
      <CardDescription className="mt-1">
        Open it straight from the email, or subscribe again from the footer of any page.
      </CardDescription>
    </Card>
  )
}

/*
 * Both pages act on a button, never on load: mail scanners open links before
 * people do, and a confirmation they could fire would make the opt-in single.
 */

export function NewsletterConfirm({ token }: { token: string }) {
  const confirm = useConfirmNewsletter()

  if (!token) return <Incomplete />

  if (confirm.data) {
    return (
      <Card>
        <CardTitle>You&apos;re subscribed</CardTitle>
        <p className="text-muted-foreground mt-2 text-sm" role="status">
          {confirm.data.email} will get {listed(confirm.data.topics)}. A welcome email is on its
          way, with a link to unsubscribe whenever you like.
        </p>
      </Card>
    )
  }

  return (
    <Card className="space-y-4">
      <div>
        <CardTitle>Confirm your subscription</CardTitle>
        <CardDescription className="mt-1">
          One click and you&apos;ll hear about new reviews, tools and benchmark results.
        </CardDescription>
      </div>
      {confirm.error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(confirm.error, FALLBACK)} Subscribe again from the footer for a fresh link.
        </p>
      ) : null}
      <Button disabled={confirm.isPending} onClick={() => confirm.mutate({ data: { token } })}>
        {confirm.isPending ? 'Confirming…' : 'Confirm subscription'}
      </Button>
    </Card>
  )
}

export function NewsletterUnsubscribe({ token }: { token: string }) {
  const unsubscribe = useUnsubscribeNewsletter()

  if (!token) return <Incomplete />

  if (unsubscribe.isSuccess) {
    return (
      <Card>
        <CardTitle>You&apos;re unsubscribed</CardTitle>
        <p className="text-muted-foreground mt-2 text-sm" role="status">
          This address is unsubscribed and won&apos;t get any more newsletter email. Changed your
          mind? Subscribe again from the footer.
        </p>
      </Card>
    )
  }

  return (
    <Card className="space-y-4">
      <div>
        <CardTitle>Unsubscribe from Redaction Tools updates</CardTitle>
        <CardDescription className="mt-1">
          You&apos;ll stop getting emails about new reviews, tools and benchmarks.
        </CardDescription>
      </div>
      {unsubscribe.error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(unsubscribe.error, FALLBACK)}
        </p>
      ) : null}
      <Button
        disabled={unsubscribe.isPending}
        onClick={() => unsubscribe.mutate({ data: { token } })}
      >
        {unsubscribe.isPending ? 'Unsubscribing…' : 'Unsubscribe'}
      </Button>
    </Card>
  )
}
