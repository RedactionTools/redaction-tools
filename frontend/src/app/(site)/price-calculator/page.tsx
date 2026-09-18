import { HydrationBoundary, dehydrate } from '@tanstack/react-query'
import type { Metadata } from 'next'

import { PriceCalculator } from '@/features/catalog/price-calculator'
import {
  getGetToolQueryOptions,
  getListToolsQueryOptions,
} from '@/lib/api/generated/catalog/catalog'
import { getQueryClient } from '@/lib/query/client'

// Per-request, like the hub and the profiles: `next build` runs with no backend
// reachable, so a prerendered page would ship an empty tool picker.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Redaction price calculator — what your documents actually cost',
  description:
    'Set how many documents you redact and how long they are, and see what that costs on every plan of any tool in the catalog, including the per-page rate it works out to.',
  alternates: { canonical: '/price-calculator' },
}

function selectedTool(params: Record<string, string | string[] | undefined>): string | undefined {
  const value = params.tool
  const slug = Array.isArray(value) ? value[0] : value
  return slug || undefined
}

export default async function PriceCalculatorPage({
  searchParams,
}: PageProps<'/price-calculator'>) {
  const slug = selectedTool(await searchParams)
  const queryClient = getQueryClient()

  await Promise.all([
    queryClient.prefetchQuery(getListToolsQueryOptions({ page_size: 100 })),
    ...(slug ? [queryClient.prefetchQuery(getGetToolQueryOptions(slug))] : []),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="max-w-3xl space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            Redaction price calculator
          </h1>
          <p className="text-muted-foreground text-pretty">
            Vendors price redaction in units that do not compare — per page, per document, per seat
            per month. Tell us your volume and the arithmetic is done against each plan&apos;s
            published rate, so the number rests on your figures rather than an assumed one.
          </p>
        </header>

        <PriceCalculator slug={slug} />
      </div>
    </HydrationBoundary>
  )
}
