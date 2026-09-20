import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { CatalogLede } from '@/features/catalog/catalog-lede'
import { ToolExplorer } from '@/features/catalog/tool-explorer'
import {
  getGetCatalogStatsQueryOptions,
  getListFacetsQueryOptions,
  getListToolsQueryKey,
  getListToolsQueryOptions,
} from '@/lib/api/generated/catalog/catalog'
import { canonicalMetadata } from '@/lib/seo/canonical'
import type { ToolPageOut } from '@/lib/api/generated/model'
import { hasActiveFilters, parseToolFilters } from '@/lib/catalog/filters'
import { clientEnv } from '@/lib/env'
import { getQueryClient } from '@/lib/query/client'
import { collectionPageJsonLd, combineJsonLd, itemListJsonLd } from '@/lib/seo/json-ld'

// Rendered per request rather than at build. The frontend image is built with no
// backend reachable (see .github/workflows/ci.yml), so anything prerendered here
// would bake an empty catalog into the bundle - or fail the build outright.
export const dynamic = 'force-dynamic'

/**
 * The hub says four different things about itself, on purpose.
 *
 * The heading is what a reader sees and what the `CollectionPage` is named
 * after, so it describes the axes the catalog actually compares on. The meta
 * title and description are written for the query space - "pdf redaction
 * software" and the capability words around it - and have to survive being cut
 * at roughly 60 and 158 characters. The share card gets its own shorter pair,
 * because a title tuned for a search result reads badly on a card.
 */
const HUB_HEADING =
  'Compare redaction software by price, detection methods, deployment, privacy features, and capabilities.'

const HUB_META_TITLE = 'PDF Redaction Tools & Software Comparison | Redaction Tools'

const HUB_META_DESCRIPTION =
  'Find and compare PDF redaction software for PII detection, OCR, local and cloud processing, metadata removal, privacy, and secure document redaction.'

const HUB_OG_TITLE = 'Redaction Tools — Compare PDF Redaction Software'

const HUB_OG_DESCRIPTION =
  'Discover and compare redaction software by capabilities, pricing, OCR, PII detection, deployment, and privacy features.'

export async function generateMetadata({ searchParams }: PageProps<'/'>): Promise<Metadata> {
  const filters = parseToolFilters(await searchParams)
  const filtered = hasActiveFilters(filters)

  return {
    // `absolute` bypasses the '%s · Redaction Tools' template: this title
    // already carries the brand, and the template would repeat it.
    title: { absolute: HUB_META_TITLE },
    description: HUB_META_DESCRIPTION,
    ...canonicalMetadata('/', {
      socialTitle: HUB_OG_TITLE,
      socialDescription: HUB_OG_DESCRIPTION,
    }),
    // A filtered view is the same set of tools sliced differently, so it is
    // followed but never indexed; the canonical points back at the whole hub.
    robots: filtered ? { index: false, follow: true } : undefined,
  }
}

export default async function HubPage({ searchParams }: PageProps<'/'>) {
  const filters = parseToolFilters(await searchParams)
  const queryClient = getQueryClient()
  const site = clientEnv.NEXT_PUBLIC_SITE_URL

  await Promise.all([
    queryClient.prefetchQuery(getListToolsQueryOptions(filters)),
    queryClient.prefetchQuery(getListFacetsQueryOptions()),
    queryClient.prefetchQuery(getGetCatalogStatsQueryOptions()),
  ])

  // Read back what was prefetched rather than fetching twice. `prefetchQuery`
  // swallows its own errors, so an API outage leaves this undefined and the
  // page degrades to no structured data rather than to a 500.
  const tools = queryClient.getQueryData<ToolPageOut>(getListToolsQueryKey(filters))?.items ?? []

  // Only the unfiltered hub defines the catalog. A filtered view is `noindex`
  // and shows a different subset, so letting it claim the same `@id` with a
  // different item list is the duplicate-entity error in a new costume.
  //
  // `numberOfItems` counts what is actually enumerated below, not the total
  // matching the filter - the two are equal at seven tools and diverge past one
  // page, and a list of 50 inside a count of 300 is a contradiction.
  const jsonLd =
    !hasActiveFilters(filters) && tools.length
      ? combineJsonLd([
          collectionPageJsonLd(site, {
            name: HUB_HEADING,
            description: HUB_META_DESCRIPTION,
            numberOfItems: tools.length,
          }),
          itemListJsonLd(site, tools),
        ])
      : null

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      ) : null}
      <header className="mb-8 space-y-4 md:mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {HUB_HEADING}
        </h1>
        <CatalogLede />
      </header>
      <ToolExplorer filters={filters} />
    </HydrationBoundary>
  )
}
