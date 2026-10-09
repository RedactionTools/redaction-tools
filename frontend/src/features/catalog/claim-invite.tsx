'use client'

import { signIn, useSession } from 'next-auth/react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/error-message'
import { useGetClaimInvite, useRedeemToolClaimInvite } from '@/lib/api/generated/catalog/catalog'

const REDEEM_FALLBACK = 'That link could not be accepted. Please try again.'

/**
 * The landing page of a claim link staff emailed to a tool's owner.
 *
 * Accepting is a button, never automatic on load: mail scanners open links
 * before people do, and whoever is signed in when it fires takes the listing.
 */
export function ClaimInvite({ token }: { token: string }) {
  const { data: session } = useSession()
  const invite = useGetClaimInvite(token)
  const redeem = useRedeemToolClaimInvite()

  if (invite.isPending) return <Skeleton className="h-32 w-full" />

  if (!invite.data) {
    return (
      <Card>
        <CardTitle>This claim link is not valid</CardTitle>
        <CardDescription className="mt-1">
          It may have been withdrawn. Ask whoever sent it for a new one.
        </CardDescription>
      </Card>
    )
  }

  const { tool, tool_name: toolName } = invite.data

  if (redeem.data) {
    return (
      <Card>
        <CardTitle>You maintain {toolName}</CardTitle>
        <p className="text-muted-foreground mt-2 text-sm" role="status">
          The listing is yours to keep current. Propose corrections from{' '}
          <Link className="underline" href="/my-listings">
            your listings
          </Link>
          , or{' '}
          <Link className="underline" href={`/tool/${tool}`}>
            see the listing
          </Link>
          .
        </p>
      </Card>
    )
  }

  if (invite.data.redeemed) {
    return (
      <Card>
        <CardTitle>{toolName}</CardTitle>
        <CardDescription className="mt-1">
          This claim link has already been used. If it was you, the listing is under{' '}
          <Link className="underline" href="/my-listings">
            your listings
          </Link>
          .
        </CardDescription>
      </Card>
    )
  }

  // Same rule as the claim form: a session whose token exchange or refresh
  // failed cannot call the API, so it is signed out for this purpose.
  const signedIn = Boolean(session && !session.error)

  return (
    <Card>
      <CardTitle>Maintain {toolName}</CardTitle>
      <CardDescription className="mt-1">
        Our team invited you to maintain this listing. Accept to propose corrections to its pricing
        and details. The link works once, for whoever accepts it first.
      </CardDescription>

      {redeem.error ? (
        <p className="text-warn mt-4 text-sm" role="alert">
          {errorMessage(redeem.error, REDEEM_FALLBACK)}
        </p>
      ) : null}

      <div className="mt-4">
        {signedIn ? (
          <Button disabled={redeem.isPending} onClick={() => redeem.mutate({ token })}>
            {redeem.isPending ? 'Accepting…' : 'Accept and maintain this listing'}
          </Button>
        ) : (
          <Button onClick={() => void signIn(undefined, { redirectTo: `/claim/${token}` })}>
            Sign in to accept
          </Button>
        )}
      </div>
    </Card>
  )
}
