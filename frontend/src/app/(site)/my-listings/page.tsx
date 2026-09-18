import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { MyListingsPanel } from '@/features/catalog/my-listings-panel'
import {
  getListFacetsQueryOptions,
  getListMyListingsQueryOptions,
} from '@/lib/api/generated/catalog/catalog'
import { getQueryClient } from '@/lib/query/client'

export const metadata = {
  title: 'Your listings',
  // An owner area is nobody's search result.
  robots: { index: false, follow: false },
}

export default async function MyListingsPage() {
  const session = await auth()
  if (!session || session.error) redirect('/auth/signin?callbackUrl=/my-listings')

  const queryClient = getQueryClient()
  // The taxonomy comes with the page: the editor offers it as checkboxes, and
  // fetching it on open would have them appear a beat after the form does.
  await Promise.all([
    queryClient.prefetchQuery(getListMyListingsQueryOptions()),
    queryClient.prefetchQuery(getListFacetsQueryOptions()),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Your listings</h1>
      <MyListingsPanel />
    </HydrationBoundary>
  )
}
