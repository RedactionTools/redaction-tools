import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { CatalogLede } from '@/features/catalog/catalog-lede'
import { ToolExplorer } from '@/features/catalog/tool-explorer'
import {
  getGetCatalogStatsQueryOptions,
  getListFacetsQueryOptions,
  getListToolsQueryOptions,
} from '@/lib/api/generated/catalog/catalog'
import { hasActiveFilters, parseToolFilters } from '@/lib/catalog/filters'
import { getQueryClient } from '@/lib/query/client'

// Rendered per request rather than at build. The frontend image is built with no
// backend reachable (see .github/workflows/ci.yml), so anything prerendered here
// would bake an empty catalog into the bundle - or fail the build outright.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ searchParams }: PageProps<'/'>): Promise<Metadata> {
  const filters = parseToolFilters(await searchParams)
  const filtered = hasActiveFilters(filters)

  return {
    title: { absolute: 'Redaction tools compared by price, media and method' },
    description:
      'A catalog of redaction tools for PDF, image, video and audio, with prices we verify and record the source of.',
    alternates: { canonical: '/' },
    // A filtered view is the same set of tools sliced differently, so it is
    // followed but never indexed; the canonical points back at the whole hub.
    robots: filtered ? { index: false, follow: true } : undefined,
  }
}

export default async function HubPage({ searchParams }: PageProps<'/'>) {
  const filters = parseToolFilters(await searchParams)
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery(getListToolsQueryOptions(filters)),
    queryClient.prefetchQuery(getListFacetsQueryOptions()),
    queryClient.prefetchQuery(getGetCatalogStatsQueryOptions()),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <header className="mb-10 space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Redaction tools compared
        </h1>
        <CatalogLede />
      </header>
      <ToolExplorer filters={filters} />
    </HydrationBoundary>
  )
}
