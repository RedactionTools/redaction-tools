import type { Metadata } from 'next'
import Link from 'next/link'

import { auth } from '@/auth'
import { Button } from '@/components/ui/button'
import { SubmitForm } from '@/features/catalog/submit-form'
import { canonicalMetadata } from '@/lib/seo/canonical'

export const metadata: Metadata = {
  title: 'Submit a redaction tool',
  description:
    'Tell us about a redaction tool we are missing. Every submission is reviewed by an editor before it appears in the catalog.',
  ...canonicalMetadata('/submit'),
}

// The explainer is public and indexable; only the form is gated. Keeping the
// page crawlable preserves the "submit your redaction tool" query and the
// inbound vendor links, while gating the form removes the abuse surface.
export default async function SubmitPage() {
  const session = await auth()
  const signedIn = Boolean(session && !session.error)

  return (
    <div className="max-w-2xl space-y-8">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Submit a redaction tool
        </h1>
        <p className="text-muted-foreground text-pretty">
          We are building a catalog of tools that redact documents, images, video and audio. If we
          are missing one, tell us.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">What happens next</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>A submission is a queue item, never a live page.</li>
          <li>
            An editor checks the tool, writes the listing in our own words and records the pricing
            from the vendor&apos;s published page. Your description is not published verbatim.
          </li>
          <li>
            Until a listing has been reviewed, its outbound links carry{' '}
            <code className="text-xs">rel=&quot;nofollow&quot;</code>. Submitting is not a way to
            buy a link.
          </li>
          <li>
            If you work for the vendor, you can claim the listing afterwards and propose
            corrections. See the{' '}
            <Link className="underline" href="/methodology">
              methodology
            </Link>
            .
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">The tool</h2>
        {signedIn ? (
          <SubmitForm />
        ) : (
          <div className="space-y-3">
            <p className="text-muted-foreground">
              Sign in to submit. An account is what keeps this queue readable - it is the only
              anti-spam measure we need.
            </p>
            <Button asChild>
              <Link href="/auth/signin?callbackUrl=/submit">Sign in to submit</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}
