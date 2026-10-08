'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  useStaffCreateClaimInvite,
  useStaffFindUsers,
} from '@/lib/api/generated/catalog-staff/catalog-staff'

import { EditorActions } from './editor-actions'

function mailto(email: string, toolName: string, url: string) {
  const subject = `Maintain the ${toolName} listing on Redaction Tools`
  const body =
    `Hello,\n\nYou are invited to maintain the ${toolName} listing on Redaction Tools, ` +
    `so you can keep its pricing and details current.\n\n` +
    `Sign in and accept here:\n${url}\n\n` +
    `The link works once and is for you alone - please do not forward it.\n`
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Mints a one-time link that makes its recipient an approved maintainer, and
 * has the server email it to them.
 *
 * The server keeps only the link's hash, so this is the one place it is ever
 * shown - and the only way it reaches the owner when the email fails. A lost
 * link means minting another and revoking the first in the admin.
 */
export function ClaimInviteMinter({ slug, toolName }: { slug: string; toolName: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const create = useStaffCreateClaimInvite()
  const invite = create.data
  const query = email.trim()
  const accounts = useStaffFindUsers(
    { q: query },
    { query: { enabled: open && !invite && query.length >= 2 } },
  )
  // Once an account is chosen the field holds its exact address; offering it
  // again would only repeat what is already there.
  const matches = (accounts.data ?? []).filter((account) => account.email !== query)

  if (invite) {
    return (
      <div className="space-y-2" data-testid="claim-invite">
        <p className="text-sm font-medium">Claim link for {invite.email}</p>
        {invite.emailed ? (
          <p className="text-sm" role="status">
            Emailed to {invite.email}. Copy it below if you also want to send it yourself.
          </p>
        ) : (
          <p className="text-warn text-sm" role="alert">
            We could not email it. Copy the link or open it in your email and send it yourself.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            readOnly
            aria-label="Claim link"
            className="max-w-xl flex-1 font-mono text-xs"
            value={invite.url}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(invite.url).then(() => setCopied(true))
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button asChild size="sm">
            <a href={mailto(invite.email, toolName, invite.url)}>Open in email</a>
          </Button>
        </div>
        <CardDescription>
          This is the only time this link is shown. It never expires and works once: whoever accepts
          it maintains the listing with no further review.
        </CardDescription>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            create.reset()
            setEmail('')
            setCopied(false)
          }}
        >
          Done
        </Button>
      </div>
    )
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Create claim link
      </Button>
    )
  }

  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        create.mutate({ slug, data: { email } })
      }}
    >
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="claim-invite-email">
          Owner&apos;s email
        </label>
        <Input
          id="claim-invite-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {matches.length ? (
          <ul
            className="border-border divide-border divide-y rounded-md border"
            aria-label="Accounts"
          >
            {matches.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  className="hover:bg-muted w-full px-3 py-1.5 text-left text-sm"
                  onClick={() => setEmail(account.email)}
                >
                  {account.name ? `${account.name} · ` : ''}
                  <span className="text-muted-foreground">{account.email}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Type an address, or part of a name or email to pick an existing account. Recorded as the
          owner&apos;s work email. Send the link only to someone you have verified.
        </p>
      </div>
      <EditorActions
        error={create.error}
        pending={create.isPending}
        saveLabel="Create link"
        onCancel={() => {
          create.reset()
          setOpen(false)
        }}
      />
    </form>
  )
}
