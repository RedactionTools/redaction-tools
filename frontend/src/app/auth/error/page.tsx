import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Sign-in failed' }

const MESSAGES: Record<string, string> = {
  MissingIdToken: 'Google did not return an identity token, so we could not sign you in.',
  TokenExchangeError: 'The backend rejected the Google sign-in. Please try again.',
  RefreshTokenError: 'Your session expired. Please sign in again.',
  Configuration: 'Sign-in is misconfigured. Check the Google client id and secret.',
}

export default async function AuthErrorPage({ searchParams }: PageProps<'/auth/error'>) {
  const { error } = await searchParams
  const key = typeof error === 'string' ? error : ''

  return (
    <Card>
      <CardTitle>Sign-in failed</CardTitle>
      <CardDescription className="mt-1">
        {MESSAGES[key] ?? 'Something went wrong while signing in.'}
      </CardDescription>
      <Button asChild className="mt-6 w-full">
        <Link href="/auth/signin">Try again</Link>
      </Button>
    </Card>
  )
}
