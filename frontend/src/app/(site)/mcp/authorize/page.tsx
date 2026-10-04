import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { McpConsent } from '@/features/mcp/mcp-consent'
import { getGetMcpAuthorizationQueryOptions } from '@/lib/api/generated/auth/auth'
import type { McpAuthorizationParams } from '@/lib/api/generated/model'
import { getQueryClient } from '@/lib/query/client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Connect to the MCP server',
  robots: { index: false, follow: false },
}

const FIELDS = [
  'client_id',
  'redirect_uri',
  'response_type',
  'code_challenge',
  'code_challenge_method',
  'resource',
  'scope',
  'state',
] as const

/**
 * The authorize endpoint the backend's OAuth metadata names for `/mcp`. Signing in
 * here is the site's ordinary Google sign-in, so the backend's Django session and
 * `/accounts/login/` play no part.
 */
export default async function McpAuthorizePage({ searchParams }: PageProps<'/mcp/authorize'>) {
  const query = await searchParams
  const params: McpAuthorizationParams = {}
  for (const field of FIELDS) {
    const raw = query[field]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value !== undefined) params[field] = value
  }

  const session = await auth()
  if (!session || session.error) {
    const back = `/mcp/authorize?${new URLSearchParams(params as Record<string, string>)}`
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(back)}`)
  }

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(getGetMcpAuthorizationQueryOptions(params))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Connect to the MCP server</h1>
      <McpConsent params={params} />
    </HydrationBoundary>
  )
}
