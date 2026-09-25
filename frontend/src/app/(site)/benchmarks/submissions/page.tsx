import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { redirect } from 'next/navigation'

import { auth } from '@/auth'
import { MySubmissions } from '@/features/benchmarks/my-submissions'
import { getListMyBenchmarkSubmissionsQueryOptions } from '@/lib/api/generated/benchmarks/benchmarks'
import { getQueryClient } from '@/lib/query/client'

export const metadata = {
  title: 'Your benchmark submissions',
  robots: { index: false, follow: false },
}

export default async function MyBenchmarkSubmissionsPage() {
  const session = await auth()
  if (!session || session.error) redirect('/auth/signin?callbackUrl=/benchmarks/submissions')

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery(getListMyBenchmarkSubmissionsQueryOptions())

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Your benchmark submissions</h1>
      <MySubmissions />
    </HydrationBoundary>
  )
}
