import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BenchmarkSuiteView } from '@/features/benchmarks/benchmark-suite-view'
import { getGetBenchmarkSuiteQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import { parseBenchmarkParams } from '@/lib/benchmarks/params'
import { fetchBenchmarkSuite } from '@/lib/benchmarks/server'
import { clientEnv } from '@/lib/env'
import { getQueryClient } from '@/lib/query/client'
import { canonicalMetadata } from '@/lib/seo/canonical'
import { benchmarkDatasetJsonLd, breadcrumbJsonLd, combineJsonLd } from '@/lib/seo/json-ld'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/benchmarks/[suite]'>): Promise<Metadata> {
  const { suite } = await params
  const query = parseBenchmarkParams(await searchParams)
  const data = await fetchBenchmarkSuite(suite, query)
  if (!data) return { title: 'Benchmark not found' }
  return {
    title: `${data.name} benchmark ${data.revision.revision} — leak rates by tool`,
    description: `${data.leaderboard.length} redaction tools scored on ${data.cases.length} synthetic cases: how many sensitive values each leaves recoverable, with 95% intervals.`,
    ...canonicalMetadata(`/benchmarks/${suite}`),
    // Another revision or the verified-only view is the same page sliced differently.
    robots: query.revision || query.scope !== 'all' ? { index: false, follow: true } : undefined,
  }
}

export default async function BenchmarkSuitePage({
  params,
  searchParams,
}: PageProps<'/benchmarks/[suite]'>) {
  const { suite } = await params
  const query = parseBenchmarkParams(await searchParams)
  const data = await fetchBenchmarkSuite(suite, query)
  if (!data) notFound()

  const queryClient = getQueryClient()
  queryClient.setQueryData(getGetBenchmarkSuiteQueryKey(suite, query), data)

  const site = clientEnv.NEXT_PUBLIC_SITE_URL
  const jsonLd = combineJsonLd([
    benchmarkDatasetJsonLd(site, {
      slug: data.slug,
      name: data.name,
      description: data.description_md,
      revision: data.revision.revision,
      casePackUrl: data.revision.case_pack_url,
      tools: data.leaderboard.filter((row) => row.tool.listable).map((row) => row.tool),
    }),
    breadcrumbJsonLd(site, [
      { name: 'Benchmarks', url: `${site}/benchmarks` },
      { name: data.name, url: `${site}/benchmarks/${suite}` },
    ]),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <BenchmarkSuiteView suite={suite} params={query} />
    </HydrationBoundary>
  )
}
