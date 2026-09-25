import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import { notFound, redirect } from 'next/navigation'

import { auth } from '@/auth'
import { CliPublishCard } from '@/features/benchmarks/cli-publish-card'
import {
  SUBMIT_SUITE_PARAMS,
  SUBMIT_TOOL_PARAMS,
  SubmitResults,
} from '@/features/benchmarks/submit-results'
import { getGetBenchmarkSuiteQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import { getListToolsQueryOptions } from '@/lib/api/generated/catalog/catalog'
import { fetchBenchmarkSuite } from '@/lib/benchmarks/server'
import { getQueryClient } from '@/lib/query/client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Submit benchmark results',
  robots: { index: false, follow: false },
}

export default async function SubmitBenchmarkPage({
  params,
}: PageProps<'/benchmarks/[suite]/submit'>) {
  const { suite } = await params
  const session = await auth()
  if (!session || session.error) redirect(`/auth/signin?callbackUrl=/benchmarks/${suite}/submit`)

  const data = await fetchBenchmarkSuite(suite, SUBMIT_SUITE_PARAMS)
  if (!data) notFound()

  const queryClient = getQueryClient()
  queryClient.setQueryData(getGetBenchmarkSuiteQueryKey(suite, SUBMIT_SUITE_PARAMS), data)
  await queryClient.prefetchQuery(getListToolsQueryOptions(SUBMIT_TOOL_PARAMS))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <header className="max-w-2xl space-y-2">
          <h1 className="text-2xl font-semibold">Submit {data.name} results</h1>
          <p className="text-muted-foreground">
            Download the cases, run them through the tool, and upload exactly what it hands back. We
            score every file ourselves; an editor reviews the result before it is published,
            credited to you.
          </p>
        </header>
        <SubmitResults suite={suite} />
        <CliPublishCard />
      </div>
    </HydrationBoundary>
  )
}
