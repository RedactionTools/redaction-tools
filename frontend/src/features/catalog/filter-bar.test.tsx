import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getListFacetsQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { FacetDimensionOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { FilterBar } from './filter-bar'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/',
}))

const FACETS: FacetDimensionOut[] = [
  {
    code: 'media',
    label: 'Media',
    values: [
      { code: 'pdf', slug: 'pdf', label: 'PDF', has_landing_page: false, tool_count: 7 },
      { code: 'video', slug: 'video', label: 'Video', has_landing_page: false, tool_count: 1 },
      { code: 'audio', slug: 'audio', label: 'Audio', has_landing_page: false, tool_count: 0 },
    ],
  },
  {
    code: 'method',
    label: 'Redaction method',
    values: [
      { code: 'ai', slug: 'ai', label: 'AI-powered', has_landing_page: false, tool_count: 3 },
    ],
  },
]

function render(filters = {}) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getListFacetsQueryKey(), FACETS)
  return renderWithProviders(<FilterBar filters={filters} />, { queryClient })
}

describe('FilterBar', () => {
  beforeEach(() => replace.mockClear())

  it('groups the filters by dimension, leading with media', () => {
    render()

    const groups = screen.getAllByRole('group')
    expect(groups[0]).toHaveAccessibleName('Media')
  })

  it('shows how many tools each facet would leave', () => {
    render()

    expect(screen.getByRole('checkbox', { name: /PDF/ })).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('hides a facet that would match nothing, rather than offering a dead end', () => {
    render()

    expect(screen.queryByRole('checkbox', { name: /Audio/ })).not.toBeInTheDocument()
  })

  it('writes the chosen facet into the URL', async () => {
    render()

    await userEvent.click(screen.getByRole('checkbox', { name: /Video/ }))

    expect(replace).toHaveBeenCalledWith('/?media=video', { scroll: false })
  })

  it('removes a facet that was already applied', async () => {
    render({ media: 'video' })

    await userEvent.click(screen.getByRole('checkbox', { name: /Video/ }))

    expect(replace).toHaveBeenCalledWith('/', { scroll: false })
  })

  it('reflects the applied filters back as checked boxes', () => {
    render({ media: 'video' })

    expect(screen.getByRole('checkbox', { name: /Video/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /PDF/ })).not.toBeChecked()
  })

  it('offers a free-tier filter that does not conflate trials', () => {
    render()

    expect(screen.getByRole('checkbox', { name: /free tier/i })).toBeInTheDocument()
  })

  /**
   * On a phone the rail is nine fieldsets tall and, before this, sat below the
   * whole result table. It folds behind one control instead.
   *
   * Folded with CSS rather than by unmounting: the fieldsets stay in the
   * document at every width, which is what keeps them reachable - and is why
   * every other test in this file can still find them.
   */
  it('folds the filters behind one control on a phone', async () => {
    render()

    const toggle = screen.getByRole('button', { name: /filters/i })
    const panel = document.getElementById('catalog-filters')

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(panel?.className).toContain('max-md:hidden')

    await userEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(panel?.className).not.toContain('max-md:hidden')
  })

  /** A folded panel must not hide that it is already narrowing the results. */
  it('says how many filters are already on', () => {
    render({ media: 'video' })

    expect(screen.getByRole('button', { name: /filters/i })).toHaveTextContent('1')
  })
})
