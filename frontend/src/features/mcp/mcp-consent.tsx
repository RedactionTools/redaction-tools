'use client'

import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/error-message'
import { useDecideMcpAuthorization, useGetMcpAuthorization } from '@/lib/api/generated/auth/auth'
import type { McpAuthorizationParams } from '@/lib/api/generated/model'

function leave(url: string) {
  window.location.assign(url)
}

/**
 * The consent step of the staff MCP server's OAuth flow. The backend checks the
 * request on both calls; this only shows it and passes the answer on. Every way out
 * is a full navigation to the client's redirect URI - often a loopback port a
 * terminal is listening on, which the router cannot reach.
 */
export function McpConsent({
  params,
  navigate = leave,
}: {
  params: McpAuthorizationParams
  navigate?: (url: string) => void
}) {
  const { data, error, isPending } = useGetMcpAuthorization(params)
  const decide = useDecideMcpAuthorization({
    mutation: { onSuccess: (answer) => navigate(answer.redirect_url) },
  })

  const bounce = data?.redirect_url
  useEffect(() => {
    if (bounce) navigate(bounce)
  }, [bounce, navigate])

  if (isPending || bounce) return <Skeleton className="h-40 w-full max-w-md" />
  if (error || !data) {
    return (
      <p className="text-warn" role="alert">
        {errorMessage(error, 'This connection request could not be checked.')}
      </p>
    )
  }

  const busy = decide.isPending || decide.isSuccess
  const answer = (decision: 'allow' | 'deny') => decide.mutate({ data: { params, decision } })
  return (
    <Card className="max-w-md space-y-4">
      <div className="space-y-1">
        <CardTitle>Connect {data.client_name}?</CardTitle>
        <CardDescription>
          <span className="text-foreground font-medium">{data.client_name}</span> is asking to use{' '}
          <span className="text-foreground font-medium">{data.server_title}</span> as you: it will
          read and change the live catalog with your staff rights.
        </CardDescription>
      </div>
      <p className="text-muted-foreground text-sm">
        {data.redirect_is_local ? (
          <>The answer goes back to a program on this computer ({data.redirect_host}).</>
        ) : (
          <>
            The answer goes to{' '}
            <span className="text-foreground font-mono">{data.redirect_host}</span>.
          </>
        )}
      </p>
      <div className="flex gap-3">
        <Button disabled={busy} onClick={() => answer('allow')}>
          Allow
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => answer('deny')}>
          Deny
        </Button>
      </div>
      {decide.error ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(decide.error, 'That did not go through. Try again.')}
        </p>
      ) : null}
    </Card>
  )
}
