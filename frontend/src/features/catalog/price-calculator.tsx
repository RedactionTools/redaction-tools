'use client'

import { useQueries } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getGetToolQueryOptions, useListTools } from '@/lib/api/generated/catalog/catalog'
import { MAX_TOOLS, toolsHref } from '@/lib/catalog/calculator-tools'

import { DEFAULT_VOLUME, VolumeFields, type Volume, volumeInput } from './document-cost-calculator'
import { ExampleCostPreview } from './example-cost-preview'
import { ToolCostComparison } from './tool-cost-comparison'

/**
 * The catalog-wide cost calculator.
 *
 * The same arithmetic as the one on a tool profile, reached without knowing
 * which tool you want yet, and run across as many of them as the reader asks
 * for. Nothing is preselected: this catalog carries a first-party listing, and
 * defaulting the page to it would be a recommendation dressed as a default.
 *
 * The volume lives here rather than in the table, so it can be answered before
 * a tool is chosen and survives choosing one - and so the worked example has a
 * volume to price while the reader is still deciding.
 */
export function PriceCalculator({ slugs }: { slugs: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const [volume, setVolume] = useState<Volume>(DEFAULT_VOLUME)

  const { data: page, isPending } = useListTools({ page_size: 100 })

  // One detail request per tool, because the list endpoint carries a "from"
  // figure rather than plans. They are cached per slug, so adding a fourth tool
  // does not re-fetch the first three.
  const details = useQueries({
    queries: slugs.map((slug) => getGetToolQueryOptions(slug)),
  })

  const show = (next: string[]) => router.replace(toolsHref(pathname, next), { scroll: false })

  if (isPending || !page) {
    return <Skeleton className="h-64 w-full" data-testid="price-calculator-skeleton" />
  }

  // Read off the picker's own list rather than the tool queries, so a chip is
  // there the moment the choice is - and so it can only name a tool the picker
  // actually offered.
  const chosen = slugs.flatMap((slug) => page.items.filter((item) => item.slug === slug))
  const full = slugs.length >= MAX_TOOLS
  const tools = details.map((detail) => detail.data).filter((tool) => tool !== undefined)
  // Pending, not "all of them arrived": a saved comparison outlives the
  // listings in it, and one tool since delisted must not take the others'
  // figures down with it. Its chip stays, so the reader can drop it.
  const loading = details.some((detail) => detail.isPending)

  return (
    <div className="space-y-8" data-testid="price-calculator">
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Your volume</h2>
        <VolumeFields volume={volume} onChange={setVolume} />
      </section>

      <div className="space-y-3">
        {/* `block`: a <label> is inline and the <select> inline-block, so
            without it the two share a line, the wrapper's spacing lands on
            neither, and the label is welded to the edge of the dropdown. */}
        <label className="text-muted-foreground block text-sm" htmlFor="calculator-tool">
          Tools
        </label>
        {/* An adder rather than a picker: it never holds a value, because the
            selection lives in the chips below it and in the URL. */}
        <Select
          id="calculator-tool"
          className="max-w-sm"
          value=""
          disabled={full}
          onChange={(event) => show([...slugs, event.target.value])}
        >
          <option value="">{full ? `Up to ${MAX_TOOLS} tools at a time` : 'Add a tool…'}</option>
          {page.items
            .filter((item) => !slugs.includes(item.slug))
            .map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
        </Select>

        {chosen.length ? (
          <ul className="flex flex-wrap items-center gap-2">
            {chosen.map((item) => (
              <li
                key={item.slug}
                className="border-border flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm"
              >
                {/* The cost is one question about a tool; what it redacts and
                    how that was verified are on its profile, and a reader who
                    has just added it here should not have to go back through
                    the catalog to get there. */}
                <Link
                  href={`/tool/${item.slug}`}
                  aria-label={`${item.name} profile`}
                  className="font-medium hover:underline"
                >
                  {item.name}
                </Link>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-5 items-center justify-center rounded-full leading-none"
                  onClick={() => show(slugs.filter((slug) => slug !== item.slug))}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {!slugs.length ? (
        <ExampleCostPreview input={volumeInput(volume)} />
      ) : loading ? (
        <Skeleton className="h-64 w-full" data-testid="calculator-tool-skeleton" />
      ) : tools.length ? (
        <ToolCostComparison tools={tools} input={volumeInput(volume)} />
      ) : null}
    </div>
  )
}
