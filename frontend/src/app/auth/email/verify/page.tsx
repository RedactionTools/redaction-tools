import type { Metadata } from 'next'
import { AuthError } from 'next-auth'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { landingPath } from '@/lib/auth/landing'

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
  // The token in the query is the whole credential: a click out of this page
  // must not hand it to the next site in a Referer header.
  referrer: 'no-referrer',
}

/*
 * Signs in on the button, never on load: mail scanners open links before people
 * do, and a link they could spend would leave the reader with a dead one.
 */
export default async function EmailLinkPage({ searchParams }: PageProps<'/auth/email/verify'>) {
  const { token, next } = await searchParams

  if (typeof token !== 'string' || !token) {
    return (
      <Card>
        <CardTitle>This link is incomplete</CardTitle>
        <CardDescription className="mt-1">
          Open it straight from the email, or ask for a new one.
        </CardDescription>
        <Button asChild className="mt-6 w-full">
          <Link href="/auth/signin">Sign in</Link>
        </Button>
      </Card>
    )
  }

  const redirectTo = landingPath(next)

  return (
    <Card>
      <CardTitle>Sign in to Redaction Tools</CardTitle>
      <CardDescription className="mt-1">
        Continue to finish signing in. The link works once.
      </CardDescription>
      <form
        className="mt-6"
        action={async () => {
          'use server'
          try {
            await signIn('email', { token, redirectTo })
          } catch (error) {
            // Success also throws - Next's redirect - and that must propagate.
            if (error instanceof AuthError) redirect('/auth/error?error=EmailLinkInvalid')
            throw error
          }
        }}
      >
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
    </Card>
  )
}
