import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ToolReportView } from '@/features/benchmarks/tool-report-view'
import { getGetBenchmarkToolReportQueryKey } from '@/lib/api/generated/benchmarks/benchmarks'
import { formatRate } from '@/lib/benchmarks/format'
import { parseBenchmarkParams } from '@/lib/benchmarks/params'
import { fetchBenchmarkToolReport } from '@/lib/benchmarks/server'
import { getQueryClient } from '@/lib/query/client'
import { canonicalMetadata } from '@/lib/seo/canonical'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<'/benchmarks/[suite]/tools/[slug]'>): Promise<Metadata> {
  const { suite, slug } = await params
  const query = parseBenchmarkParams(await searchParams)
  const report = await fetchBenchmarkToolReport(suite, slug, query)
  if (!report) return { title: 'No benchmark results' }
  const headline = report.surfaces[0]?.summary
  return {
    title: `${report.tool.name} redaction benchmark — ${headline ? formatRate(headline.leak_rate) : ''} leak rate`,
    description: `How many sensitive values ${report.tool.name} leaves recoverable in our ${suite.toUpperCase()} benchmark ${report.revision}, by layer, category and case, with overlays.`,
    ...canonicalMetadata(`/benchmarks/${suite}/tools/${slug}`),
    robots: query.revision || query.scope !== 'all' ? { index: false, follow: true } : undefined,
  }
}

export default async function BenchmarkToolPage({
  params,
  searchParams,
}: PageProps<'/benchmarks/[suite]/tools/[slug]'>) {
  const { suite, slug } = await params
  const query = parseBenchmarkParams(await searchParams)
  const report = await fetchBenchmarkToolReport(suite, slug, query)
  if (!report) notFound()

  const queryClient = getQueryClient()
  queryClient.setQueryData(getGetBenchmarkToolReportQueryKey(suite, slug, query), report)

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ToolReportView suite={suite} slug={slug} params={query} />
    </HydrationBoundary>
  )
}
