'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/lib/api/error-message'
import {
  getListMyApiKeysQueryKey,
  useCreateApiKey,
  useListMyApiKeys,
  useRevokeApiKey,
} from '@/lib/api/generated/auth/auth'
import type { ApiKeyCreatedOut } from '@/lib/api/generated/model'

/**
 * API keys for the pdfredeval CLI. A new key's secret is shown once, here, and never
 * again - only its hash is stored - so the panel says so and prints the line to paste.
 */
export function ApiKeysPanel() {
  const queryClient = useQueryClient()
  const { data: keys } = useListMyApiKeys()
  const [label, setLabel] = useState('')
  const [created, setCreated] = useState<ApiKeyCreatedOut | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: getListMyApiKeysQueryKey() })
  const create = useCreateApiKey({
    mutation: {
      onSuccess: (key) => {
        setCreated(key)
        setLabel('')
        void refresh()
      },
    },
  })
  const revoke = useRevokeApiKey({ mutation: { onSuccess: refresh } })

  return (
    <Card className="space-y-4">
      <div>
        <CardTitle>API keys</CardTitle>
        <CardDescription>
          For publishing benchmark results. On your own machine, <code>pdfredeval login</code>{' '}
          creates one for you; create one here for CI.
        </CardDescription>
      </div>

      {created ? (
        <div className="bg-muted space-y-2 rounded-md p-3 text-sm" role="status">
          <p>Copy this key now - it will not be shown again.</p>
          <code className="block font-mono break-all">{created.key}</code>
          <pre className="text-muted-foreground overflow-x-auto text-xs">
            {`export PDFREDEVAL_API_KEY=${created.key}`}
          </pre>
        </div>
      ) : null}

      {keys?.length ? (
        <ul className="divide-border divide-y text-sm">
          {keys.map((key) => (
            <li key={key.prefix} className="flex items-center justify-between gap-3 py-2">
              <span>
                <span className="font-medium">{key.label}</span>{' '}
                <span className="text-muted-foreground font-mono text-xs">{key.prefix}…</span>
              </span>
              {key.revoked ? (
                <Badge>Revoked</Badge>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Revoke ${key.label}`}
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate({ prefix: key.prefix })}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          create.mutate({ data: { label: label.trim() } })
        }}
      >
        <div className="min-w-48 flex-1 space-y-1">
          <label htmlFor="api-key-label" className="block text-sm font-medium">
            Label
          </label>
          <Input
            id="api-key-label"
            required
            maxLength={40}
            placeholder="laptop, CI…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={create.isPending || !label.trim()}>
          Create key
        </Button>
      </form>
      {create.isError || revoke.isError ? (
        <p className="text-warn text-sm" role="alert">
          {errorMessage(create.error ?? revoke.error, 'That did not go through.')}
        </p>
      ) : null}
    </Card>
  )
}
