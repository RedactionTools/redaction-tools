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
import { useListTools } from '@/lib/api/generated/catalog/catalog'
import type { CatalogFilters } from '@/lib/catalog/filters'
import { priceHeadline } from '@/lib/catalog/format'

import { PriceProvenanceBadge } from './price-provenance-badge'
import { ToolLogo } from './tool-logo'

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
    <Table>
      <TableCaption>
        {data.count} redaction tools, with prices as last verified. Sorted by entry price.
      </TableCaption>
      <TableHead>
        <TableRow>
          <TableHeader>Tool</TableHeader>
          <TableHeader>Media</TableHeader>
          <TableHeader>From</TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {data.items.map((tool) => (
          <TableRow key={tool.slug} data-testid={`tool-row-${tool.slug}`}>
            <TableCell>
              <div className="flex items-center gap-3">
                <ToolLogo name={tool.name} logoUrl={tool.logo_url} />
                <div>
                  <Link href={`/tool/${tool.slug}`} className="font-medium hover:underline">
                    {tool.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">{tool.vendor.name}</p>
                </div>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {tool.facet_slugs.filter((slug) => MEDIA.has(slug)).join(', ') || '—'}
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-2">
                {priceHeadline(tool.price_summary)}
                <PriceProvenanceBadge summary={tool.price_summary} slug={tool.slug} />
              </span>
              {tool.price_summary.is_trial && tool.price_summary.trial_days ? (
                <Badge className="mt-1" tone="neutral">
                  {tool.price_summary.trial_days}-day trial
                </Badge>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const MEDIA = new Set(['pdf', 'image', 'video', 'audio', 'text'])
