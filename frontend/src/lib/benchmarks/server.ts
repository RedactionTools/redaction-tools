import { cache } from 'react'

import { ApiError } from '@/lib/api/api-error'
import {
  getBenchmarkCase,
  getBenchmarkRun,
  getBenchmarkSuite,
  getBenchmarkToolReport,
  listBenchmarkSuites,
} from '@/lib/api/generated/benchmarks/benchmarks'
import type {
  CaseDetailOut,
  GetBenchmarkCaseParams,
  RunDetailOut,
  SuiteOut,
  ToolReportOut,
} from '@/lib/api/generated/model'

import type { BenchmarkParams } from './params'

/**
 * Server-side reads for the benchmark pages, each null on a 404 so the page can call
 * `notFound()`, and rethrowing anything else - a benchmark page that renders empty
 * during an outage would read as "no results", which is a claim.
 *
 * Each is wrapped in React's `cache` so `generateMetadata` and the page body share one
 * request (the fetch mutator is `no-store`, so Next does not dedupe it).
 */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export const fetchBenchmarkSuite = cache(
  (suite: string, params: BenchmarkParams): Promise<SuiteOut | null> =>
    orNull(getBenchmarkSuite(suite, params)),
)

export const fetchBenchmarkCase = cache(
  (suite: string, caseId: string, params: GetBenchmarkCaseParams): Promise<CaseDetailOut | null> =>
    orNull(getBenchmarkCase(suite, caseId, params)),
)

export const fetchBenchmarkToolReport = cache(
  (suite: string, slug: string, params: BenchmarkParams): Promise<ToolReportOut | null> =>
    orNull(getBenchmarkToolReport(suite, slug, params)),
)

export const fetchBenchmarkRun = cache((runId: string): Promise<RunDetailOut | null> =>
  orNull(getBenchmarkRun(runId)),
)

/**
 * Every public benchmark path, for the sitemap: suites, their current cases and the
 * tools on their current leaderboard. Swallows failures the way `fetchAllTools` does -
 * a crawler is better served the static routes than a 500.
 */
export async function fetchBenchmarkPaths(): Promise<string[]> {
  try {
    const suites = await listBenchmarkSuites()
    const paths = ['/benchmarks']
    for (const summary of suites) {
      const suite = await getBenchmarkSuite(summary.slug, { scope: 'all' })
      paths.push(`/benchmarks/${suite.slug}`)
      paths.push(...suite.cases.map((c) => `/benchmarks/${suite.slug}/cases/${c.case_id}`))
      paths.push(
        ...suite.leaderboard
          .filter((row) => row.tool.listable)
          .map((row) => `/benchmarks/${suite.slug}/tools/${row.tool.slug}`),
      )
    }
    return [...new Set(paths)]
  } catch {
    return ['/benchmarks']
  }
}
