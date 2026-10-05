import type { CatalogFilters } from '@/lib/catalog/filters'

import { FilterBar } from './filter-bar'
import { ToolSearch } from './tool-search'
import { ToolTable } from './tool-table'

/** Layout only: each child owns the data it renders. */
export function ToolExplorer({ filters }: { filters: CatalogFilters }) {
  return (
    <div className="grid gap-6 md:grid-cols-[13.5rem_1fr] md:gap-10">
      {/* Sticky with its own scroll: the facet list is longer than a screen,
          and a reader narrowing the table should not lose the table to do it. */}
      <aside className="md:sticky md:top-24 md:max-h-[calc(100dvh-7rem)] md:[scrollbar-width:thin] md:[scrollbar-color:var(--border)_transparent] md:self-start md:overflow-y-auto md:pr-3">
        <FilterBar filters={filters} />
      </aside>
      <div className="space-y-6">
        <ToolSearch filters={filters} />
        <ToolTable filters={filters} />
      </div>
    </div>
  )
}
