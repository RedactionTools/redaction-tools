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
import { useListFacets, useListTools } from '@/lib/api/generated/catalog/catalog'
import type { PriceSummaryOut } from '@/lib/api/generated/model'
import { cheapestCost, type DocumentInput } from '@/lib/catalog/document-cost'
import type { CatalogFilters } from '@/lib/catalog/filters'
import { formatCost, priceParts } from '@/lib/catalog/format'
import { PROVENANCE } from '@/lib/catalog/provenance'
import { cn } from '@/lib/utils'

import { MethodIcons, MethodLegend } from './method-icons'
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
    <div className="space-y-4">
      {/* One working surface at desktop widths. Below `md` every row is
          already its own card, and a card inside a card is just a border. */}
      <div className="md:bg-surface md:border-border md:shadow-surface md:rounded-xl md:border md:px-3 md:pt-4 md:pb-1">
        <Table>
          <TableCaption className="md:px-3">
            {data.count} redaction tools, with prices as last verified.
          </TableCaption>
          <TableHead>
            <TableRow>
              <TableHeader className={HEADER}>Tool</TableHeader>
              <TableHeader className={cn(HEADER, 'w-32')}>Covers</TableHeader>
              <TableHeader className={cn(HEADER, 'w-44')}>From</TableHeader>
              <TableHeader className={cn(HEADER, 'w-36 text-right')} aria-describedby={NOTE_ID}>
                {/* A button so the hint reaches the keyboard too; the dotted
                  underline is the usual "there is more here" cue. */}
                <Tooltip content="100 documents × 10 pages, every month">
                  <button
                    type="button"
                    className="cursor-help whitespace-nowrap underline decoration-dotted underline-offset-4"
                  >
                    1,000 pages<span aria-hidden="true">*</span>
                  </button>
                </Tooltip>
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.items.map((tool) => (
              <TableRow
                key={tool.slug}
                data-testid={`tool-row-${tool.slug}`}
                className="md:hover:bg-muted/40 transition-colors"
              >
                <TableCell className="md:py-4">
                  <div className="flex items-center gap-4">
                    {/* The same page as the name, for the pointer only: a second
                      link per row would make a keyboard tab through every tool twice. */}
                    <Link
                      href={`/tool/${tool.slug}`}
                      tabIndex={-1}
                      aria-hidden="true"
                      // One tile for every logo, so the names line up down the
                      // column however wide a vendor's wordmark runs.
                      className="ring-border flex h-11 w-24 shrink-0 items-center justify-center rounded-lg bg-white ring-1"
                    >
                      <ToolLogo
                        name={tool.name}
                        logoUrl={tool.logo_url}
                        size="tile"
                        className="p-0"
                      />
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={`/tool/${tool.slug}`}
                        className="text-[15px] font-semibold tracking-tight hover:underline"
                      >
                        {tool.name}
                      </Link>
                      <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                        <span>{tool.vendor.name}</span>
                        {tool.is_vendor_maintained ? (
                          <VendorMaintainedBadge vendor={tool.vendor.name} compact />
                        ) : null}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell label="Covers" className="md:py-4">
                  <div
                    className="space-y-2 max-md:flex max-md:items-center max-md:gap-3 max-md:space-y-0"
                    data-testid={`covers-${tool.slug}`}
                  >
                    <MediaChips facetSlugs={tool.facet_slugs} />
                    <MethodIcons slug={tool.slug} facetSlugs={tool.facet_slugs} />
                  </div>
                </TableCell>
                <TableCell label="From" className="md:py-4">
                  <div className="max-md:text-right">
                    <EntryPrice slug={tool.slug} summary={tool.price_summary} />
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 max-md:justify-end">
                      {tool.price_summary.is_trial && tool.price_summary.trial_days ? (
                        <Badge tone="neutral">{tool.price_summary.trial_days}-day trial</Badge>
                      ) : null}
                      <PriceProvenanceNote summary={tool.price_summary} slug={tool.slug} />
                    </div>
                  </div>
                </TableCell>
                <TableCell label="1,000 pages" className="md:py-4 md:text-right">
                  <VolumeCost slug={tool.slug} cost={cheapestCost(tool.plans, HUB_VOLUME)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <MethodLegend />
      <VolumeCostNote />
    </div>
  )
}

const HEADER = 'text-xs font-medium'

/**
 * Media as chips, in the taxonomy's order rather than whatever order the row carries.
 *
 * Read from the facets endpoint, which the hub prefetches beside the list, so a
 * medium staff add in the admin shows up without a deploy.
 */
function MediaChips({ facetSlugs }: { facetSlugs: string[] }) {
  const { data } = useListFacets()
  const taxonomy = data?.find((dimension) => dimension.code === 'media')?.values ?? []
  const media = taxonomy.filter((medium) => facetSlugs.includes(medium.slug))
  if (!media.length) return <span className="text-muted-foreground">—</span>
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Media">
      {media.map((medium) => (
        <li
          key={medium.slug}
          className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[11px] font-medium"
        >
          {medium.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * The entry price set as a figure: the amount large, the words around it small.
 * The parts are spaced so the cell still reads, and copies, as the headline.
 */
function EntryPrice({ slug, summary }: { slug: string; summary: PriceSummaryOut }) {
  const { lead, amount, unit } = priceParts(summary)
  return (
    <div data-testid={`price-${slug}`}>
      {lead ? <span className="text-muted-foreground block text-xs">{lead}</span> : null}{' '}
      <span
        className={cn(
          'tabular-nums',
          unit ? 'text-base font-semibold tracking-tight' : 'text-sm font-medium',
        )}
      >
        {amount}
      </span>
      {unit ? (
        <>
          {' '}
          <span className="text-muted-foreground text-xs whitespace-nowrap">{unit}</span>
        </>
      ) : null}
    </div>
  )
}

/**
 * Where the price came from, as a quiet line rather than a pill: the short word
 * and the date in view, the full disclosure as its name and on hover.
 */
function PriceProvenanceNote({ summary, slug }: { summary: PriceSummaryOut; slug: string }) {
  const treatment = summary.source ? PROVENANCE[summary.source] : undefined
  if (!treatment) return null
  const date = summary.last_verified_at
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(summary.last_verified_at),
      )
    : null
  const full = date ? `${treatment.label} on ${date}` : treatment.label
  return (
    <Tooltip content={full}>
      <span
        tabIndex={0}
        aria-label={full}
        data-testid={`provenance-${slug}`}
        className={cn(
          'cursor-help text-[11px] whitespace-nowrap',
          treatment.tone === 'warn' ? 'text-warn' : 'text-muted-foreground',
        )}
      >
        {treatment.short}
        {date ? ` · ${date}` : null}
      </span>
    </Tooltip>
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
      <span className="whitespace-nowrap">
        <span className="text-base font-semibold tracking-tight tabular-nums">
          {formatCost(cost.total, cost.currency)}
        </span>
        <span className="text-muted-foreground text-xs"> / month</span>
      </span>
      <span className="text-muted-foreground mt-0.5 block text-xs">
        {cost.plan} ·{' '}
        <span className="whitespace-nowrap tabular-nums">
          {formatCost(cost.perPage, cost.currency)} per page
        </span>
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
