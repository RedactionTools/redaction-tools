import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getGetToolQueryKey, getListToolsQueryKey } from '@/lib/api/generated/catalog/catalog'
import type { ToolDetailOut } from '@/lib/api/generated/model'
import { makeQueryClient } from '@/lib/query/client'
import { renderWithProviders } from '@/test/render'

import { makePage, makePlan, makePrice, makeTool, makeToolDetail } from './fixtures'
import { PriceCalculator } from './price-calculator'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/price-calculator',
}))

const TOOLS = [
  makeTool({ slug: 'adobe-acrobat', name: 'Adobe Acrobat' }),
  makeTool({ slug: 'redactable', name: 'Redactable' }),
]

function detail(): ToolDetailOut {
  return makeToolDetail({
    slug: 'redactable',
    name: 'Redactable',
    plans: [
      makePlan({
        code: 'payg',
        name: 'Pay per document',
        prices: [makePrice({ amount: '1.0000', unit: 'document', billing_period: 'usage' })],
      }),
    ],
  })
}

function render(slug?: string) {
  const queryClient = makeQueryClient()
  queryClient.setQueryData(getListToolsQueryKey({ page_size: 100 }), makePage(TOOLS))
  queryClient.setQueryData(getGetToolQueryKey('redactable'), detail())
  return renderWithProviders(<PriceCalculator slug={slug} />, { queryClient })
}

beforeEach(() => replace.mockClear())

describe('PriceCalculator', () => {
  it('lists every catalog tool to choose from', () => {
    render()

    const picker = screen.getByLabelText('Tool')

    expect(within(picker).getByRole('option', { name: 'Adobe Acrobat' })).toBeInTheDocument()
    expect(within(picker).getByRole('option', { name: 'Redactable' })).toBeInTheDocument()
  })

  it('preselects nothing, so the first-party listing gets no free placement', () => {
    render()

    expect(screen.getByLabelText('Tool')).toHaveValue('')
    expect(screen.getByText(/pick a tool/i)).toBeInTheDocument()
    expect(screen.queryByTestId('document-cost-calculator')).not.toBeInTheDocument()
  })

  it('puts the chosen tool in the URL, so a calculation can be linked to', async () => {
    const user = userEvent.setup()
    render()

    await user.selectOptions(screen.getByLabelText('Tool'), 'redactable')

    expect(replace).toHaveBeenCalledWith('/price-calculator?tool=redactable', { scroll: false })
  })

  it('calculates against the chosen tool plans', () => {
    render('redactable')

    expect(screen.getByTestId('document-cost-calculator')).toBeInTheDocument()
    // The default ten-page document on a $1.00-per-document plan.
    expect(within(screen.getByTestId('cost-row-payg')).getByText('$1.00')).toBeInTheDocument()
    expect(within(screen.getByTestId('cost-row-payg')).getByText('$0.10')).toBeInTheDocument()
  })
})
