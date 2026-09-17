import type { CatalogFilters } from '@/lib/catalog/filters'

import { FilterBar } from './filter-bar'
import { ToolSearch } from './tool-search'
import { ToolTable } from './tool-table'

/** Layout only: each child owns the data it renders. */
export function ToolExplorer({ filters }: { filters: CatalogFilters }) {
  return (
    <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
      <aside className="order-2 md:order-1">
        <FilterBar filters={filters} />
      </aside>
      <div className="order-1 space-y-6 md:order-2">
        <ToolSearch filters={filters} />
        <ToolTable filters={filters} />
      </div>
    </div>
  )
}
