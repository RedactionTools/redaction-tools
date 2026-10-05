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
  searchParams,
}: PageProps<'/benchmarks/[suite]/submit'>) {
  const { suite } = await params
  // Set by the tool page's "Submit results": the form opens with that tool chosen.
  const { tool } = await searchParams
  const initialTool = typeof tool === 'string' ? tool : undefined
  const session = await auth()
  if (!session || session.error) {
    // The tool survives sign-in, so the reader lands back on the form they asked for.
    const back = `/benchmarks/${suite}/submit${initialTool ? `?tool=${encodeURIComponent(initialTool)}` : ''}`
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(back)}`)
  }

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
        <SubmitResults suite={suite} initialTool={initialTool} />
        <CliPublishCard />
      </div>
    </HydrationBoundary>
  )
}
