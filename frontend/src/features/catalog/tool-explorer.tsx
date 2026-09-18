import type { CatalogFilters } from '@/lib/catalog/filters'

import { FilterBar } from './filter-bar'
import { ToolSearch } from './tool-search'
import { ToolTable } from './tool-table'

/** Layout only: each child owns the data it renders. */
export function ToolExplorer({ filters }: { filters: CatalogFilters }) {
  return (
    <div className="grid gap-6 md:grid-cols-[14rem_1fr] md:gap-8">
      <aside>
        <FilterBar filters={filters} />
      </aside>
      <div className="space-y-6">
        <ToolSearch filters={filters} />
        <ToolTable filters={filters} />
      </div>
    </div>
  )
}
