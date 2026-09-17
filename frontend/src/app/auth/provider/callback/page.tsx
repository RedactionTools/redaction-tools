import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Sign-in failed' }

/**
 * allauth's `socialaccount_login_error` target - configured in the backend's
 * HEADLESS_FRONTEND_URLS, so this route has to exist even though the frontend
 * never links to it itself.
 */
export default function ProviderCallbackPage() {
  return (
    <Card>
      <CardTitle>Sign-in was cancelled</CardTitle>
      <CardDescription className="mt-1">
        The provider reported a problem before the sign-in completed.
      </CardDescription>
      <Button asChild className="mt-6 w-full">
        <Link href="/auth/signin">Back to sign in</Link>
      </Button>
    </Card>
  )
}
