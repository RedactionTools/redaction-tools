import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { AccountCard } from '@/features/account/account-card'
import { ApiKeysPanel } from '@/features/benchmarks/api-keys-panel'
import { getGetMeQueryOptions, getListMyApiKeysQueryOptions } from '@/lib/api/generated/auth/auth'
import { getQueryClient } from '@/lib/query/client'

export const metadata = { title: 'Account' }

export default async function AccountPage() {
  const session = await auth()
  if (!session || session.error) redirect('/auth/signin?callbackUrl=/account')

  // Prefetching through the server token source is what proves the
  // authenticated path works end to end in a Server Component.
  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery(getGetMeQueryOptions()),
    queryClient.prefetchQuery(getListMyApiKeysQueryOptions()),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Account</h1>
      <div className="space-y-6">
        <AccountCard />
        <ApiKeysPanel />
      </div>
    </HydrationBoundary>
  )
}
