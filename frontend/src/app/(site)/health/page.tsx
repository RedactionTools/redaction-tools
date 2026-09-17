import { HydrationBoundary, dehydrate } from '@tanstack/react-query'

import { HealthPanel } from '@/features/health/health-panel'
import { getHealthQueryOptions } from '@/lib/api/generated/core/core'
import { getQueryClient } from '@/lib/query/client'

export const metadata = { title: 'Status' }

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
