'use client'

import { useGetCatalogStats } from '@/lib/api/generated/catalog/catalog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount } from '@/lib/catalog/format'

/**
 * The first 60 words of the hub: one standalone factual paragraph carrying a
 * count, a date and a price range.
 *
 * It is generated from the same numbers the table renders rather than written by
 * hand, so it cannot drift from the catalog it describes - which is the whole
 * reason a model or a reader can trust it.
 */
export function CatalogLede() {
  const { data, isPending } = useGetCatalogStats()

  if (isPending || !data) {
    return <Skeleton className="h-12 w-full max-w-2xl" data-testid="catalog-lede-skeleton" />
  }

  const asOf = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(data.generated_at))

  const media = data.media.slice(0, 3).join(', ')
  // No unit is claimed for the range: the cheapest figure may be per month and
  // the dearest per seat per month, and flattening the two into "per month" is
  // precisely the conflation this catalog exists to avoid.
  const range =
    data.cheapest_amount && data.dearest_amount
      ? ` Published entry prices run from ${formatAmount(data.cheapest_amount, data.currency)} to ${formatAmount(data.dearest_amount, data.currency)}.`
      : ''
  const freeTier =
    data.with_free_tier > 0 ? ` ${data.with_free_tier} have a genuine free tier.` : ''

  return (
    <p className="text-muted-foreground max-w-2xl text-pretty" data-testid="catalog-lede">
      As of {asOf} this catalog tracks {data.tools} redaction tools across {media} and more.
      {freeTier}
      {range}
    </p>
  )
}
