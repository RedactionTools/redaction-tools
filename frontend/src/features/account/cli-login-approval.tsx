'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/error-message'
import { useApproveCliLogin, useDenyCliLogin, useGetCliLogin } from '@/lib/api/generated/auth/auth'
import type { CliLoginOut } from '@/lib/api/generated/model'

/**
 * Where `pdfredeval login` sends the browser. The code is shown large so it can be
 * checked against the terminal: approving a code someone else started would hand them
 * a key to publish as you, and the comparison is what stops that.
 */
export function CliLoginApproval({ code }: { code: string }) {
  if (!code) return <CodeForm />
  return <Approval code={code} />
}

function CodeForm() {
  const [value, setValue] = useState('')
  return (
    <form method="get" className="max-w-sm space-y-3">
      <label htmlFor="cli-code" className="block text-sm font-medium">
        Code from your terminal
      </label>
      <Input
        id="cli-code"
        name="code"
        required
        autoComplete="off"
        placeholder="XXXX-XXXX"
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
      />
      <Button type="submit">Continue</Button>
    </form>
  )
}

function Approval({ code }: { code: string }) {
  const { data, error, isPending } = useGetCliLogin(code)
  const [decided, setDecided] = useState<CliLoginOut | null>(null)
  const approve = useApproveCliLogin({ mutation: { onSuccess: setDecided } })
  const deny = useDenyCliLogin({ mutation: { onSuccess: setDecided } })

  if (isPending) return <Skeleton className="h-40 w-full max-w-md" />
  if (error || !data) {
    return (
      <p className="text-warn" role="alert">
        {errorMessage(error, 'No sign-in with that code. Check it against your terminal.')}
      </p>
    )
  }

  const login = decided ?? data
  if (login.status === 'approved' || login.status === 'consumed') {
    return (
      <Card className="max-w-md space-y-2" role="status">
        <CardTitle>Signed in</CardTitle>
        <CardDescription>
          pdfredeval on {login.client_name} can now publish results as you. Return to your terminal.
          You can revoke its key on your account page at any time.
        </CardDescription>
      </Card>
    )
  }
  if (login.status === 'denied') {
    return <p role="status">Sign-in denied. Nothing was issued to {login.client_name}.</p>
  }
  if (login.status === 'expired') {
    return <p role="status">This code has expired. Run pdfredeval login again for a new one.</p>
  }

  const busy = approve.isPending || deny.isPending
  const failure = approve.error ?? deny.error
  return (
    <Card className="max-w-md space-y-4">
      <div className="space-y-1">
        <CardTitle>Sign in pdfredeval?</CardTitle>
        <CardDescription>
          pdfredeval on <span className="text-foreground font-medium">{login.client_name}</span> is
          asking for an API key to publish benchmark results as you.
        </CardDescription>
      </div>
      <div>
        <p className="text-muted-foreground text-sm">Check that your terminal shows</p>
        <p className="font-mono text-3xl font-semibold tracking-widest">{login.user_code}</p>
      </div>
      <div className="flex gap-3">
        <Button disabled={busy} onClick={() => approve.mutate({ userCode: login.user_code })}>
          Approve
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => deny.mutate({ userCode: login.user_code })}
        >
          Deny
        </Button>
      </div>
      {failure ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(failure, 'That did not go through. Try again.')}
        </p>
      ) : null}
    </Card>
  )
}
