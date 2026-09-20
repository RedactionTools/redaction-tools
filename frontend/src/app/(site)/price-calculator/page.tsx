import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { PriceCalculator } from '@/features/catalog/price-calculator'
import {
  getGetToolQueryOptions,
  getListToolsQueryOptions,
} from '@/lib/api/generated/catalog/catalog'
import { canonicalMetadata } from '@/lib/seo/canonical'
import { toolSlugs } from '@/lib/catalog/calculator-tools'
import { clientEnv } from '@/lib/env'
import { getQueryClient } from '@/lib/query/client'
import { breadcrumbJsonLd, combineJsonLd } from '@/lib/seo/json-ld'

// Per-request, like the hub and the profiles: `next build` runs with no backend
// reachable, so a prerendered page would ship an empty tool picker.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  searchParams,
}: PageProps<'/price-calculator'>): Promise<Metadata> {
  const slugs = toolSlugs(await searchParams)

  return {
    title: 'Redaction price calculator — what your documents actually cost',
    description:
      'Set how many documents you redact and how long they are, and see what that costs on every plan of any tool in the catalog — several at once, side by side, including the per-page rate each works out to.',
    ...canonicalMetadata('/price-calculator'),
    // The same rule the hub applies to its facets. `robots.ts` only disallows a
    // query string on the root path, so `?tool=a&tool=b` is otherwise a fully
    // crawlable near-duplicate of this page for every combination anyone links.
    robots: slugs.length ? { index: false, follow: true } : undefined,
  }
}

export default async function PriceCalculatorPage({
  searchParams,
}: PageProps<'/price-calculator'>) {
  const slugs = toolSlugs(await searchParams)
  const queryClient = getQueryClient()
  const site = clientEnv.NEXT_PUBLIC_SITE_URL

  await Promise.all([
    queryClient.prefetchQuery(getListToolsQueryOptions({ page_size: 100 })),
    ...slugs.map((slug) => queryClient.prefetchQuery(getGetToolQueryOptions(slug))),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: combineJsonLd([
            breadcrumbJsonLd(site, [
              { name: 'Redaction tools', url: `${site}/` },
              { name: 'Price calculator', url: `${site}/price-calculator` },
            ]),
          ]),
        }}
      />
      <div className="space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Redaction price calculator
          </h1>
          <p className="text-muted-foreground text-pretty">
            Vendors price redaction in units that do not compare — per page, per document, per seat
            per month. Tell us your volume and the arithmetic is done against each plan&apos;s
            published rate, so the number rests on your figures rather than an assumed one. Add as
            many tools as you are weighing up and they are costed in one table, against each other.
          </p>
        </header>

        <PriceCalculator slugs={slugs} />
      </div>
    </HydrationBoundary>
  )
}
