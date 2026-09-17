import { signIn } from '@/auth'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Sign in' }

export default async function SignInPage({ searchParams }: PageProps<'/auth/signin'>) {
  const { callbackUrl } = await searchParams
  const redirectTo = typeof callbackUrl === 'string' ? callbackUrl : '/account'

  return (
    <Card>
      <CardTitle>Sign in</CardTitle>
      <CardDescription className="mt-1">Google is the only sign-in method for now.</CardDescription>
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
    </Card>
  )
}
