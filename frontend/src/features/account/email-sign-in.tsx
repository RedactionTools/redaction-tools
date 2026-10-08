'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api/error-message'
import { useRequestEmailLogin } from '@/lib/api/generated/auth/auth'

const WRONG_CODE = 'That code is wrong or has expired. Check the latest email, or send a new one.'

/**
 * Signing in by email. One message carries a link and a code: the link works on
 * any device, and the code is for this tab - typed here, it signs in without
 * leaving the page.
 */
export function EmailSignIn({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const request = useRequestEmailLogin()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)

  const sendLink = (event: FormEvent) => {
    event.preventDefault()
    request.mutate(
      { data: { email, next: redirectTo } },
      { onSuccess: () => setSentTo(email.trim()) },
    )
  }

  const submitCode = async (event: FormEvent) => {
    event.preventDefault()
    setChecking(true)
    setCodeError(null)
    const result = await signIn('email', { email: sentTo, code: code.trim(), redirect: false })
    if (result?.error) {
      setCodeError(WRONG_CODE)
      setChecking(false)
      return
    }
    router.replace(redirectTo)
    router.refresh()
  }

  if (sentTo === null) {
    return (
      <form className="space-y-3" onSubmit={sendLink}>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Email</span>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {request.error ? (
          <p className="text-warn text-sm" role="alert">
            {errorMessage(request.error, 'That did not work. Please try again.')}
          </p>
        ) : null}
        <Button type="submit" variant="outline" className="w-full" disabled={request.isPending}>
          {request.isPending ? 'Sending…' : 'Email me a sign-in link'}
        </Button>
      </form>
    )
  }

  return (
    <form className="space-y-3" onSubmit={submitCode}>
      <p className="text-muted-foreground text-sm" role="status">
        We sent a sign-in link and a code to <strong className="text-foreground">{sentTo}</strong>.
        Open the link, or enter the code here. Both expire in 15 minutes.
      </p>
      <label className="block space-y-1.5 text-sm">
        <span className="font-medium">Code</span>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="font-mono tracking-[0.3em]"
        />
      </label>
      {codeError ? (
        <p className="text-warn text-sm" role="alert">
          {codeError}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={checking}>
        {checking ? 'Signing in…' : 'Sign in'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        onClick={() => {
          setSentTo(null)
          setCode('')
          setCodeError(null)
          request.reset()
        }}
      >
        Use a different email
      </Button>
    </form>
  )
}
