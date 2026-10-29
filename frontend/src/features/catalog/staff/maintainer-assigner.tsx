'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  useStaffAssignMaintainer,
  useStaffFindUsers,
} from '@/lib/api/generated/catalog-staff/catalog-staff'

import { EditorActions } from './editor-actions'
import { useAfterStaffWrite } from './use-staff-write'

/**
 * Makes an existing account a maintainer of the listing at once, with no claim to
 * review. Someone without an account yet gets a claim link instead - the server
 * says so when the address matches nobody.
 */
export function MaintainerAssigner({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [assigned, setAssigned] = useState('')
  const afterWrite = useAfterStaffWrite(slug)
  const assign = useStaffAssignMaintainer({
    mutation: {
      onSuccess: async () => {
        setAssigned(email.trim())
        setEmail('')
        setOpen(false)
        await afterWrite()
      },
    },
  })
  const query = email.trim()
  const accounts = useStaffFindUsers(
    { q: query },
    { query: { enabled: open && query.length >= 2 } },
  )
  // Once an account is chosen the field holds its exact address; offering it
  // again would only repeat what is already there.
  const matches = (accounts.data ?? []).filter((account) => account.email !== query)

  if (!open) {
    return (
      <div className="space-y-2">
        {assigned ? (
          <p className="text-sm" role="status">
            {assigned} now maintains this listing.
          </p>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setAssigned('')
            setOpen(true)
          }}
        >
          Add maintainer
        </Button>
      </div>
    )
  }

  return (
    <form
      className="max-w-md space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        assign.mutate({ slug, data: { email } })
      }}
    >
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor="maintainer-email">
          Account
        </label>
        <Input
          id="maintainer-email"
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
          Part of a name or email finds the account. They maintain the listing as soon as you assign
          it, with no review.
        </p>
      </div>
      <EditorActions
        error={assign.error}
        pending={assign.isPending}
        saveLabel="Assign"
        onCancel={() => {
          assign.reset()
          setOpen(false)
        }}
      />
    </form>
  )
}
