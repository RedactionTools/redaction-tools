'use client'

import { usePathname, useRouter } from 'next/navigation'

import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useGetTool, useListTools } from '@/lib/api/generated/catalog/catalog'

import { DocumentCostCalculator } from './document-cost-calculator'

/**
 * The catalog-wide cost calculator.
 *
 * The same arithmetic as the one on a tool profile, reached without knowing
 * which tool you want yet. Nothing is preselected: this catalog carries a
 * first-party listing, and defaulting the page to it would be a recommendation
 * dressed as a default.
 */
export function PriceCalculator({ slug }: { slug?: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const { data: page, isPending } = useListTools({ page_size: 100 })
  const { data: tool, isPending: toolPending } = useGetTool(slug ?? '', {
    query: { enabled: Boolean(slug) },
  })

  if (isPending || !page) {
    return <Skeleton className="h-64 w-full" data-testid="price-calculator-skeleton" />
  }

  return (
    <div className="space-y-8" data-testid="price-calculator">
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
        <p className="text-muted-foreground">
          Pick a tool to see what your volume costs on each of its plans.
        </p>
      ) : toolPending || !tool ? (
        <Skeleton className="h-64 w-full" data-testid="calculator-tool-skeleton" />
      ) : (
        <DocumentCostCalculator tool={tool} />
      )}
    </div>
  )
}
