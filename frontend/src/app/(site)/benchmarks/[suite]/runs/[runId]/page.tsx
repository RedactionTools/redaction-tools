import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RunReportView } from '@/features/benchmarks/run-report-view'
import { getGetBenchmarkRunQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import { fetchBenchmarkRun } from '@/lib/benchmarks/server'
import { getQueryClient } from '@/lib/query/client'
import { canonicalMetadata } from '@/lib/seo/canonical'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: PageProps<'/benchmarks/[suite]/runs/[runId]'>): Promise<Metadata> {
  const { suite, runId } = await params
  const run = await fetchBenchmarkRun(runId)
  if (!run) return { title: 'Run not found' }
  return {
    title: `${run.tool.name} on ${run.case_id}`,
    description: `One scored run of ${run.tool.name} in the ${suite.toUpperCase()} benchmark: every layer, the overlay and the redacted file.`,
    ...canonicalMetadata(`/benchmarks/${suite}/runs/${runId}`),
    // A run is evidence behind the tool report, which is the page worth ranking.
    robots: { index: false, follow: true },
  }
}

export default async function BenchmarkRunPage({
  params,
}: PageProps<'/benchmarks/[suite]/runs/[runId]'>) {
  const { suite, runId } = await params
  const run = await fetchBenchmarkRun(runId)
  if (!run) notFound()

  const queryClient = getQueryClient()
  queryClient.setQueryData(getGetBenchmarkRunQueryKey(runId), run)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RunReportView suite={suite} runId={runId} />
    </HydrationBoundary>
  )
}
