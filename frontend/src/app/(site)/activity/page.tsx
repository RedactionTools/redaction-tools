import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { MyActivity } from '@/features/account/my-activity'
import { getListMyBenchmarkSubmissionsQueryOptions } from '@/lib/api/generated/benchmarks/benchmarks'
import {
  getListMyClaimsQueryOptions,
  getListMyListingsQueryOptions,
  getListMySubmissionsQueryOptions,
} from '@/lib/api/generated/catalog/catalog'
import { getQueryClient } from '@/lib/query/client'

export const metadata = {
  title: 'Your activity',
  // An account's own record is nobody's search result.
  robots: { index: false, follow: false },
}

export default async function MyActivityPage() {
  const session = await auth()
  if (!session || session.error) redirect('/auth/signin?callbackUrl=/activity')

  // All four at once, so the page arrives whole rather than section by section.
  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery(getListMyBenchmarkSubmissionsQueryOptions()),
    queryClient.prefetchQuery(getListMyClaimsQueryOptions()),
    queryClient.prefetchQuery(getListMySubmissionsQueryOptions()),
    queryClient.prefetchQuery(getListMyListingsQueryOptions()),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Your activity</h1>
      <p className="text-muted-foreground mb-6">Everything you have sent us and where it stands.</p>
      <MyActivity />
    </HydrationBoundary>
  )
}
