import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { EmailSignIn } from '@/features/account/email-sign-in'
import { landingPath } from '@/lib/auth/landing'

export const metadata = { title: 'Sign in' }

export default async function SignInPage({ searchParams }: PageProps<'/auth/signin'>) {
  const { callbackUrl } = await searchParams
  const redirectTo = landingPath(callbackUrl)

  return (
    <Card>
      <CardTitle>Sign in</CardTitle>
      <CardDescription className="mt-1">
        With Google, or with a link and code we email you. New here? Either one creates your
        account.
      </CardDescription>
      <form
        className="mt-6"
        action={async () => {
          'use server'
          await signIn('google', { redirectTo })
        }}
      >
        <Button type="submit" className="w-full">
          Continue with Google
        </Button>
      </form>
      <div className="text-muted-foreground my-5 flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
      <EmailSignIn redirectTo={redirectTo} />
    </Card>
  )
}
