import type { Metadata } from 'next'
import Link from 'next/link'

import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { PostSubmissionForm } from '@/features/blog/post-submission-form'
import { canonicalMetadata } from '@/lib/seo/canonical'

export const metadata: Metadata = {
  title: 'Write for the Redaction Tools blog',
  description:
    'Pitch a guest post on redaction: a workflow, a pitfall, a comparison. An editor reads every submission before anything is published.',
  ...canonicalMetadata('/submit-post'),
}

// Like /submit: the explainer is public and indexable, only the form is gated.
export default async function SubmitPostPage() {
  const session = await auth()
  const signedIn = Boolean(session && !session.error)

  return (
    <div className="max-w-3xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Write for the blog
        </h1>
        <p className="text-muted-foreground text-pretty">
          Records officers, lawyers, journalists and engineers redact for a living. If you have
          learned something the hard way, we would like to publish it.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What we look for</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Practical posts: a workflow, a failure you caught, a comparison you ran yourself.</li>
          <li>
            Your own words, in markdown. Not published anywhere else, and not a product pitch.
          </li>
          <li>
            A submission is a queue item, never a live page. An editor reads it, may suggest
            changes, and publishes it under your name if it is accepted. You can follow its status
            on{' '}
            <Link className="underline" href="/activity">
              your activity page
            </Link>
            .
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        {signedIn ? (
          <PostSubmissionForm defaultAuthor={session?.user?.name ?? ''} />
        ) : (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Your post</h2>
            <p className="text-muted-foreground">
              Sign in to submit. The first sign-in creates your account - it is how we reach you
              about your post, and what keeps this queue readable.
            </p>
            <Button asChild>
              <Link href="/auth/signin?callbackUrl=/submit-post">Sign in to submit</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
