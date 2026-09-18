'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetTool, useListTools } from '@/lib/api/generated/catalog/catalog'

import {
  DEFAULT_VOLUME,
  DocumentCostCalculator,
  VolumeFields,
  type Volume,
  volumeInput,
} from './document-cost-calculator'
import { ExampleCostPreview } from './example-cost-preview'

/**
 * The catalog-wide cost calculator.
 *
 * The same arithmetic as the one on a tool profile, reached without knowing
 * which tool you want yet. Nothing is preselected: this catalog carries a
 * first-party listing, and defaulting the page to it would be a recommendation
 * dressed as a default.
 *
 * The volume lives here rather than in the table, so it can be answered before
 * a tool is chosen and survives choosing one - and so the worked example has a
 * volume to price while the reader is still deciding.
 */
export function PriceCalculator({ slug }: { slug?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [volume, setVolume] = useState<Volume>(DEFAULT_VOLUME)

  const { data: page, isPending } = useListTools({ page_size: 100 })
  const { data: tool, isPending: toolPending } = useGetTool(slug ?? '', {
    query: { enabled: Boolean(slug) },
  })

  if (isPending || !page) {
    return <Skeleton className="h-64 w-full" data-testid="price-calculator-skeleton" />
  }

  return (
    <div className="space-y-8" data-testid="price-calculator">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Your volume</h2>
        <VolumeFields volume={volume} onChange={setVolume} />
      </section>

      <div className="max-w-sm space-y-1">
        <label className="text-muted-foreground text-sm" htmlFor="calculator-tool">
          Tool
        </label>
        <Select
          id="calculator-tool"
          value={slug ?? ''}
          onChange={(event) => {
            const next = event.target.value
            router.replace(next ? `${pathname}?tool=${next}` : pathname, { scroll: false })
          }}
        >
          <option value="">Choose a tool…</option>
          {page.items.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </Select>
      </div>

      {!slug ? (
        <ExampleCostPreview input={volumeInput(volume)} />
      ) : toolPending || !tool ? (
        <Skeleton className="h-64 w-full" data-testid="calculator-tool-skeleton" />
      ) : (
        <DocumentCostCalculator tool={tool} input={volumeInput(volume)} />
      )}
    </div>
  )
}
