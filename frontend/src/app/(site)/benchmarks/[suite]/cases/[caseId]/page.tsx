import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CaseView } from '@/features/benchmarks/case-view'
import { getGetBenchmarkCaseQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import type { GetBenchmarkCaseParams } from '@/lib/api/generated/model'
import { parseBenchmarkParams } from '@/lib/benchmarks/params'
import { fetchBenchmarkCase } from '@/lib/benchmarks/server'
import { getQueryClient } from '@/lib/query/client'
import { canonicalMetadata } from '@/lib/seo/canonical'

export const dynamic = 'force-dynamic'

async function caseParams(
  searchParams: PageProps<'/benchmarks/[suite]/cases/[caseId]'>['searchParams'],
) {
  const { revision } = parseBenchmarkParams(await searchParams)
  return (revision ? { revision } : {}) satisfies GetBenchmarkCaseParams
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/benchmarks/[suite]/cases/[caseId]'>): Promise<Metadata> {
  const { suite, caseId } = await params
  const data = await fetchBenchmarkCase(suite, caseId, await caseParams(searchParams))
  if (!data) return { title: 'Case not found' }
  return {
    title: `Benchmark case ${data.case_id}`,
    description: `A synthetic ${data.family} document with ${data.probe_count} planted values, and how each redaction tool handled it.`,
    ...canonicalMetadata(`/benchmarks/${suite}/cases/${caseId}`),
  }
}

export default async function BenchmarkCasePage({
  params,
  searchParams,
}: PageProps<'/benchmarks/[suite]/cases/[caseId]'>) {
  const { suite, caseId } = await params
  const query = await caseParams(searchParams)
  const data = await fetchBenchmarkCase(suite, caseId, query)
  if (!data) notFound()

  const queryClient = getQueryClient()
  queryClient.setQueryData(getGetBenchmarkCaseQueryKey(suite, caseId, query), data)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CaseView suite={suite} caseId={caseId} params={query} />
    </HydrationBoundary>
  )
}
