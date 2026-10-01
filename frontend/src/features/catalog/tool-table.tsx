'use client'

import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { useListTools } from '@/lib/api/generated/catalog/catalog'
import { cheapestCost, type DocumentInput } from '@/lib/catalog/document-cost'
import type { CatalogFilters } from '@/lib/catalog/filters'
import { formatCost, priceHeadline } from '@/lib/catalog/format'

import { MethodIcons, MethodLegend } from './method-icons'
import { PriceProvenanceBadge } from './price-provenance-badge'
import { ToolLogo } from './tool-logo'
import { VendorMaintainedBadge } from './vendor-maintained-badge'

/**
 * The month every row is costed at: 100 ten-page documents, 1,000 pages.
 *
 * One fixed volume, because a "from" price is the cheapest plan's fee rather
 * than what anyone's month costs - a per-page rate and a flat subscription
 * cannot be ranked by it. Big enough that a free tier's allowance does not
 * answer it for everyone, small enough to be a real team's month.
 */
export const HUB_VOLUME: DocumentInput = { documents: 100, pagesPerDocument: 10 }

const NOTE_ID = 'volume-cost-note'

export function ToolTable({ filters }: { filters: CatalogFilters }) {
  const { data, isPending } = useListTools(filters)

  if (isPending || !data) {
    return (
      <div className="space-y-2" data-testid="tool-table-skeleton">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (data.items.length === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center">
        No tools match these filters. Try removing one.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <Table>
        <TableCaption>
          {data.count} redaction tools, with prices as last verified. Sorted by entry price.
        </TableCaption>
        <TableHead>
          <TableRow>
            <TableHeader>Tool</TableHeader>
            <TableHeader>Media</TableHeader>
            <TableHeader>Method</TableHeader>
            <TableHeader>From</TableHeader>
            <TableHeader aria-describedby={NOTE_ID}>
              {/* A button so the hint reaches the keyboard too; the dotted
                  underline is the usual "there is more here" cue. */}
              <Tooltip content="100 documents × 10 pages, every month">
                <button
                  type="button"
                  className="cursor-help underline decoration-dotted underline-offset-4"
                >
                  1,000 pages<span aria-hidden="true">*</span>
                </button>
              </Tooltip>
            </TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.items.map((tool) => (
            <TableRow key={tool.slug} data-testid={`tool-row-${tool.slug}`}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <ToolLogo name={tool.name} logoUrl={tool.logo_url} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/tool/${tool.slug}`} className="font-medium hover:underline">
                        {tool.name}
                      </Link>
                      {tool.is_vendor_maintained ? (
                        <VendorMaintainedBadge vendor={tool.vendor.name} />
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">{tool.vendor.name}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground" label="Media">
                {tool.facet_slugs.filter((slug) => MEDIA.has(slug)).join(', ') || '—'}
              </TableCell>
              <TableCell label="Method">
                <MethodIcons slug={tool.slug} facetSlugs={tool.facet_slugs} />
              </TableCell>
              <TableCell label="From">
                <span className="flex flex-wrap items-center gap-2">
                  {priceHeadline(tool.price_summary)}
                  <PriceProvenanceBadge summary={tool.price_summary} slug={tool.slug} />
                </span>
                {tool.price_summary.is_trial && tool.price_summary.trial_days ? (
                  <Badge className="mt-1" tone="neutral">
                    {tool.price_summary.trial_days}-day trial
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell label="1,000 pages">
                <VolumeCost slug={tool.slug} cost={cheapestCost(tool.plans, HUB_VOLUME)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <MethodLegend />
      <VolumeCostNote />
    </div>
  )
}

function VolumeCost({ slug, cost }: { slug: string; cost: ReturnType<typeof cheapestCost> }) {
  if (!cost) {
    return (
      <span className="text-muted-foreground" data-testid={`volume-cost-${slug}`}>
        —
      </span>
    )
  }

  return (
    <span className="block" data-testid={`volume-cost-${slug}`}>
      <span className="font-medium">{formatCost(cost.total, cost.currency)}</span>
      <span className="text-muted-foreground text-xs"> / month</span>
      <span className="text-muted-foreground block text-xs">
        {cost.plan} · {formatCost(cost.perPage, cost.currency)} per page
      </span>
    </span>
  )
}

/**
 * What the 1,000-pages column is, and what it leaves out.
 *
 * The column is our arithmetic on the vendors' figures, not a price anyone
 * published, so it has to say how it was done - and send a reader whose month
 * is not 1,000 pages to the calculator that prices theirs.
 */
function VolumeCostNote() {
  return (
    <div
      id={NOTE_ID}
      className="text-muted-foreground space-y-1 text-xs text-pretty"
      data-testid="volume-cost-note"
    >
      <p>
        * What 1,000 pages a month - 100 documents of 10 pages - cost on each tool&apos;s cheapest
        public plan that can take them. Per-page and per-document rates are multiplied out, a
        plan&apos;s published overage rate is charged past its allowance, and a flat monthly fee
        counts in full however little of it the month uses.
      </p>
      <p>
        Left out: annual and per-seat fees (turning either into one month needs a figure no vendor
        published), quote-only plans, and plans whose caps stop short of the volume. A dash means no
        plan could be costed. Figures are in the vendor&apos;s own currency, before tax.
      </p>
      <p>
        Not your volume?{' '}
        <Link href="/price-calculator" className="text-foreground underline">
          Price your own month in the calculator
        </Link>
        .
      </p>
    </div>
  )
}

const MEDIA = new Set(['pdf', 'image', 'video', 'audio', 'text'])
