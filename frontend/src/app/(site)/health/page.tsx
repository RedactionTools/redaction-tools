import { HydrationBoundary, dehydrate } from '@tanstack/react-query'

import { HealthPanel } from '@/features/health/health-panel'
import { getHealthQueryOptions } from '@/lib/api/generated/core/core'
import { getQueryClient } from '@/lib/query/client'

// A liveness panel, linked from nowhere and absent from the sitemap. `noindex`
// rather than a robots.txt Disallow: a disallowed URL is never fetched, so the
// crawler never sees the noindex and can still index it from a stray link.
export const metadata = { title: 'Status', robots: { index: false, follow: false } }

export default async function HealthPage() {
  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(getHealthQueryOptions())

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Status</h1>
      <HealthPanel />
    </HydrationBoundary>
  )
}
