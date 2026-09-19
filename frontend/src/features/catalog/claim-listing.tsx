'use client'

import { signIn, useSession } from 'next-auth/react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { type ReactNode, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/error-message'
import {
  useClaimTool,
  useListMyListings,
  useVerifyToolClaim,
} from '@/lib/api/generated/catalog/catalog'
import type { ToolDetailOut } from '@/lib/api/generated/model'

const CLAIM_FALLBACK = 'That claim could not be sent. Please try again.'
const CODE_FALLBACK = 'That code could not be checked. Please try again.'

/**
 * The vendor's way in.
 *
 * A claim is not access: it is an application, and the wording here never
 * implies otherwise - a verified code only proves the claimant can receive mail
 * at an address, so staff still decide.
 */
export function ClaimListing({ tool }: { tool: ToolDetailOut }) {
  const { data: session } = useSession()
  const [started, setStarted] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [evidence, setEvidence] = useState('')
  const [code, setCode] = useState('')
  const create = useClaimTool()
  const verify = useVerifyToolClaim()
  const claim = create.data

  // Asked only of a signed-in reader, and the one request answers it for every
  // listing they open. A tool page cannot carry the answer itself: it is public
  // and cached, so it is the same page for everyone who asks for it.
  const signedIn = Boolean(session && !session.error)
  const myListings = useListMyListings({ query: { enabled: signedIn } })
  const maintains = myListings.data?.some((listing) => listing.slug === tool.slug)

  // Held rather than guessed: rendering the invitation while the answer is in
  // flight shows an owner the one prompt this is here to spare them.
  if (signedIn && myListings.isPending) {
    return <Skeleton className="h-32 w-full" data-testid="claim-listing-skeleton" />
  }

  // Someone who already maintains the listing has nothing to claim - asking
  // them whether they work for the vendor is the catalog forgetting a claim it
  // approved.
  if (maintains) {
    return (
      <Card>
        <CardTitle>You maintain this listing</CardTitle>
        <CardDescription className="mt-1">
          Corrections go through{' '}
          <Link className="underline" href="/my-listings">
            your listings
          </Link>
          , where an editor reviews them before they appear here.
        </CardDescription>
      </Card>
    )
  }

  // Same rule the account menu uses: a session whose token exchange or refresh
  // failed cannot call the API, so it is signed out for this purpose.
  if (!signedIn) {
    return (
      <ClaimPrompt vendor={tool.vendor.name}>
        <Button onClick={() => void signIn('google')}>Sign in to claim this listing</Button>
      </ClaimPrompt>
    )
  }

  if (!started) {
    return (
      <ClaimPrompt vendor={tool.vendor.name}>
        <Button
          onClick={() => {
            if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
              posthog.capture('listing_claim_started', { tool_slug: tool.slug })
            }
            setStarted(true)
          }}
        >
          Claim this listing
        </Button>
      </ClaimPrompt>
    )
  }

  if (verify.data) {
    return (
      <Card>
        <CardTitle>Claim submitted</CardTitle>
        <p className="text-muted-foreground mt-2 text-sm" role="status">
          Your address is confirmed. A member of our team reviews every claim before a listing
          changes hands - we will email you either way. Approved listings appear under{' '}
          <Link className="underline" href="/my-listings">
            your listings
          </Link>
          .
        </p>
      </Card>
    )
  }

  if (claim) {
    return (
      <Card>
        <CardTitle>Check your email</CardTitle>
        <CardDescription className="mt-1">
          We sent a code to <strong className="text-foreground">{claim.work_email}</strong>. It
          confirms you can receive mail there.
        </CardDescription>
        <form
          className="mt-4 max-w-xs space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            verify.mutate({ claimId: claim.id, data: { code } })
          }}
        >
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="claim-code">
              Code
            </label>
            <Input
              id="claim-code"
              required
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>

          {verify.error ? (
            <p className="text-warn text-sm" role="alert">
              {errorMessage(verify.error, CODE_FALLBACK)}
            </p>
          ) : null}

          <Button type="submit" disabled={verify.isPending}>
            {verify.isPending ? 'Confirming…' : 'Confirm'}
          </Button>
        </form>
      </Card>
    )
  }

  return (
    <Card>
      <CardTitle>Claim {tool.name}</CardTitle>
      <form
        className="mt-4 max-w-xl space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
            posthog.capture('listing_claim_requested', { tool_slug: tool.slug })
          }
          create.mutate({ data: { tool: tool.slug, work_email: email, role, evidence } })
        }}
      >
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="claim-work-email">
            Work email
          </label>
          <Input
            id="claim-work-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Use an address on {tool.vendor.name}&apos;s own domain where you can receive mail. We
            send a code to it.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="claim-role">
            Your role
          </label>
          <Input
            id="claim-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="Head of Product"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="claim-evidence">
            Anything that helps us verify you
          </label>
          <textarea
            id="claim-evidence"
            rows={3}
            className="border-border bg-surface w-full rounded-md border px-3 py-2 text-sm"
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Optional, and worth filling in if your address is not on {tool.vendor.name}&apos;s
            domain - a person reads every claim before a listing changes hands.
          </p>
        </div>

        {create.error ? (
          <p className="text-warn text-sm" role="alert">
            {errorMessage(create.error, CLAIM_FALLBACK)}
          </p>
        ) : null}

        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Sending…' : 'Send me a code'}
        </Button>
      </form>
    </Card>
  )
}

/** The invitation, which reads the same whether the next step is a sign-in or
 *  the form itself. */
function ClaimPrompt({ vendor, children }: { vendor: string; children: ReactNode }) {
  return (
    <Card>
      <CardTitle>Do you work for {vendor}?</CardTitle>
      <CardDescription className="mt-1">
        Claim this listing to propose corrections to its pricing and details.
      </CardDescription>
      <div className="mt-4">{children}</div>
    </Card>
  )
}
